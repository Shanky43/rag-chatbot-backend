const { v4: uuidv4 } = require("uuid");
const {
    addMessageToRedis,
    getSessionHistory,
    clearRedisSession,
    getAllRedisSessionMessages,
} = require("../services/redisService");
const {
    backupSessionToDb,
    getCombinedChatHistory,
    saveMessageToDb,
} = require("../services/chatDbService");

// Import your existing services
const { getJinaEmbeddings } = require("../services/jinaService");
const { fetchNews } = require("../services/newsService");
const { generateAnswerWithContext } = require("../services/geminiService");
const prisma = require("../services/prismaService");
const { searchQdrant } = require("../services/qdrantService.js");
const { getFallbackResponse } = require("../utils/db.js");

// Processing states to prevent duplicate processing
const processingStates = new Map();

// Retry function for Gemini API with exponential backoff
const generateAnswerWithContextRetry = async (
    query,
    articles,
    maxRetries = 3
) => {
    const { generateAnswerWithContext } = require("../services/geminiService");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await generateAnswerWithContext(query, articles);
        } catch (error) {
            console.log(`Gemini API attempt ${attempt} failed:`, error.message);

            if (
                (error.status === 503 ||
                    error.status === 429 ||
                    error.message.includes("overloaded")) &&
                attempt < maxRetries
            ) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Waiting ${delay}ms before retry ${attempt + 1}...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            throw error;
        }
    }
};

// FIXED: Enhanced status update helper with better visibility
const emitStatusUpdate = (socket, sessionId, status, message, delay = 1000) => {
    return new Promise((resolve) => {
        // Emit to all clients in the session
        socket.to(sessionId).emit("status_update", {
            status,
            message,
            timestamp: new Date().toISOString(),
            visible: true, // Ensure frontend shows this
        });

        // Also emit to the sender
        socket.emit("status_update", {
            status,
            message,
            timestamp: new Date().toISOString(),
            visible: true,
        });

        console.log(`Status update - ${sessionId}: ${status} - ${message}`);
        setTimeout(resolve, delay);
    });
};

// Search functions (keeping your existing logic)
const searchInDatabase = async (searchTerm, limit = 5) => {
    try {
        const articles = await prisma.article.findMany({
            where: {
                OR: [
                    {
                        title: {
                            contains: searchTerm,
                            mode: "insensitive",
                        },
                    },
                    {
                        description: {
                            contains: searchTerm,
                            mode: "insensitive",
                        },
                    },
                    {
                        content: {
                            contains: searchTerm,
                            mode: "insensitive",
                        },
                    },
                ],
            },
            orderBy: {
                published_at: "desc",
            },
            take: limit,
        });

        return articles;
    } catch (error) {
        console.error("Database search error:", error);
        return [];
    }
};

const calculateRelevanceScore = (article, query) => {
    let score = 0;
    const queryWords = query.toLowerCase().split(" ");

    const titleMatches = queryWords.filter((word) =>
        article.title?.toLowerCase().includes(word)
    ).length;
    score += titleMatches * 3;

    const descMatches = queryWords.filter((word) =>
        article.description?.toLowerCase().includes(word)
    ).length;
    score += descMatches * 2;

    const contentMatches = queryWords.filter((word) =>
        article.content?.toLowerCase().includes(word)
    ).length;
    score += contentMatches * 1;

    if (article.score) {
        score += article.score * 10;
    }

    return score;
};

const selectMostRelevantArticle = (articles, query) => {
    if (!articles || articles.length === 0) return null;
    if (articles.length === 1) return articles[0];

    const scoredArticles = articles.map((article) => ({
        ...article,
        relevanceScore: calculateRelevanceScore(article, query),
    }));

    scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scoredArticles[0];
};

const handleDisconnectionBackup = async (sessionId) => {
    try {
        const messages = await getAllRedisSessionMessages(sessionId);
        if (messages.length > 0) {
            await backupSessionToDb(sessionId, messages);
            console.log(
                `Backed up ${messages.length} messages for session ${sessionId}`
            );
        }
    } catch (error) {
        console.error("Error during disconnection backup:", error);
    }
};

// FIXED: Enhanced processSearchQuery with better status updates
const processSearchQuery = async (query, sessionId, socket) => {
    try {
        let articles = [];
        let source = "";
        let searchStep = 0;

        // FIXED: More engaging status messages
        await emitStatusUpdate(
            socket,
            sessionId,
            "initializing",
            "🔍 Starting your search...",
            800
        );

        const dbResults = await searchInDatabase(query, 5);

        if (dbResults && dbResults.length > 0) {
            articles = dbResults;
            source = "database";
            searchStep = 1;
            await emitStatusUpdate(
                socket,
                sessionId,
                "found",
                `📚 Found ${dbResults.length} relevant articles in knowledge base`,
                700
            );
        } else {
            await emitStatusUpdate(
                socket,
                sessionId,
                "analyzing",
                "🧠 Analyzing your query with AI semantic search...",
                900
            );

            try {
                const queryEmbeddings = await getJinaEmbeddings([query]);

                if (queryEmbeddings && queryEmbeddings.length > 0) {
                    const queryEmbedding = queryEmbeddings[0];
                    const searchResults = await searchQdrant(queryEmbedding, 5);

                    if (searchResults && searchResults.length > 0) {
                        articles = searchResults.map((r) => ({
                            ...r.payload,
                            score: r.score,
                            similarity: `${Math.round(r.score * 100)}%`,
                        }));
                        source = "qdrant";
                        searchStep = 2;
                        await emitStatusUpdate(
                            socket,
                            sessionId,
                            "found",
                            `✨ Found ${searchResults.length} semantically similar articles`,
                            600
                        );
                    }
                }
            } catch (qdrantError) {
                console.error("Qdrant search error:", qdrantError);
            }

            if (articles.length === 0) {
                await emitStatusUpdate(
                    socket,
                    sessionId,
                    "fetching",
                    "🌐 Fetching latest news from external sources...",
                    900
                );

                try {
                    const { fetchNews } = require("../services/newsService");
                    const freshArticles = await fetchNews(query);

                    if (freshArticles && freshArticles.length > 0) {
                        articles = freshArticles;
                        source = "newsapi";
                        searchStep = 3;
                        await emitStatusUpdate(
                            socket,
                            sessionId,
                            "found",
                            `📰 Retrieved ${freshArticles.length} fresh articles`,
                            600
                        );
                    }
                } catch (newsError) {
                    console.error("News API error:", newsError);
                }
            }
        }

        if (articles.length > 0) {
            const validArticles = articles.filter(
                (article) => article.title || article.content || article.description
            );

            if (validArticles.length === 0) {
                await emitStatusUpdate(
                    socket,
                    sessionId,
                    "fetching",
                    "🔄 Searching additional sources...",
                    800
                );
                try {
                    const { fetchNews } = require("../services/newsService");
                    const freshArticles = await fetchNews(query);
                    if (freshArticles && freshArticles.length > 0) {
                        articles = freshArticles;
                        source = "newsapi";
                        searchStep = 3;
                        await emitStatusUpdate(
                            socket,
                            sessionId,
                            "found",
                            `📋 Retrieved ${freshArticles.length} additional articles`,
                            600
                        );
                    }
                } catch (newsError) {
                    console.error("News API fallback failed:", newsError);
                }
            } else {
                articles = validArticles;
            }

            await emitStatusUpdate(
                socket,
                sessionId,
                "processing",
                "⚡ Selecting most relevant information...",
                700
            );
            const mostRelevantArticle = selectMostRelevantArticle(articles, query);

            await emitStatusUpdate(
                socket,
                sessionId,
                "generating",
                "🤖 AI is crafting your comprehensive response...",
                1000
            );

            let aiResponse;
            let aiError = null;

            if (
                !mostRelevantArticle ||
                (!mostRelevantArticle.title &&
                    !mostRelevantArticle.content &&
                    !mostRelevantArticle.description)
            ) {
                // aiResponse = `I found some results for "${query}" but the articles don't contain readable content. This might be due to data indexing issues. Please try a more specific query or check back later.`;
                aiResponse = getFallbackResponse(query);
            } else {
                try {
                    aiResponse = await generateAnswerWithContextRetry(query, [
                        mostRelevantArticle,
                    ]);

                    if (!aiResponse || aiResponse.trim().length === 0) {
                        aiResponse = getFallbackResponse(query);
                    }
                } catch (aiErr) {
                    console.error("AI generation failed after retries:", aiErr.message);
                    aiError = aiErr;

                    const article = mostRelevantArticle;
                    aiResponse = `
<b>${query}</b><br/><br/>
${article.source_name ? `From <i>${article.source_name}</i><br/><br/>` : ""}

<p>${article.title || "Article"}</p><br/>
${article.description ||
                        article.content ||
                        "Please check the full article for details."
                        }<br/><br/>

${article.author ? `Source: ${article.author}<br/>` : ""}
${article.published_at
                            ? `Published: ${new Date(article.published_at).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                                timeZone: "Asia/Kolkata",
                            })}`
                            : ""
                        }
`;
                }
            }

            await emitStatusUpdate(
                socket,
                sessionId,
                "complete",
                "✅ Response ready!",
                300
            );

            return {
                success: true,
                source,
                searchStep,
                totalFound: articles.length,
                aiAnswer: aiResponse,
                aiError: aiError
                    ? {
                        type:
                            aiError.status === 503
                                ? "service_overloaded"
                                : "ai_generation_failed",
                        message:
                            aiError.status === 503
                                ? "AI service temporarily overloaded"
                                : "AI generation failed",
                        fallbackUsed: true,
                    }
                    : null,
                sourceDetails: {
                    title: mostRelevantArticle.title,
                    author: mostRelevantArticle.author,
                    source_name:
                        mostRelevantArticle.source_name || mostRelevantArticle.source?.name,
                    url: mostRelevantArticle.url,
                    urlToImage: mostRelevantArticle.urlToImage,
                    published_at:
                        mostRelevantArticle.published_at || mostRelevantArticle.publishedAt,
                    relevanceScore: mostRelevantArticle.relevanceScore?.toFixed(2),
                },
            };
        }

        await emitStatusUpdate(
            socket,
            sessionId,
            "complete",
            "❌ No relevant information found",
            300
        );

        return {
            success: false,
            source: "none",
            searchStep: 0,
            totalFound: 0,
            aiAnswer:
                "No relevant information found for your query. Please try different keywords.",
            sourceDetails: null,
        };
    } catch (error) {
        console.error("Error in processSearchQuery:", error);
        await emitStatusUpdate(
            socket,
            sessionId,
            "error",
            "⚠️ An error occurred during search",
            300
        );

        return {
            success: false,
            source: "error",
            searchStep: 0,
            totalFound: 0,
            aiAnswer:
                "An error occurred while processing your query. Please try again.",
            sourceDetails: null,
            error: error.message,
        };
    }
};

const isValidSessionId = (sessionId) => {
    return sessionId && typeof sessionId === "string" && sessionId.length > 0;
};

// MAIN SOCKET HANDLER WITH ALL FIXES
const setupSocketHandlers = (io) => {
    io.engine.on("connection_error", (err) => {
        console.log("Socket.IO connection error:", err.req);
        console.log("Error code:", err.code);
        console.log("Error message:", err.message);
        console.log("Error context:", err.context);
    });

    io.engine.pingTimeout = 60000;
    io.engine.pingInterval = 25000;

    io.on("connection", (socket) => {
        console.log(`User connected: ${socket.id}`);
        socket.timeout = 30000;

        socket.on("join_session", async (data) => {
            try {
                let { sessionId } = data || {};

                if (!isValidSessionId(sessionId)) {
                    sessionId = uuidv4();
                }

                // Leave all previous rooms except socket.id
                const rooms = Array.from(socket.rooms);
                rooms.forEach((room) => {
                    if (room !== socket.id) {
                        socket.leave(room);
                    }
                });

                socket.join(sessionId);
                socket.sessionId = sessionId;

                let history = [];
                try {
                    history = await getCombinedChatHistory(sessionId);
                } catch (historyError) {
                    console.error("Error fetching history:", historyError);
                }

                socket.emit("session_joined", {
                    success: true,
                    sessionId,
                    history,
                    message: `Successfully joined session: ${sessionId}`,
                    timestamp: new Date().toISOString(),
                });

                console.log(`User ${socket.id} joined session: ${sessionId}`);
            } catch (error) {
                console.error("Error joining session:", error);
                socket.emit("session_joined", {
                    success: false,
                    error: "Failed to join session",
                    message: error.message,
                });
            }
        });

        // FIXED: Enhanced message handler to prevent ALL duplication issues
        socket.on("send_message", async (data) => {
            try {
                const { message, sessionId } = data || {};

                if (
                    !message ||
                    typeof message !== "string" ||
                    message.trim().length === 0
                ) {
                    socket.emit("message_error", {
                        success: false,
                        error: "Message cannot be empty",
                    });
                    return;
                }

                if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
                    socket.emit("message_error", {
                        success: false,
                        error: "No valid session found. Please join a session first.",
                    });
                    return;
                }

                const trimmedMessage = message.trim();

                // FIXED: Create processing key to prevent duplicate processing
                const processingKey = `${sessionId}_${trimmedMessage}_${Date.now()}`;

                if (processingStates.has(sessionId)) {
                    console.log(
                        `Already processing message for session ${sessionId}, ignoring duplicate`
                    );
                    return;
                }

                processingStates.set(sessionId, processingKey);

                try {
                    // Generate unique message ID
                    const messageId = `msg_${Date.now()}_${Math.random()
                        .toString(36)
                        .substr(2, 9)}`;

                    // Store user message
                    let userMessage;
                    try {
                        userMessage = await addMessageToRedis(sessionId, {
                            id: messageId,
                            type: "user",
                            content: trimmedMessage,
                            sender: "user",
                            timestamp: new Date().toISOString(),
                        });
                    } catch (redisError) {
                        console.error("Redis error, using fallback:", redisError);
                        userMessage = {
                            id: messageId,
                            type: "user",
                            content: trimmedMessage,
                            sender: "user",
                            timestamp: new Date().toISOString(),
                            sessionId,
                        };
                    }

                    // Save to DB
                    try {
                        await saveMessageToDb(sessionId, userMessage);
                    } catch (dbError) {
                        console.error("DB save error for user message:", dbError);
                    }

                    // FIXED: Broadcast user message to ALL clients in session
                    io.to(sessionId).emit("new_message", {
                        ...userMessage,
                        success: true,
                    });

                    console.log(
                        `Processing query: "${trimmedMessage}" for session: ${sessionId}`
                    );

                    // Process the search query
                    const searchResult = await processSearchQuery(
                        trimmedMessage,
                        sessionId,
                        socket
                    );

                    // Generate unique ID for AI message
                    const aiMessageId = `ai_${Date.now()}_${Math.random()
                        .toString(36)
                        .substr(2, 9)}`;

                    let aiMessage;
                    try {
                        aiMessage = await addMessageToRedis(sessionId, {
                            id: aiMessageId,
                            type: "assistant",
                            content:
                                searchResult.aiAnswer || "No relevant information found.",
                            sender: "assistant",
                            timestamp: new Date().toISOString(),
                            metadata: {
                                source: searchResult.source,
                                searchStep: searchResult.searchStep,
                                totalFound: searchResult.totalFound,
                                sourceDetails: searchResult.sourceDetails,
                                success: searchResult.success,
                                aiError: searchResult.aiError,
                            },
                        });
                    } catch (redisError) {
                        console.error("Redis error for AI message:", redisError);
                        aiMessage = {
                            id: aiMessageId,
                            type: "assistant",
                            content:
                                searchResult.aiAnswer || "No relevant information found.",
                            sender: "assistant",
                            timestamp: new Date().toISOString(),
                            sessionId,
                            metadata: {
                                source: searchResult.source,
                                searchStep: searchResult.searchStep,
                                totalFound: searchResult.totalFound,
                                sourceDetails: searchResult.sourceDetails,
                                success: searchResult.success,
                                aiError: searchResult.aiError,
                            },
                        };
                    }

                    try {
                        await saveMessageToDb(sessionId, aiMessage);
                    } catch (dbError) {
                        console.error("DB save error for AI message:", dbError);
                    }

                    // Broadcast AI response to ALL clients in session
                    io.to(sessionId).emit("new_message", {
                        ...aiMessage,
                        success: true,
                    });

                    console.log("Message broadcasting completed");
                } finally {
                    // FIXED: Always clean up processing state
                    processingStates.delete(sessionId);
                }
            } catch (error) {
                console.error("Error processing message:", error);

                // Clean up processing state on error
                processingStates.delete(sessionId);

                const errorMessage = {
                    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: "assistant",
                    content:
                        "Sorry, I encountered an error while processing your message. Please try again.",
                    sender: "assistant",
                    timestamp: new Date().toISOString(),
                    error: true,
                };

                io.to(sessionId).emit("new_message", errorMessage);

                socket.emit("message_error", {
                    success: false,
                    error: "Failed to process message",
                    message: error.message,
                });
            }
        });

        socket.on("get_history", async (data) => {
            try {
                const { sessionId, limit = 50, offset = 0 } = data || {};

                if (!isValidSessionId(sessionId)) {
                    socket.emit("history_error", {
                        success: false,
                        error: "Invalid session ID",
                    });
                    return;
                }

                const history = await getCombinedChatHistory(sessionId, limit, offset);

                socket.emit("session_history", {
                    success: true,
                    sessionId,
                    history,
                    count: history.length,
                });
            } catch (error) {
                console.error("Error getting history:", error);
                socket.emit("history_error", {
                    success: false,
                    error: "Failed to get session history",
                    message: error.message,
                });
            }
        });

        // FIXED: Clear session only for the specific sessionId, not all sessions
        socket.on("clear_session", async (data) => {
            try {
                const { sessionId } = data || {};

                if (!isValidSessionId(sessionId)) {
                    socket.emit("clear_error", {
                        success: false,
                        error: "Invalid session ID",
                    });
                    return;
                }

                // FIXED: Only clear the specific session
                try {
                    const cleared = await clearRedisSession(sessionId);
                    console.log(`Cleared session ${sessionId}: ${cleared}`);
                } catch (clearError) {
                    console.error("Error clearing Redis session:", clearError);
                }

                // FIXED: Emit session_cleared only to clients in THIS specific session
                io.to(sessionId).emit("session_cleared", {
                    success: true,
                    sessionId,
                    message: "Session cache cleared successfully",
                    timestamp: new Date().toISOString(),
                });

                console.log(`Session ${sessionId} cleared by user ${socket.id}`);
            } catch (error) {
                console.error("Error clearing session:", error);
                socket.emit("clear_error", {
                    success: false,
                    error: "Failed to clear session",
                    message: error.message,
                });
            }
        });

        socket.on("ping", () => {
            socket.emit("pong", {
                timestamp: new Date().toISOString(),
                serverTime: Date.now(),
            });
        });

        socket.on("disconnect", async (reason) => {
            console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

            // Clean up any processing states for this socket's session
            if (socket.sessionId) {
                processingStates.delete(socket.sessionId);

                try {
                    await handleDisconnectionBackup(socket.sessionId);
                } catch (backupError) {
                    console.error("Error during disconnect backup:", backupError);
                }
            }
        });

        socket.on("error", (error) => {
            console.error(`Socket error for ${socket.id}:`, error);
            // Clean up processing states on error
            if (socket.sessionId) {
                processingStates.delete(socket.sessionId);
            }
        });

        socket.on("redis_error", async (data) => {
            const { sessionId } = data || {};
            if (isValidSessionId(sessionId)) {
                try {
                    await handleDisconnectionBackup(sessionId);
                } catch (backupError) {
                    console.error("Error during Redis error backup:", backupError);
                }
            }
        });
    });

    io.engine.on("connection_error", (err) => {
        console.error("Socket.IO Engine Error:", {
            req: err.req?.url,
            code: err.code,
            message: err.message,
            context: err.context,
        });
    });
};

module.exports = { setupSocketHandlers };
