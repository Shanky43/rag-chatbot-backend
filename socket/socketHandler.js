// // socket/socketHandler.js
// const { v4: uuidv4 } = require('uuid');
// const { addMessageToRedis, getSessionHistory, clearRedisSession, getAllRedisSessionMessages } = require('../services/redisService');
// const { backupSessionToDb, getCombinedChatHistory, saveMessageToDb } = require('../services/chatDbService');

// // Import your existing services
// const { getJinaEmbeddings } = require('../services/jinaService');
// const { fetchNews } = require('../services/newsService');
// const { generateAnswerWithContext } = require('../services/geminiService');
// const prisma = require('../services/prismaService');
// const { searchQdrant } = require('../services/qdrantService.JS');

// // Retry function for Gemini API with exponential backoff
// const generateAnswerWithContextRetry = async (query, articles, maxRetries = 3) => {
//     const { generateAnswerWithContext } = require('../services/geminiService');

//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//         try {
//             return await generateAnswerWithContext(query, articles);
//         } catch (error) {
//             console.log(`Gemini API attempt ${attempt} failed:`, error.message);

//             // If it's a 503 (overloaded) or rate limit error, retry with exponential backoff
//             if ((error.status === 503 || error.status === 429 || error.message.includes('overloaded')) && attempt < maxRetries) {
//                 const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
//                 console.log(`Waiting ${delay}ms before retry ${attempt + 1}...`);
//                 await new Promise(resolve => setTimeout(resolve, delay));
//                 continue;
//             }

//             // If final attempt or non-retryable error, throw
//             throw error;
//         }
//     }
// };

// // Reuse your existing search function
// const searchInDatabase = async (searchTerm, limit = 5) => {
//     try {
//         const articles = await prisma.article.findMany({
//             where: {
//                 OR: [
//                     {
//                         title: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     },
//                     {
//                         description: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     },
//                     {
//                         content: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     }
//                 ]
//             },
//             orderBy: {
//                 published_at: 'desc'
//             },
//             take: limit
//         });

//         return articles;
//     } catch (error) {
//         console.error('Database search error:', error);
//         return [];
//     }
// };

// // Reuse your existing relevance scoring functions
// const calculateRelevanceScore = (article, query) => {
//     let score = 0;
//     const queryWords = query.toLowerCase().split(' ');

//     const titleMatches = queryWords.filter(word =>
//         article.title?.toLowerCase().includes(word)
//     ).length;
//     score += titleMatches * 3;

//     const descMatches = queryWords.filter(word =>
//         article.description?.toLowerCase().includes(word)
//     ).length;
//     score += descMatches * 2;

//     const contentMatches = queryWords.filter(word =>
//         article.content?.toLowerCase().includes(word)
//     ).length;
//     score += contentMatches * 1;

//     if (article.score) {
//         score += article.score * 10;
//     }

//     return score;
// };

// const selectMostRelevantArticle = (articles, query) => {
//     if (!articles || articles.length === 0) return null;
//     if (articles.length === 1) return articles[0];

//     const scoredArticles = articles.map(article => ({
//         ...article,
//         relevanceScore: calculateRelevanceScore(article, query)
//     }));

//     scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
//     return scoredArticles[0];
// };

// // Auto-backup Redis to DB when connection issues occur
// const handleDisconnectionBackup = async (sessionId) => {
//     try {
//         const messages = await getAllRedisSessionMessages(sessionId);
//         if (messages.length > 0) {
//             await backupSessionToDb(sessionId, messages);
//             console.log(`Backed up ${messages.length} messages for session ${sessionId}`);
//         }
//     } catch (error) {
//         console.error('Error during disconnection backup:', error);
//     }
// };

// // Process search using existing functions
// const processSearchQuery = async (query, sessionId) => {
//     try {
//         let articles = [];
//         let source = '';
//         let searchStep = 0;

//         // STEP 1: Search in Database (reuse existing function)
//         const dbResults = await searchInDatabase(query, 5);

//         if (dbResults && dbResults.length > 0) {
//             articles = dbResults;
//             source = 'database';
//             searchStep = 1;
//         } else {
//             // STEP 2: Search in Qdrant (reuse existing service)
//             try {
//                 const queryEmbeddings = await getJinaEmbeddings([query]);

//                 if (queryEmbeddings && queryEmbeddings.length > 0) {
//                     const queryEmbedding = queryEmbeddings[0];
//                     const searchResults = await searchQdrant(queryEmbedding, 5);

//                     if (searchResults && searchResults.length > 0) {
//                         articles = searchResults.map(r => ({
//                             ...r.payload,
//                             score: r.score,
//                             similarity: `${Math.round(r.score * 100)}%`
//                         }));
//                         source = 'qdrant';
//                         searchStep = 2;
//                     }
//                 }
//             } catch (qdrantError) {
//                 console.error('Qdrant search error:', qdrantError);
//             }

//             // STEP 3: Fetch from News API if no results from Qdrant
//             if (articles.length === 0) {
//                 try {
//                     const freshArticles = await fetchNews(query);

//                     if (freshArticles && freshArticles.length > 0) {
//                         articles = freshArticles;
//                         source = 'newsapi';
//                         searchStep = 3;
//                     }
//                 } catch (newsError) {
//                     console.error('News API error:', newsError);
//                 }
//             }
//         }

//         if (articles.length > 0) {
//             console.log('Articles found:', articles.length);
//             console.log('First article preview:', {
//                 title: articles[0].title,
//                 hasContent: !!articles[0].content,
//                 hasDescription: !!articles[0].description,
//                 source: articles[0].source_name || articles[0].source?.name
//             });

//             // Check if articles have actual content
//             const validArticles = articles.filter(article =>
//                 article.title || article.content || article.description
//             );

//             console.log(`Valid articles with content: ${validArticles.length} out of ${articles.length}`);

//             if (validArticles.length === 0) {
//                 console.log('No valid articles found, falling back to News API');
//                 // Fall back to fresh news if Qdrant articles are empty
//                 try {
//                     const freshArticles = await fetchNews(query);
//                     if (freshArticles && freshArticles.length > 0) {
//                         articles = freshArticles;
//                         source = 'newsapi';
//                         searchStep = 3;
//                         console.log('Fetched fresh articles:', freshArticles.length);
//                     }
//                 } catch (newsError) {
//                     console.error('News API fallback failed:', newsError);
//                 }
//             } else {
//                 articles = validArticles;
//             }

//             // Select most relevant article (reuse existing function)
//             const mostRelevantArticle = selectMostRelevantArticle(articles, query);
//             console.log('Most relevant article selected:', {
//                 title: mostRelevantArticle?.title,
//                 hasContent: !!mostRelevantArticle?.content,
//                 relevanceScore: mostRelevantArticle?.relevanceScore
//             });

//             // Generate AI response with retry logic
//             let aiResponse;
//             let aiError = null;
//             console.log('Attempting to generate AI response...');

//             // Check if we have valid article content
//             if (!mostRelevantArticle || (!mostRelevantArticle.title && !mostRelevantArticle.content && !mostRelevantArticle.description)) {
//                 console.log('No valid article content for AI generation');
//                 aiResponse = `I found some results for "${query}" but the articles don't contain readable content. This might be due to data indexing issues. Please try a more specific query or check back later.`;
//             } else {
//                 try {
//                     aiResponse = await generateAnswerWithContextRetry(query, [mostRelevantArticle]);
//                     console.log('AI response generated successfully, length:', aiResponse?.length || 0);

//                     // Check if AI response is actually meaningful
//                     if (!aiResponse || aiResponse.trim().length === 0) {
//                         console.log('AI returned empty response, using fallback');
//                         aiResponse = `I found information about "${query}" but couldn't generate a detailed response. Please check the source details below or try a different query.`;
//                     }
//                 } catch (aiErr) {
//                     console.error('AI generation failed after retries:', aiErr.message);
//                     aiError = aiErr;

//                     // Create a fallback response based on the article
//                     const article = mostRelevantArticle;
//                     //                     aiResponse = `**${query}**\n${article.source_name ? `From ${article.source_name}.` : '' }. 

//                     // **${article.title || 'Article'}**
//                     // ${article.description || article.content?.substring(0, 200) + '...' || 'Please check the full article for details.'}

//                     // Source: ${article.author ? `by ${article.author}` : 'Unknown author'}
//                     // ${article.published_at ? `Published: ${new Date(article.published_at).toLocaleDateString()}` : ''}
//                     // `;
//                     aiResponse = `
// <b>${query}</b><br/><br/>
// ${article.source_name ? `From <i>${article.source_name}</i><br/><br/>` : ''}

// <p>${article.title || 'Article'}</p><br/>
// ${article.description || (article.content ? article.content.substring(0, 200) + '...' : 'Please check the full article for details.')}<br/><br/>

// ${article.author ? `Source: ${article.author}<br/>` : ''}
// ${article.published_at ? `Published: ${new Date(article.published_at).toLocaleString("en-IN", {
//                         dateStyle: "medium",
//                         timeStyle: "short",
//                         timeZone: "Asia/Kolkata",
//                     })}` : ''}
// `;



//                 }
//             }

//             return {
//                 success: true,
//                 source,
//                 searchStep,
//                 totalFound: articles.length,
//                 aiAnswer: aiResponse,
//                 aiError: aiError ? {
//                     type: aiError.status === 503 ? 'service_overloaded' : 'ai_generation_failed',
//                     message: aiError.status === 503 ? 'AI service temporarily overloaded' : 'AI generation failed',
//                     fallbackUsed: true
//                 } : null,
//                 sourceDetails: {
//                     title: mostRelevantArticle.title,
//                     author: mostRelevantArticle.author,
//                     source_name: mostRelevantArticle.source_name || mostRelevantArticle.source?.name,
//                     url: mostRelevantArticle.url,
//                     urlToImage: mostRelevantArticle.urlToImage,
//                     published_at: mostRelevantArticle.published_at || mostRelevantArticle.publishedAt,
//                     relevanceScore: mostRelevantArticle.relevanceScore?.toFixed(2)
//                 }
//             };
//         }

//         return {
//             success: false,
//             source: 'none',
//             searchStep: 0,
//             totalFound: 0,
//             aiAnswer: 'No relevant information found for your query. Please try different keywords.',
//             sourceDetails: null
//         };

//     } catch (error) {
//         console.error('Error in processSearchQuery:', error);
//         return {
//             success: false,
//             source: 'error',
//             searchStep: 0,
//             totalFound: 0,
//             aiAnswer: 'An error occurred while processing your query. Please try again.',
//             sourceDetails: null,
//             error: error.message
//         };
//     }
// };

// // Validate session ID
// const isValidSessionId = (sessionId) => {
//     return sessionId && typeof sessionId === 'string' && sessionId.length > 0;
// };

// // Main socket setup function with improved error handling
// const setupSocketHandlers = (io) => {
//     // Configure CORS and transport options
//     io.engine.on('connection_error', (err) => {
//         console.log('Socket.IO connection error:', err.req);
//         console.log('Error code:', err.code);
//         console.log('Error message:', err.message);
//         console.log('Error context:', err.context);
//     });

//     // Set engine options for better connection stability
//     io.engine.pingTimeout = 60000; // 60 seconds
//     io.engine.pingInterval = 25000; // 25 seconds

//     io.on('connection', (socket) => {
//         console.log(`User connected: ${socket.id}`);

//         // Set socket timeout
//         socket.timeout = 30000;

//         // Join session handler with improved validation
//         socket.on('join_session', async (data) => {
//             try {
//                 let { sessionId } = data || {};

//                 // Generate new session ID if not provided or invalid
//                 if (!isValidSessionId(sessionId)) {
//                     sessionId = uuidv4();
//                 }

//                 // Leave any existing rooms
//                 const rooms = Array.from(socket.rooms);
//                 rooms.forEach(room => {
//                     if (room !== socket.id) {
//                         socket.leave(room);
//                     }
//                 });

//                 // Join new session
//                 socket.join(sessionId);
//                 socket.sessionId = sessionId;

//                 // Get combined history (Redis + DB) with error handling
//                 let history = [];
//                 try {
//                     history = await getCombinedChatHistory(sessionId);
//                 } catch (historyError) {
//                     console.error('Error fetching history:', historyError);
//                     // Continue with empty history
//                 }

//                 socket.emit('session_joined', {
//                     success: true,
//                     sessionId,
//                     history,
//                     message: `Successfully joined session: ${sessionId}`,
//                     timestamp: new Date().toISOString()
//                 });

//                 console.log(`User ${socket.id} joined session: ${sessionId}`);
//             } catch (error) {
//                 console.error('Error joining session:', error);
//                 socket.emit('session_joined', {
//                     success: false,
//                     error: 'Failed to join session',
//                     message: error.message
//                 });
//             }
//         });

//         // Message handler with enhanced error handling
//         socket.on('send_message', async (data) => {
//             try {
//                 const { message, sessionId } = data || {};

//                 // Validate inputs
//                 if (!message || typeof message !== 'string' || message.trim().length === 0) {
//                     socket.emit('message_error', {
//                         success: false,
//                         error: 'Message cannot be empty'
//                     });
//                     return;
//                 }

//                 if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
//                     socket.emit('message_error', {
//                         success: false,
//                         error: 'No valid session found. Please join a session first.'
//                     });
//                     return;
//                 }

//                 const trimmedMessage = message.trim();

//                 // Store user message in Redis with error handling
//                 let userMessage;
//                 try {
//                     userMessage = await addMessageToRedis(sessionId, {
//                         type: 'user',
//                         content: trimmedMessage,
//                         sender: 'user',
//                         timestamp: new Date().toISOString()
//                     });
//                 } catch (redisError) {
//                     console.error('Redis error, storing directly to DB:', redisError);
//                     // Fallback to DB only
//                     userMessage = {
//                         id: uuidv4(),
//                         type: 'user',
//                         content: trimmedMessage,
//                         sender: 'user',
//                         timestamp: new Date().toISOString(),
//                         sessionId
//                     };
//                 }

//                 // Backup to DB
//                 try {
//                     await saveMessageToDb(sessionId, userMessage);
//                 } catch (dbError) {
//                     console.error('DB save error for user message:', dbError);
//                     // Continue processing even if DB save fails
//                 }

//                 // Broadcast user message
//                 io.to(sessionId).emit('new_message', {
//                     ...userMessage,
//                     success: true
//                 });

//                 // Emit searching status
//                 socket.to(sessionId).emit('status_update', {
//                     status: 'searching',
//                     message: 'Searching for relevant information...'
//                 });

//                 // Process the search query using existing services
//                 console.log(`Processing query: "${trimmedMessage}" for session: ${sessionId}`);
//                 const searchResult = await processSearchQuery(trimmedMessage, sessionId);
//                 console.log('Search result:', {
//                     success: searchResult.success,
//                     source: searchResult.source,
//                     totalFound: searchResult.totalFound,
//                     aiAnswerLength: searchResult.aiAnswer ? searchResult.aiAnswer.length : 0,
//                     hasSourceDetails: !!searchResult.sourceDetails
//                 });

//                 // Stop typing indicator
//                 socket.to(sessionId).emit('typing', {
//                     isTyping: false,
//                     sender: 'assistant'
//                 });

//                 // Store AI response in Redis
//                 let aiMessage;
//                 try {
//                     aiMessage = await addMessageToRedis(sessionId, {
//                         type: 'assistant',
//                         content: searchResult.aiAnswer || 'No relevant information found.',
//                         sender: 'assistant',
//                         timestamp: new Date().toISOString(),
//                         metadata: {
//                             source: searchResult.source,
//                             searchStep: searchResult.searchStep,
//                             totalFound: searchResult.totalFound,
//                             sourceDetails: searchResult.sourceDetails,
//                             success: searchResult.success,
//                             aiError: searchResult.aiError
//                         }
//                     });
//                 } catch (redisError) {
//                     console.error('Redis error for AI message:', redisError);
//                     // Fallback to creating message object
//                     aiMessage = {
//                         id: uuidv4(),
//                         type: 'assistant',
//                         content: searchResult.aiAnswer || 'No relevant information found.',
//                         sender: 'assistant',
//                         timestamp: new Date().toISOString(),
//                         sessionId,
//                         metadata: {
//                             source: searchResult.source,
//                             searchStep: searchResult.searchStep,
//                             totalFound: searchResult.totalFound,
//                             sourceDetails: searchResult.sourceDetails,
//                             success: searchResult.success,
//                             aiError: searchResult.aiError
//                         }
//                     };
//                 }

//                 // Backup AI message to DB
//                 try {
//                     await saveMessageToDb(sessionId, aiMessage);
//                 } catch (dbError) {
//                     console.error('DB save error for AI message:', dbError);
//                 }

//                 // Broadcast AI response
//                 console.log('Broadcasting AI response to session:', sessionId);
//                 console.log('AI message preview:', {
//                     id: aiMessage.id,
//                     contentLength: aiMessage.content?.length || 0,
//                     hasMetadata: !!aiMessage.metadata
//                 });

//                 io.to(sessionId).emit('new_message', {
//                     ...aiMessage,
//                     success: true
//                 });

//                 console.log('Message broadcasting completed');

//             } catch (error) {
//                 console.error('Error processing message:', error);

//                 // Send error message to user
//                 const errorMessage = {
//                     id: Date.now().toString(),
//                     type: 'assistant',
//                     content: 'Sorry, I encountered an error while processing your message. Please try again.',
//                     sender: 'assistant',
//                     timestamp: new Date().toISOString(),
//                     error: true
//                 };

//                 io.to(sessionId).emit('new_message', errorMessage);

//                 socket.emit('message_error', {
//                     success: false,
//                     error: 'Failed to process message',
//                     message: error.message
//                 });
//             }
//         });

//         // Get history handler with pagination
//         socket.on('get_history', async (data) => {
//             try {
//                 const { sessionId, limit = 50, offset = 0 } = data || {};

//                 if (!isValidSessionId(sessionId)) {
//                     socket.emit('history_error', {
//                         success: false,
//                         error: 'Invalid session ID'
//                     });
//                     return;
//                 }

//                 const history = await getCombinedChatHistory(sessionId, limit, offset);

//                 socket.emit('session_history', {
//                     success: true,
//                     sessionId,
//                     history,
//                     count: history.length
//                 });
//             } catch (error) {
//                 console.error('Error getting history:', error);
//                 socket.emit('history_error', {
//                     success: false,
//                     error: 'Failed to get session history',
//                     message: error.message
//                 });
//             }
//         });

//         // Clear session handler
//         socket.on('clear_session', async (data) => {
//             try {
//                 const { sessionId } = data || {};

//                 if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
//                     socket.emit('clear_error', {
//                         success: false,
//                         error: 'Invalid session'
//                     });
//                     return;
//                 }

//                 // Clear Redis only, keep DB history
//                 try {
//                     await clearRedisSession(sessionId);
//                 } catch (clearError) {
//                     console.error('Error clearing Redis session:', clearError);
//                     // Continue even if Redis clear fails
//                 }

//                 io.to(sessionId).emit('session_cleared', {
//                     success: true,
//                     sessionId,
//                     message: 'Session cache cleared successfully',
//                     timestamp: new Date().toISOString()
//                 });

//                 console.log(`Session ${sessionId} cleared by user ${socket.id}`);
//             } catch (error) {
//                 console.error('Error clearing session:', error);
//                 socket.emit('clear_error', {
//                     success: false,
//                     error: 'Failed to clear session',
//                     message: error.message
//                 });
//             }
//         });

//         // Ping handler for connection health check
//         socket.on('ping', () => {
//             socket.emit('pong', {
//                 timestamp: new Date().toISOString(),
//                 serverTime: Date.now()
//             });
//         });

//         // Handle disconnect - backup to DB
//         socket.on('disconnect', async (reason) => {
//             console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

//             if (socket.sessionId) {
//                 try {
//                     await handleDisconnectionBackup(socket.sessionId);
//                 } catch (backupError) {
//                     console.error('Error during disconnect backup:', backupError);
//                 }
//             }
//         });

//         // Handle connection errors
//         socket.on('error', (error) => {
//             console.error(`Socket error for ${socket.id}:`, error);
//         });

//         // Handle Redis connection errors - backup to DB
//         socket.on('redis_error', async (data) => {
//             const { sessionId } = data || {};
//             if (isValidSessionId(sessionId)) {
//                 try {
//                     await handleDisconnectionBackup(sessionId);
//                 } catch (backupError) {
//                     console.error('Error during Redis error backup:', backupError);
//                 }
//             }
//         });
//     });

//     // Handle server-level errors
//     io.engine.on('connection_error', (err) => {
//         console.error('Socket.IO Engine Error:', {
//             req: err.req?.url,
//             code: err.code,
//             message: err.message,
//             context: err.context
//         });
//     });
// };

// module.exports = { setupSocketHandlers };

// socket/socketHandler.js
// const { v4: uuidv4 } = require('uuid');
// const { addMessageToRedis, getSessionHistory, clearRedisSession, getAllRedisSessionMessages } = require('../services/redisService');
// const { backupSessionToDb, getCombinedChatHistory, saveMessageToDb } = require('../services/chatDbService');

// // Import your existing services
// const { getJinaEmbeddings } = require('../services/jinaService');
// const { fetchNews } = require('../services/newsService');
// const { generateAnswerWithContext } = require('../services/geminiService');
// const prisma = require('../services/prismaService');
// const { searchQdrant } = require('../services/qdrantService.JS');

// // Retry function for Gemini API with exponential backoff
// const generateAnswerWithContextRetry = async (query, articles, maxRetries = 3) => {
//     const { generateAnswerWithContext } = require('../services/geminiService');

//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//         try {
//             return await generateAnswerWithContext(query, articles);
//         } catch (error) {
//             console.log(`Gemini API attempt ${attempt} failed:`, error.message);

//             // If it's a 503 (overloaded) or rate limit error, retry with exponential backoff
//             if ((error.status === 503 || error.status === 429 || error.message.includes('overloaded')) && attempt < maxRetries) {
//                 const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
//                 console.log(`Waiting ${delay}ms before retry ${attempt + 1}...`);
//                 await new Promise(resolve => setTimeout(resolve, delay));
//                 continue;
//             }

//             // If final attempt or non-retryable error, throw
//             throw error;
//         }
//     }
// };

// // Enhanced status update helper
// const emitStatusUpdate = (socket, sessionId, status, message, delay = 800) => {
//     return new Promise((resolve) => {
//         socket.to(sessionId).emit('status_update', {
//             status,
//             message,
//             timestamp: new Date().toISOString()
//         });
//         setTimeout(resolve, delay);
//     });
// };

// // Reuse your existing search function
// const searchInDatabase = async (searchTerm, limit = 5) => {
//     try {
//         const articles = await prisma.article.findMany({
//             where: {
//                 OR: [
//                     {
//                         title: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     },
//                     {
//                         description: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     },
//                     {
//                         content: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     }
//                 ]
//             },
//             orderBy: {
//                 published_at: 'desc'
//             },
//             take: limit
//         });

//         return articles;
//     } catch (error) {
//         console.error('Database search error:', error);
//         return [];
//     }
// };

// // Reuse your existing relevance scoring functions
// const calculateRelevanceScore = (article, query) => {
//     let score = 0;
//     const queryWords = query.toLowerCase().split(' ');

//     const titleMatches = queryWords.filter(word =>
//         article.title?.toLowerCase().includes(word)
//     ).length;
//     score += titleMatches * 3;

//     const descMatches = queryWords.filter(word =>
//         article.description?.toLowerCase().includes(word)
//     ).length;
//     score += descMatches * 2;

//     const contentMatches = queryWords.filter(word =>
//         article.content?.toLowerCase().includes(word)
//     ).length;
//     score += contentMatches * 1;

//     if (article.score) {
//         score += article.score * 10;
//     }

//     return score;
// };

// const selectMostRelevantArticle = (articles, query) => {
//     if (!articles || articles.length === 0) return null;
//     if (articles.length === 1) return articles[0];

//     const scoredArticles = articles.map(article => ({
//         ...article,
//         relevanceScore: calculateRelevanceScore(article, query)
//     }));

//     scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
//     return scoredArticles[0];
// };

// // Auto-backup Redis to DB when connection issues occur
// const handleDisconnectionBackup = async (sessionId) => {
//     try {
//         const messages = await getAllRedisSessionMessages(sessionId);
//         if (messages.length > 0) {
//             await backupSessionToDb(sessionId, messages);
//             console.log(`Backed up ${messages.length} messages for session ${sessionId}`);
//         }
//     } catch (error) {
//         console.error('Error during disconnection backup:', error);
//     }
// };

// // Enhanced process search with better status updates
// const processSearchQuery = async (query, sessionId, socket) => {
//     try {
//         let articles = [];
//         let source = '';
//         let searchStep = 0;

//         // STEP 1: Initialize search
//         await emitStatusUpdate(socket, sessionId, 'initializing', 'Initializing search and gathering relevant information...');

//         // STEP 2: Search in Database (reuse existing function)
//         await emitStatusUpdate(socket, sessionId, 'searching', 'Searching internal knowledge base...');

//         const dbResults = await searchInDatabase(query, 5);

//         if (dbResults && dbResults.length > 0) {
//             articles = dbResults;
//             source = 'database';
//             searchStep = 1;

//             await emitStatusUpdate(socket, sessionId, 'found', `Found ${dbResults.length} relevant articles in knowledge base...`, 500);
//         } else {
//             // STEP 3: Search in Qdrant (reuse existing service)
//             await emitStatusUpdate(socket, sessionId, 'analyzing', 'Analyzing query with semantic search...');

//             try {
//                 const queryEmbeddings = await getJinaEmbeddings([query]);

//                 if (queryEmbeddings && queryEmbeddings.length > 0) {
//                     const queryEmbedding = queryEmbeddings[0];
//                     const searchResults = await searchQdrant(queryEmbedding, 5);

//                     if (searchResults && searchResults.length > 0) {
//                         articles = searchResults.map(r => ({
//                             ...r.payload,
//                             score: r.score,
//                             similarity: `${Math.round(r.score * 100)}%`
//                         }));
//                         source = 'qdrant';
//                         searchStep = 2;

//                         await emitStatusUpdate(socket, sessionId, 'found', `Found ${searchResults.length} semantically similar articles...`, 500);
//                     }
//                 }
//             } catch (qdrantError) {
//                 console.error('Qdrant search error:', qdrantError);
//             }

//             // STEP 4: Fetch from News API if no results from Qdrant
//             if (articles.length === 0) {
//                 await emitStatusUpdate(socket, sessionId, 'fetching', 'Fetching latest articles from external sources...');

//                 try {
//                     const freshArticles = await fetchNews(query);

//                     if (freshArticles && freshArticles.length > 0) {
//                         articles = freshArticles;
//                         source = 'newsapi';
//                         searchStep = 3;

//                         await emitStatusUpdate(socket, sessionId, 'found', `Retrieved ${freshArticles.length} fresh articles...`, 500);
//                     }
//                 } catch (newsError) {
//                     console.error('News API error:', newsError);
//                 }
//             }
//         }

//         if (articles.length > 0) {
//             console.log('Articles found:', articles.length);
//             console.log('First article preview:', {
//                 title: articles[0].title,
//                 hasContent: !!articles[0].content,
//                 hasDescription: !!articles[0].description,
//                 source: articles[0].source_name || articles[0].source?.name
//             });

//             // Check if articles have actual content
//             const validArticles = articles.filter(article =>
//                 article.title || article.content || article.description
//             );

//             console.log(`Valid articles with content: ${validArticles.length} out of ${articles.length}`);

//             if (validArticles.length === 0) {
//                 console.log('No valid articles found, falling back to News API');
//                 await emitStatusUpdate(socket, sessionId, 'fetching', 'Fetching additional sources...');

//                 // Fall back to fresh news if Qdrant articles are empty
//                 try {
//                     const freshArticles = await fetchNews(query);
//                     if (freshArticles && freshArticles.length > 0) {
//                         articles = freshArticles;
//                         source = 'newsapi';
//                         searchStep = 3;
//                         console.log('Fetched fresh articles:', freshArticles.length);

//                         await emitStatusUpdate(socket, sessionId, 'found', `Retrieved ${freshArticles.length} additional articles...`, 500);
//                     }
//                 } catch (newsError) {
//                     console.error('News API fallback failed:', newsError);
//                 }
//             } else {
//                 articles = validArticles;
//             }

//             // Select most relevant article (reuse existing function)
//             await emitStatusUpdate(socket, sessionId, 'processing', 'Selecting most relevant information...');

//             const mostRelevantArticle = selectMostRelevantArticle(articles, query);
//             console.log('Most relevant article selected:', {
//                 title: mostRelevantArticle?.title,
//                 hasContent: !!mostRelevantArticle?.content,
//                 relevanceScore: mostRelevantArticle?.relevanceScore
//             });

//             // Generate AI response with retry logic
//             await emitStatusUpdate(socket, sessionId, 'generating', 'Generating comprehensive response...');

//             let aiResponse;
//             let aiError = null;
//             console.log('Attempting to generate AI response...');

//             // Check if we have valid article content
//             if (!mostRelevantArticle || (!mostRelevantArticle.title && !mostRelevantArticle.content && !mostRelevantArticle.description)) {
//                 console.log('No valid article content for AI generation');
//                 aiResponse = `I found some results for "${query}" but the articles don't contain readable content. This might be due to data indexing issues. Please try a more specific query or check back later.`;
//             } else {
//                 try {
//                     aiResponse = await generateAnswerWithContextRetry(query, [mostRelevantArticle]);
//                     console.log('AI response generated successfully, length:', aiResponse?.length || 0);

//                     // Check if AI response is actually meaningful
//                     if (!aiResponse || aiResponse.trim().length === 0) {
//                         console.log('AI returned empty response, using fallback');
//                         aiResponse = `I found information about "${query}" but couldn't generate a detailed response. Please check the source details below or try a different query.`;
//                     }
//                 } catch (aiErr) {
//                     console.error('AI generation failed after retries:', aiErr.message);
//                     aiError = aiErr;

//                     // Create a fallback response based on the article
//                     const article = mostRelevantArticle;
//                     aiResponse = `
// <b>${query}</b><br/><br/>
// ${article.source_name ? `From <i>${article.source_name}</i><br/><br/>` : ''}

// <p>${article.title || 'Article'}</p><br/>
// ${article.description || (article.content ? article.content.substring(0, 200) + '...' : 'Please check the full article for details.')}<br/><br/>

// ${article.author ? `Source: ${article.author}<br/>` : ''}
// ${article.published_at ? `Published: ${new Date(article.published_at).toLocaleString("en-IN", {
//                         dateStyle: "medium",
//                         timeStyle: "short",
//                         timeZone: "Asia/Kolkata",
//                     })}` : ''}
// `;
//                 }
//             }

//             // Final status update
//             await emitStatusUpdate(socket, sessionId, 'complete', 'Response ready!', 300);

//             return {
//                 success: true,
//                 source,
//                 searchStep,
//                 totalFound: articles.length,
//                 aiAnswer: aiResponse,
//                 aiError: aiError ? {
//                     type: aiError.status === 503 ? 'service_overloaded' : 'ai_generation_failed',
//                     message: aiError.status === 503 ? 'AI service temporarily overloaded' : 'AI generation failed',
//                     fallbackUsed: true
//                 } : null,
//                 sourceDetails: {
//                     title: mostRelevantArticle.title,
//                     author: mostRelevantArticle.author,
//                     source_name: mostRelevantArticle.source_name || mostRelevantArticle.source?.name,
//                     url: mostRelevantArticle.url,
//                     urlToImage: mostRelevantArticle.urlToImage,
//                     published_at: mostRelevantArticle.published_at || mostRelevantArticle.publishedAt,
//                     relevanceScore: mostRelevantArticle.relevanceScore?.toFixed(2)
//                 }
//             };
//         }

//         await emitStatusUpdate(socket, sessionId, 'complete', 'Search completed', 300);

//         return {
//             success: false,
//             source: 'none',
//             searchStep: 0,
//             totalFound: 0,
//             aiAnswer: 'No relevant information found for your query. Please try different keywords.',
//             sourceDetails: null
//         };

//     } catch (error) {
//         console.error('Error in processSearchQuery:', error);

//         await emitStatusUpdate(socket, sessionId, 'error', 'An error occurred during search', 300);

//         return {
//             success: false,
//             source: 'error',
//             searchStep: 0,
//             totalFound: 0,
//             aiAnswer: 'An error occurred while processing your query. Please try again.',
//             sourceDetails: null,
//             error: error.message
//         };
//     }
// };

// // Validate session ID
// const isValidSessionId = (sessionId) => {
//     return sessionId && typeof sessionId === 'string' && sessionId.length > 0;
// };

// // Main socket setup function with improved error handling
// const setupSocketHandlers = (io) => {
//     // Configure CORS and transport options
//     io.engine.on('connection_error', (err) => {
//         console.log('Socket.IO connection error:', err.req);
//         console.log('Error code:', err.code);
//         console.log('Error message:', err.message);
//         console.log('Error context:', err.context);
//     });

//     // Set engine options for better connection stability
//     io.engine.pingTimeout = 60000; // 60 seconds
//     io.engine.pingInterval = 25000; // 25 seconds

//     io.on('connection', (socket) => {
//         console.log(`User connected: ${socket.id}`);

//         // Set socket timeout
//         socket.timeout = 30000;

//         // Join session handler with improved validation
//         socket.on('join_session', async (data) => {
//             try {
//                 let { sessionId } = data || {};

//                 // Generate new session ID if not provided or invalid
//                 if (!isValidSessionId(sessionId)) {
//                     sessionId = uuidv4();
//                 }

//                 // Leave any existing rooms
//                 const rooms = Array.from(socket.rooms);
//                 rooms.forEach(room => {
//                     if (room !== socket.id) {
//                         socket.leave(room);
//                     }
//                 });

//                 // Join new session
//                 socket.join(sessionId);
//                 socket.sessionId = sessionId;

//                 // Get combined history (Redis + DB) with error handling
//                 let history = [];
//                 try {
//                     history = await getCombinedChatHistory(sessionId);
//                 } catch (historyError) {
//                     console.error('Error fetching history:', historyError);
//                     // Continue with empty history
//                 }

//                 socket.emit('session_joined', {
//                     success: true,
//                     sessionId,
//                     history,
//                     message: `Successfully joined session: ${sessionId}`,
//                     timestamp: new Date().toISOString()
//                 });

//                 console.log(`User ${socket.id} joined session: ${sessionId}`);
//             } catch (error) {
//                 console.error('Error joining session:', error);
//                 socket.emit('session_joined', {
//                     success: false,
//                     error: 'Failed to join session',
//                     message: error.message
//                 });
//             }
//         });

//         // Enhanced message handler to prevent duplicates
//         socket.on('send_message', async (data) => {
//             try {
//                 const { message, sessionId } = data || {};

//                 // Validate inputs
//                 if (!message || typeof message !== 'string' || message.trim().length === 0) {
//                     socket.emit('message_error', {
//                         success: false,
//                         error: 'Message cannot be empty'
//                     });
//                     return;
//                 }

//                 if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
//                     socket.emit('message_error', {
//                         success: false,
//                         error: 'No valid session found. Please join a session first.'
//                     });
//                     return;
//                 }

//                 const trimmedMessage = message.trim();

//                 // Store user message in Redis with error handling
//                 let userMessage;
//                 try {
//                     userMessage = await addMessageToRedis(sessionId, {
//                         type: 'user',
//                         content: trimmedMessage,
//                         sender: 'user',
//                         timestamp: new Date().toISOString()
//                     });
//                 } catch (redisError) {
//                     console.error('Redis error, storing directly to DB:', redisError);
//                     // Fallback to DB only
//                     userMessage = {
//                         id: uuidv4(),
//                         type: 'user',
//                         content: trimmedMessage,
//                         sender: 'user',
//                         timestamp: new Date().toISOString(),
//                         sessionId
//                     };
//                 }

//                 // Backup to DB
//                 try {
//                     await saveMessageToDb(sessionId, userMessage);
//                 } catch (dbError) {
//                     console.error('DB save error for user message:', dbError);
//                     // Continue processing even if DB save fails
//                 }

//                 // Broadcast user message ONLY to other clients in the session, not back to sender
//                 socket.to(sessionId).emit('new_message', {
//                     ...userMessage,
//                     success: true
//                 });

//                 // Emit to sender with different event to prevent duplicate display
//                 socket.emit('message_sent', {
//                     ...userMessage,
//                     success: true
//                 });

//                 // Process the search query with enhanced status updates
//                 console.log(`Processing query: "${trimmedMessage}" for session: ${sessionId}`);
//                 const searchResult = await processSearchQuery(trimmedMessage, sessionId, socket);
//                 console.log('Search result:', {
//                     success: searchResult.success,
//                     source: searchResult.source,
//                     totalFound: searchResult.totalFound,
//                     aiAnswerLength: searchResult.aiAnswer ? searchResult.aiAnswer.length : 0,
//                     hasSourceDetails: !!searchResult.sourceDetails
//                 });

//                 // Store AI response in Redis
//                 let aiMessage;
//                 try {
//                     aiMessage = await addMessageToRedis(sessionId, {
//                         type: 'assistant',
//                         content: searchResult.aiAnswer || 'No relevant information found.',
//                         sender: 'assistant',
//                         timestamp: new Date().toISOString(),
//                         metadata: {
//                             source: searchResult.source,
//                             searchStep: searchResult.searchStep,
//                             totalFound: searchResult.totalFound,
//                             sourceDetails: searchResult.sourceDetails,
//                             success: searchResult.success,
//                             aiError: searchResult.aiError
//                         }
//                     });
//                 } catch (redisError) {
//                     console.error('Redis error for AI message:', redisError);
//                     // Fallback to creating message object
//                     aiMessage = {
//                         id: uuidv4(),
//                         type: 'assistant',
//                         content: searchResult.aiAnswer || 'No relevant information found.',
//                         sender: 'assistant',
//                         timestamp: new Date().toISOString(),
//                         sessionId,
//                         metadata: {
//                             source: searchResult.source,
//                             searchStep: searchResult.searchStep,
//                             totalFound: searchResult.totalFound,
//                             sourceDetails: searchResult.sourceDetails,
//                             success: searchResult.success,
//                             aiError: searchResult.aiError
//                         }
//                     };
//                 }

//                 // Backup AI message to DB
//                 try {
//                     await saveMessageToDb(sessionId, aiMessage);
//                 } catch (dbError) {
//                     console.error('DB save error for AI message:', dbError);
//                 }

//                 // Broadcast AI response to ALL clients in the session
//                 console.log('Broadcasting AI response to session:', sessionId);
//                 console.log('AI message preview:', {
//                     id: aiMessage.id,
//                     contentLength: aiMessage.content?.length || 0,
//                     hasMetadata: !!aiMessage.metadata
//                 });

//                 io.to(sessionId).emit('new_message', {
//                     ...aiMessage,
//                     success: true
//                 });

//                 console.log('Message broadcasting completed');

//             } catch (error) {
//                 console.error('Error processing message:', error);

//                 // Send error message to user
//                 const errorMessage = {
//                     id: Date.now().toString(),
//                     type: 'assistant',
//                     content: 'Sorry, I encountered an error while processing your message. Please try again.',
//                     sender: 'assistant',
//                     timestamp: new Date().toISOString(),
//                     error: true
//                 };

//                 io.to(sessionId).emit('new_message', errorMessage);

//                 socket.emit('message_error', {
//                     success: false,
//                     error: 'Failed to process message',
//                     message: error.message
//                 });
//             }
//         });

//         // Get history handler with pagination
//         socket.on('get_history', async (data) => {
//             try {
//                 const { sessionId, limit = 50, offset = 0 } = data || {};

//                 if (!isValidSessionId(sessionId)) {
//                     socket.emit('history_error', {
//                         success: false,
//                         error: 'Invalid session ID'
//                     });
//                     return;
//                 }

//                 const history = await getCombinedChatHistory(sessionId, limit, offset);

//                 socket.emit('session_history', {
//                     success: true,
//                     sessionId,
//                     history,
//                     count: history.length
//                 });
//             } catch (error) {
//                 console.error('Error getting history:', error);
//                 socket.emit('history_error', {
//                     success: false,
//                     error: 'Failed to get session history',
//                     message: error.message
//                 });
//             }
//         });

//         // Clear session handler
//         socket.on('clear_session', async (data) => {
//             try {
//                 const { sessionId } = data || {};

//                 if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
//                     socket.emit('clear_error', {
//                         success: false,
//                         error: 'Invalid session'
//                     });
//                     return;
//                 }

//                 // Clear Redis only, keep DB history
//                 try {
//                     await clearRedisSession(sessionId);
//                 } catch (clearError) {
//                     console.error('Error clearing Redis session:', clearError);
//                     // Continue even if Redis clear fails
//                 }

//                 io.to(sessionId).emit('session_cleared', {
//                     success: true,
//                     sessionId,
//                     message: 'Session cache cleared successfully',
//                     timestamp: new Date().toISOString()
//                 });

//                 console.log(`Session ${sessionId} cleared by user ${socket.id}`);
//             } catch (error) {
//                 console.error('Error clearing session:', error);
//                 socket.emit('clear_error', {
//                     success: false,
//                     error: 'Failed to clear session',
//                     message: error.message
//                 });
//             }
//         });

//         // Ping handler for connection health check
//         socket.on('ping', () => {
//             socket.emit('pong', {
//                 timestamp: new Date().toISOString(),
//                 serverTime: Date.now()
//             });
//         });

//         // Handle disconnect - backup to DB
//         socket.on('disconnect', async (reason) => {
//             console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

//             if (socket.sessionId) {
//                 try {
//                     await handleDisconnectionBackup(socket.sessionId);
//                 } catch (backupError) {
//                     console.error('Error during disconnect backup:', backupError);
//                 }
//             }
//         });

//         // Handle connection errors
//         socket.on('error', (error) => {
//             console.error(`Socket error for ${socket.id}:`, error);
//         });

//         // Handle Redis connection errors - backup to DB
//         socket.on('redis_error', async (data) => {
//             const { sessionId } = data || {};
//             if (isValidSessionId(sessionId)) {
//                 try {
//                     await handleDisconnectionBackup(sessionId);
//                 } catch (backupError) {
//                     console.error('Error during Redis error backup:', backupError);
//                 }
//             }
//         });
//     });

//     // Handle server-level errors
//     io.engine.on('connection_error', (err) => {
//         console.error('Socket.IO Engine Error:', {
//             req: err.req?.url,
//             code: err.code,
//             message: err.message,
//             context: err.context
//         });
//     });
// };

// module.exports = { setupSocketHandlers };

// socket/socketHandler.js - FIXED VERSION

// const { v4: uuidv4 } = require('uuid');
// const { addMessageToRedis, getSessionHistory, clearRedisSession, getAllRedisSessionMessages } = require('../services/redisService');
// const { backupSessionToDb, getCombinedChatHistory, saveMessageToDb } = require('../services/chatDbService');

// // Import your existing services
// const { getJinaEmbeddings } = require('../services/jinaService');
// const { fetchNews } = require('../services/newsService');
// const { generateAnswerWithContext } = require('../services/geminiService');
// const prisma = require('../services/prismaService');
// const { searchQdrant } = require('../services/qdrantService.JS');

// // Retry function for Gemini API with exponential backoff
// const generateAnswerWithContextRetry = async (query, articles, maxRetries = 3) => {
//     const { generateAnswerWithContext } = require('../services/geminiService');

//     for (let attempt = 1; attempt <= maxRetries; attempt++) {
//         try {
//             return await generateAnswerWithContext(query, articles);
//         } catch (error) {
//             console.log(`Gemini API attempt ${attempt} failed:`, error.message);

//             if ((error.status === 503 || error.status === 429 || error.message.includes('overloaded')) && attempt < maxRetries) {
//                 const delay = Math.pow(2, attempt) * 1000;
//                 console.log(`Waiting ${delay}ms before retry ${attempt + 1}...`);
//                 await new Promise(resolve => setTimeout(resolve, delay));
//                 continue;
//             }

//             throw error;
//         }
//     }
// };

// // Enhanced status update helper
// const emitStatusUpdate = (socket, sessionId, status, message, delay = 800) => {
//     return new Promise((resolve) => {
//         socket.to(sessionId).emit('status_update', {
//             status,
//             message,
//             timestamp: new Date().toISOString()
//         });
//         setTimeout(resolve, delay);
//     });
// };

// // Search functions (keeping your existing logic)
// const searchInDatabase = async (searchTerm, limit = 5) => {
//     try {
//         const articles = await prisma.article.findMany({
//             where: {
//                 OR: [
//                     {
//                         title: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     },
//                     {
//                         description: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     },
//                     {
//                         content: {
//                             contains: searchTerm,
//                             mode: 'insensitive'
//                         }
//                     }
//                 ]
//             },
//             orderBy: {
//                 published_at: 'desc'
//             },
//             take: limit
//         });

//         return articles;
//     } catch (error) {
//         console.error('Database search error:', error);
//         return [];
//     }
// };

// const calculateRelevanceScore = (article, query) => {
//     let score = 0;
//     const queryWords = query.toLowerCase().split(' ');

//     const titleMatches = queryWords.filter(word =>
//         article.title?.toLowerCase().includes(word)
//     ).length;
//     score += titleMatches * 3;

//     const descMatches = queryWords.filter(word =>
//         article.description?.toLowerCase().includes(word)
//     ).length;
//     score += descMatches * 2;

//     const contentMatches = queryWords.filter(word =>
//         article.content?.toLowerCase().includes(word)
//     ).length;
//     score += contentMatches * 1;

//     if (article.score) {
//         score += article.score * 10;
//     }

//     return score;
// };

// const selectMostRelevantArticle = (articles, query) => {
//     if (!articles || articles.length === 0) return null;
//     if (articles.length === 1) return articles[0];

//     const scoredArticles = articles.map(article => ({
//         ...article,
//         relevanceScore: calculateRelevanceScore(article, query)
//     }));

//     scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
//     return scoredArticles[0];
// };

// const handleDisconnectionBackup = async (sessionId) => {
//     try {
//         const messages = await getAllRedisSessionMessages(sessionId);
//         if (messages.length > 0) {
//             await backupSessionToDb(sessionId, messages);
//             console.log(`Backed up ${messages.length} messages for session ${sessionId}`);
//         }
//     } catch (error) {
//         console.error('Error during disconnection backup:', error);
//     }
// };

// const processSearchQuery = async (query, sessionId, socket) => {
//     try {
//         let articles = [];
//         let source = '';
//         let searchStep = 0;

//         await emitStatusUpdate(socket, sessionId, 'initializing', 'Initializing search and gathering relevant information...');

//         const dbResults = await searchInDatabase(query, 5);

//         if (dbResults && dbResults.length > 0) {
//             articles = dbResults;
//             source = 'database';
//             searchStep = 1;
//             await emitStatusUpdate(socket, sessionId, 'found', `Found ${dbResults.length} relevant articles in knowledge base...`, 500);
//         } else {
//             await emitStatusUpdate(socket, sessionId, 'analyzing', 'Analyzing query with semantic search...');

//             try {
//                 const queryEmbeddings = await getJinaEmbeddings([query]);

//                 if (queryEmbeddings && queryEmbeddings.length > 0) {
//                     const queryEmbedding = queryEmbeddings[0];
//                     const searchResults = await searchQdrant(queryEmbedding, 5);

//                     if (searchResults && searchResults.length > 0) {
//                         articles = searchResults.map(r => ({
//                             ...r.payload,
//                             score: r.score,
//                             similarity: `${Math.round(r.score * 100)}%`
//                         }));
//                         source = 'qdrant';
//                         searchStep = 2;
//                         await emitStatusUpdate(socket, sessionId, 'found', `Found ${searchResults.length} semantically similar articles...`, 500);
//                     }
//                 }
//             } catch (qdrantError) {
//                 console.error('Qdrant search error:', qdrantError);
//             }

//             if (articles.length === 0) {
//                 await emitStatusUpdate(socket, sessionId, 'fetching', 'Fetching latest articles from external sources...');

//                 try {
//                     const { fetchNews } = require('../services/newsService');
//                     const freshArticles = await fetchNews(query);

//                     if (freshArticles && freshArticles.length > 0) {
//                         articles = freshArticles;
//                         source = 'newsapi';
//                         searchStep = 3;
//                         await emitStatusUpdate(socket, sessionId, 'found', `Retrieved ${freshArticles.length} fresh articles...`, 500);
//                     }
//                 } catch (newsError) {
//                     console.error('News API error:', newsError);
//                 }
//             }
//         }

//         if (articles.length > 0) {
//             const validArticles = articles.filter(article =>
//                 article.title || article.content || article.description
//             );

//             if (validArticles.length === 0) {
//                 await emitStatusUpdate(socket, sessionId, 'fetching', 'Fetching additional sources...');
//                 try {
//                     const { fetchNews } = require('../services/newsService');
//                     const freshArticles = await fetchNews(query);
//                     if (freshArticles && freshArticles.length > 0) {
//                         articles = freshArticles;
//                         source = 'newsapi';
//                         searchStep = 3;
//                         await emitStatusUpdate(socket, sessionId, 'found', `Retrieved ${freshArticles.length} additional articles...`, 500);
//                     }
//                 } catch (newsError) {
//                     console.error('News API fallback failed:', newsError);
//                 }
//             } else {
//                 articles = validArticles;
//             }

//             await emitStatusUpdate(socket, sessionId, 'processing', 'Selecting most relevant information...');
//             const mostRelevantArticle = selectMostRelevantArticle(articles, query);

//             await emitStatusUpdate(socket, sessionId, 'generating', 'Generating comprehensive response...');

//             let aiResponse;
//             let aiError = null;

//             if (!mostRelevantArticle || (!mostRelevantArticle.title && !mostRelevantArticle.content && !mostRelevantArticle.description)) {
//                 aiResponse = `I found some results for "${query}" but the articles don't contain readable content. This might be due to data indexing issues. Please try a more specific query or check back later.`;
//             } else {
//                 try {
//                     aiResponse = await generateAnswerWithContextRetry(query, [mostRelevantArticle]);

//                     if (!aiResponse || aiResponse.trim().length === 0) {
//                         aiResponse = `I found information about "${query}" but couldn't generate a detailed response. Please check the source details below or try a different query.`;
//                     }
//                 } catch (aiErr) {
//                     console.error('AI generation failed after retries:', aiErr.message);
//                     aiError = aiErr;

//                     const article = mostRelevantArticle;
//                     aiResponse = `
// <b>${query}</b><br/><br/>
// ${article.source_name ? `From <i>${article.source_name}</i><br/><br/>` : ''}

// <p>${article.title || 'Article'}</p><br/>
// ${article.description || (article.content ? article.content.substring(0, 200) + '...' : 'Please check the full article for details.')}<br/><br/>

// ${article.author ? `Source: ${article.author}<br/>` : ''}
// ${article.published_at ? `Published: ${new Date(article.published_at).toLocaleString("en-IN", {
//                         dateStyle: "medium",
//                         timeStyle: "short",
//                         timeZone: "Asia/Kolkata",
//                     })}` : ''}
// `;
//                 }
//             }

//             await emitStatusUpdate(socket, sessionId, 'complete', 'Response ready!', 300);

//             return {
//                 success: true,
//                 source,
//                 searchStep,
//                 totalFound: articles.length,
//                 aiAnswer: aiResponse,
//                 aiError: aiError ? {
//                     type: aiError.status === 503 ? 'service_overloaded' : 'ai_generation_failed',
//                     message: aiError.status === 503 ? 'AI service temporarily overloaded' : 'AI generation failed',
//                     fallbackUsed: true
//                 } : null,
//                 sourceDetails: {
//                     title: mostRelevantArticle.title,
//                     author: mostRelevantArticle.author,
//                     source_name: mostRelevantArticle.source_name || mostRelevantArticle.source?.name,
//                     url: mostRelevantArticle.url,
//                     urlToImage: mostRelevantArticle.urlToImage,
//                     published_at: mostRelevantArticle.published_at || mostRelevantArticle.publishedAt,
//                     relevanceScore: mostRelevantArticle.relevanceScore?.toFixed(2)
//                 }
//             };
//         }

//         await emitStatusUpdate(socket, sessionId, 'complete', 'Search completed', 300);

//         return {
//             success: false,
//             source: 'none',
//             searchStep: 0,
//             totalFound: 0,
//             aiAnswer: 'No relevant information found for your query. Please try different keywords.',
//             sourceDetails: null
//         };

//     } catch (error) {
//         console.error('Error in processSearchQuery:', error);
//         await emitStatusUpdate(socket, sessionId, 'error', 'An error occurred during search', 300);

//         return {
//             success: false,
//             source: 'error',
//             searchStep: 0,
//             totalFound: 0,
//             aiAnswer: 'An error occurred while processing your query. Please try again.',
//             sourceDetails: null,
//             error: error.message
//         };
//     }
// };

// const isValidSessionId = (sessionId) => {
//     return sessionId && typeof sessionId === 'string' && sessionId.length > 0;
// };

// // MAIN FIX: Prevent message duplication
// const setupSocketHandlers = (io) => {
//     io.engine.on('connection_error', (err) => {
//         console.log('Socket.IO connection error:', err.req);
//         console.log('Error code:', err.code);
//         console.log('Error message:', err.message);
//         console.log('Error context:', err.context);
//     });

//     io.engine.pingTimeout = 60000;
//     io.engine.pingInterval = 25000;

//     io.on('connection', (socket) => {
//         console.log(`User connected: ${socket.id}`);
//         socket.timeout = 30000;

//         socket.on('join_session', async (data) => {
//             try {
//                 let { sessionId } = data || {};

//                 if (!isValidSessionId(sessionId)) {
//                     sessionId = uuidv4();
//                 }

//                 const rooms = Array.from(socket.rooms);
//                 rooms.forEach(room => {
//                     if (room !== socket.id) {
//                         socket.leave(room);
//                     }
//                 });

//                 socket.join(sessionId);
//                 socket.sessionId = sessionId;

//                 let history = [];
//                 try {
//                     history = await getCombinedChatHistory(sessionId);
//                 } catch (historyError) {
//                     console.error('Error fetching history:', historyError);
//                 }

//                 socket.emit('session_joined', {
//                     success: true,
//                     sessionId,
//                     history,
//                     message: `Successfully joined session: ${sessionId}`,
//                     timestamp: new Date().toISOString()
//                 });

//                 console.log(`User ${socket.id} joined session: ${sessionId}`);
//             } catch (error) {
//                 console.error('Error joining session:', error);
//                 socket.emit('session_joined', {
//                     success: false,
//                     error: 'Failed to join session',
//                     message: error.message
//                 });
//             }
//         });

//         // FIXED: Enhanced message handler to prevent duplicates
//         socket.on('send_message', async (data) => {
//             try {
//                 const { message, sessionId } = data || {};

//                 if (!message || typeof message !== 'string' || message.trim().length === 0) {
//                     socket.emit('message_error', {
//                         success: false,
//                         error: 'Message cannot be empty'
//                     });
//                     return;
//                 }

//                 if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
//                     socket.emit('message_error', {
//                         success: false,
//                         error: 'No valid session found. Please join a session first.'
//                     });
//                     return;
//                 }

//                 const trimmedMessage = message.trim();

//                 // Generate unique message ID to prevent duplicates
//                 const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//                 // FIXED: Store user message ONCE with unique ID
//                 let userMessage;
//                 try {
//                     userMessage = await addMessageToRedis(sessionId, {
//                         id: messageId, // Use our unique ID
//                         type: 'user',
//                         content: trimmedMessage,
//                         sender: 'user',
//                         timestamp: new Date().toISOString()
//                     });
//                 } catch (redisError) {
//                     console.error('Redis error, using fallback:', redisError);
//                     userMessage = {
//                         id: messageId,
//                         type: 'user',
//                         content: trimmedMessage,
//                         sender: 'user',
//                         timestamp: new Date().toISOString(),
//                         sessionId
//                     };
//                 }

//                 // FIXED: Save to DB only once with the same ID
//                 try {
//                     await saveMessageToDb(sessionId, userMessage);
//                 } catch (dbError) {
//                     console.error('DB save error for user message:', dbError);
//                 }

//                 // FIXED: Broadcast user message to ALL clients in session (including sender)
//                 // This ensures everyone sees the same message once
//                 io.to(sessionId).emit('new_message', {
//                     ...userMessage,
//                     success: true
//                 });

//                 console.log(`Processing query: "${trimmedMessage}" for session: ${sessionId}`);
//                 const searchResult = await processSearchQuery(trimmedMessage, sessionId, socket);

//                 // Generate unique ID for AI message
//                 const aiMessageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

//                 let aiMessage;
//                 try {
//                     aiMessage = await addMessageToRedis(sessionId, {
//                         id: aiMessageId, // Use unique ID
//                         type: 'assistant',
//                         content: searchResult.aiAnswer || 'No relevant information found.',
//                         sender: 'assistant',
//                         timestamp: new Date().toISOString(),
//                         metadata: {
//                             source: searchResult.source,
//                             searchStep: searchResult.searchStep,
//                             totalFound: searchResult.totalFound,
//                             sourceDetails: searchResult.sourceDetails,
//                             success: searchResult.success,
//                             aiError: searchResult.aiError
//                         }
//                     });
//                 } catch (redisError) {
//                     console.error('Redis error for AI message:', redisError);
//                     aiMessage = {
//                         id: aiMessageId,
//                         type: 'assistant',
//                         content: searchResult.aiAnswer || 'No relevant information found.',
//                         sender: 'assistant',
//                         timestamp: new Date().toISOString(),
//                         sessionId,
//                         metadata: {
//                             source: searchResult.source,
//                             searchStep: searchResult.searchStep,
//                             totalFound: searchResult.totalFound,
//                             sourceDetails: searchResult.sourceDetails,
//                             success: searchResult.success,
//                             aiError: searchResult.aiError
//                         }
//                     };
//                 }

//                 try {
//                     await saveMessageToDb(sessionId, aiMessage);
//                 } catch (dbError) {
//                     console.error('DB save error for AI message:', dbError);
//                 }

//                 // Broadcast AI response to ALL clients in session
//                 io.to(sessionId).emit('new_message', {
//                     ...aiMessage,
//                     success: true
//                 });

//                 console.log('Message broadcasting completed');

//             } catch (error) {
//                 console.error('Error processing message:', error);

//                 const errorMessage = {
//                     id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
//                     type: 'assistant',
//                     content: 'Sorry, I encountered an error while processing your message. Please try again.',
//                     sender: 'assistant',
//                     timestamp: new Date().toISOString(),
//                     error: true
//                 };

//                 io.to(sessionId).emit('new_message', errorMessage);

//                 socket.emit('message_error', {
//                     success: false,
//                     error: 'Failed to process message',
//                     message: error.message
//                 });
//             }
//         });

//         // Rest of your socket handlers...
//         socket.on('get_history', async (data) => {
//             try {
//                 const { sessionId, limit = 50, offset = 0 } = data || {};

//                 if (!isValidSessionId(sessionId)) {
//                     socket.emit('history_error', {
//                         success: false,
//                         error: 'Invalid session ID'
//                     });
//                     return;
//                 }

//                 const history = await getCombinedChatHistory(sessionId, limit, offset);

//                 socket.emit('session_history', {
//                     success: true,
//                     sessionId,
//                     history,
//                     count: history.length
//                 });
//             } catch (error) {
//                 console.error('Error getting history:', error);
//                 socket.emit('history_error', {
//                     success: false,
//                     error: 'Failed to get session history',
//                     message: error.message
//                 });
//             }
//         });

//         socket.on('clear_session', async (data) => {
//             try {
//                 const { sessionId } = data || {};

//                 if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
//                     socket.emit('clear_error', {
//                         success: false,
//                         error: 'Invalid session'
//                     });
//                     return;
//                 }

//                 try {
//                     await clearRedisSession(sessionId);
//                 } catch (clearError) {
//                     console.error('Error clearing Redis session:', clearError);
//                 }

//                 io.to(sessionId).emit('session_cleared', {
//                     success: true,
//                     sessionId,
//                     message: 'Session cache cleared successfully',
//                     timestamp: new Date().toISOString()
//                 });

//                 console.log(`Session ${sessionId} cleared by user ${socket.id}`);
//             } catch (error) {
//                 console.error('Error clearing session:', error);
//                 socket.emit('clear_error', {
//                     success: false,
//                     error: 'Failed to clear session',
//                     message: error.message
//                 });
//             }
//         });

//         socket.on('ping', () => {
//             socket.emit('pong', {
//                 timestamp: new Date().toISOString(),
//                 serverTime: Date.now()
//             });
//         });

//         socket.on('disconnect', async (reason) => {
//             console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

//             if (socket.sessionId) {
//                 try {
//                     await handleDisconnectionBackup(socket.sessionId);
//                 } catch (backupError) {
//                     console.error('Error during disconnect backup:', backupError);
//                 }
//             }
//         });

//         socket.on('error', (error) => {
//             console.error(`Socket error for ${socket.id}:`, error);
//         });

//         socket.on('redis_error', async (data) => {
//             const { sessionId } = data || {};
//             if (isValidSessionId(sessionId)) {
//                 try {
//                     await handleDisconnectionBackup(sessionId);
//                 } catch (backupError) {
//                     console.error('Error during Redis error backup:', backupError);
//                 }
//             }
//         });
//     });

//     io.engine.on('connection_error', (err) => {
//         console.error('Socket.IO Engine Error:', {
//             req: err.req?.url,
//             code: err.code,
//             message: err.message,
//             context: err.context
//         });
//     });
// };

// module.exports = { setupSocketHandlers };

// socket/socketHandler.js - FIXED VERSION
const { v4: uuidv4 } = require('uuid');
const { addMessageToRedis, getSessionHistory, clearRedisSession, getAllRedisSessionMessages } = require('../services/redisService');
const { backupSessionToDb, getCombinedChatHistory, saveMessageToDb } = require('../services/chatDbService');

// Import your existing services
const { getJinaEmbeddings } = require('../services/jinaService');
const { fetchNews } = require('../services/newsService');
const { generateAnswerWithContext } = require('../services/geminiService');
const prisma = require('../services/prismaService');
const { searchQdrant } = require('../services/qdrantService.JS');

// Retry function for Gemini API with exponential backoff
const generateAnswerWithContextRetry = async (query, articles, maxRetries = 3) => {
    const { generateAnswerWithContext } = require('../services/geminiService');

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await generateAnswerWithContext(query, articles);
        } catch (error) {
            console.log(`Gemini API attempt ${attempt} failed:`, error.message);

            if ((error.status === 503 || error.status === 429 || error.message.includes('overloaded')) && attempt < maxRetries) {
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`Waiting ${delay}ms before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            throw error;
        }
    }
};

// Enhanced status update helper
const emitStatusUpdate = (socket, sessionId, status, message="Searching for relevant information", delay = 800) => {
    return new Promise((resolve) => {
        socket.to(sessionId).emit('status_update', {
            status,
            messag,
            timestamp: new Date().toISOString()
        });
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
                            mode: 'insensitive'
                        }
                    },
                    {
                        description: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        content: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    }
                ]
            },
            orderBy: {
                published_at: 'desc'
            },
            take: limit
        });

        return articles;
    } catch (error) {
        console.error('Database search error:', error);
        return [];
    }
};

const calculateRelevanceScore = (article, query) => {
    let score = 0;
    const queryWords = query.toLowerCase().split(' ');

    const titleMatches = queryWords.filter(word =>
        article.title?.toLowerCase().includes(word)
    ).length;
    score += titleMatches * 3;

    const descMatches = queryWords.filter(word =>
        article.description?.toLowerCase().includes(word)
    ).length;
    score += descMatches * 2;

    const contentMatches = queryWords.filter(word =>
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

    const scoredArticles = articles.map(article => ({
        ...article,
        relevanceScore: calculateRelevanceScore(article, query)
    }));

    scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scoredArticles[0];
};

const handleDisconnectionBackup = async (sessionId) => {
    try {
        const messages = await getAllRedisSessionMessages(sessionId);
        if (messages.length > 0) {
            await backupSessionToDb(sessionId, messages);
            console.log(`Backed up ${messages.length} messages for session ${sessionId}`);
        }
    } catch (error) {
        console.error('Error during disconnection backup:', error);
    }
};

const processSearchQuery = async (query, sessionId, socket) => {
    try {
        let articles = [];
        let source = '';
        let searchStep = 0;

        await emitStatusUpdate(socket, sessionId, 'initializing', 'Initializing search and gathering relevant information...');

        const dbResults = await searchInDatabase(query, 5);

        if (dbResults && dbResults.length > 0) {
            articles = dbResults;
            source = 'database';
            searchStep = 1;
            await emitStatusUpdate(socket, sessionId, 'found', `Found ${dbResults.length} relevant articles in knowledge base...`, 500);
        } else {
            await emitStatusUpdate(socket, sessionId, 'analyzing', 'Analyzing query with semantic search...');

            try {
                const queryEmbeddings = await getJinaEmbeddings([query]);

                if (queryEmbeddings && queryEmbeddings.length > 0) {
                    const queryEmbedding = queryEmbeddings[0];
                    const searchResults = await searchQdrant(queryEmbedding, 5);

                    if (searchResults && searchResults.length > 0) {
                        articles = searchResults.map(r => ({
                            ...r.payload,
                            score: r.score,
                            similarity: `${Math.round(r.score * 100)}%`
                        }));
                        source = 'qdrant';
                        searchStep = 2;
                        await emitStatusUpdate(socket, sessionId, 'found', `Found ${searchResults.length} semantically similar articles...`, 500);
                    }
                }
            } catch (qdrantError) {
                console.error('Qdrant search error:', qdrantError);
            }

            if (articles.length === 0) {
                await emitStatusUpdate(socket, sessionId, 'fetching', 'Fetching latest articles from external sources...');

                try {
                    const { fetchNews } = require('../services/newsService');
                    const freshArticles = await fetchNews(query);

                    if (freshArticles && freshArticles.length > 0) {
                        articles = freshArticles;
                        source = 'newsapi';
                        searchStep = 3;
                        await emitStatusUpdate(socket, sessionId, 'found', `Retrieved ${freshArticles.length} fresh articles...`, 500);
                    }
                } catch (newsError) {
                    console.error('News API error:', newsError);
                }
            }
        }

        if (articles.length > 0) {
            const validArticles = articles.filter(article =>
                article.title || article.content || article.description
            );

            if (validArticles.length === 0) {
                await emitStatusUpdate(socket, sessionId, 'fetching', 'Fetching additional sources...');
                try {
                    const { fetchNews } = require('../services/newsService');
                    const freshArticles = await fetchNews(query);
                    if (freshArticles && freshArticles.length > 0) {
                        articles = freshArticles;
                        source = 'newsapi';
                        searchStep = 3;
                        await emitStatusUpdate(socket, sessionId, 'found', `Retrieved ${freshArticles.length} additional articles...`, 500);
                    }
                } catch (newsError) {
                    console.error('News API fallback failed:', newsError);
                }
            } else {
                articles = validArticles;
            }

            await emitStatusUpdate(socket, sessionId, 'processing', 'Selecting most relevant information...');
            const mostRelevantArticle = selectMostRelevantArticle(articles, query);

            await emitStatusUpdate(socket, sessionId, 'generating', 'Generating comprehensive response...');

            let aiResponse;
            let aiError = null;

            if (!mostRelevantArticle || (!mostRelevantArticle.title && !mostRelevantArticle.content && !mostRelevantArticle.description)) {
                aiResponse = `I found some results for "${query}" but the articles don't contain readable content. This might be due to data indexing issues. Please try a more specific query or check back later.`;
            } else {
                try {
                    aiResponse = await generateAnswerWithContextRetry(query, [mostRelevantArticle]);

                    if (!aiResponse || aiResponse.trim().length === 0) {
                        aiResponse = `I found information about "${query}" but couldn't generate a detailed response. Please check the source details below or try a different query.`;
                    }
                } catch (aiErr) {
                    console.error('AI generation failed after retries:', aiErr.message);
                    aiError = aiErr;

                    const article = mostRelevantArticle;
                    aiResponse = `
<b>${query}</b><br/><br/>
${article.source_name ? `From <i>${article.source_name}</i><br/><br/>` : ''}

<p>${article.title || 'Article'}</p><br/>
${article.description || (article.content ? article.content.substring(0, 200) + '...' : 'Please check the full article for details.')}<br/><br/>

${article.author ? `Source: ${article.author}<br/>` : ''}
${article.published_at ? `Published: ${new Date(article.published_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Kolkata",
                    })}` : ''}
`;
                }
            }

            await emitStatusUpdate(socket, sessionId, 'complete', 'Response ready!', 300);

            return {
                success: true,
                source,
                searchStep,
                totalFound: articles.length,
                aiAnswer: aiResponse,
                aiError: aiError ? {
                    type: aiError.status === 503 ? 'service_overloaded' : 'ai_generation_failed',
                    message: aiError.status === 503 ? 'AI service temporarily overloaded' : 'AI generation failed',
                    fallbackUsed: true
                } : null,
                sourceDetails: {
                    title: mostRelevantArticle.title,
                    author: mostRelevantArticle.author,
                    source_name: mostRelevantArticle.source_name || mostRelevantArticle.source?.name,
                    url: mostRelevantArticle.url,
                    urlToImage: mostRelevantArticle.urlToImage,
                    published_at: mostRelevantArticle.published_at || mostRelevantArticle.publishedAt,
                    relevanceScore: mostRelevantArticle.relevanceScore?.toFixed(2)
                }
            };
        }

        await emitStatusUpdate(socket, sessionId, 'complete', 'Search completed', 300);

        return {
            success: false,
            source: 'none',
            searchStep: 0,
            totalFound: 0,
            aiAnswer: 'No relevant information found for your query. Please try different keywords.',
            sourceDetails: null
        };

    } catch (error) {
        console.error('Error in processSearchQuery:', error);
        await emitStatusUpdate(socket, sessionId, 'error', 'An error occurred during search', 300);

        return {
            success: false,
            source: 'error',
            searchStep: 0,
            totalFound: 0,
            aiAnswer: 'An error occurred while processing your query. Please try again.',
            sourceDetails: null,
            error: error.message
        };
    }
};

const isValidSessionId = (sessionId) => {
    return sessionId && typeof sessionId === 'string' && sessionId.length > 0;
};

// MAIN FIX: Prevent message duplication
const setupSocketHandlers = (io) => {
    io.engine.on('connection_error', (err) => {
        console.log('Socket.IO connection error:', err.req);
        console.log('Error code:', err.code);
        console.log('Error message:', err.message);
        console.log('Error context:', err.context);
    });

    io.engine.pingTimeout = 60000;
    io.engine.pingInterval = 25000;

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        socket.timeout = 30000;

        socket.on('join_session', async (data) => {
            try {
                let { sessionId } = data || {};

                if (!isValidSessionId(sessionId)) {
                    sessionId = uuidv4();
                }

                const rooms = Array.from(socket.rooms);
                rooms.forEach(room => {
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
                    console.error('Error fetching history:', historyError);
                }

                socket.emit('session_joined', {
                    success: true,
                    sessionId,
                    history,
                    message: `Successfully joined session: ${sessionId}`,
                    timestamp: new Date().toISOString()
                });

                console.log(`User ${socket.id} joined session: ${sessionId}`);
            } catch (error) {
                console.error('Error joining session:', error);
                socket.emit('session_joined', {
                    success: false,
                    error: 'Failed to join session',
                    message: error.message
                });
            }
        });

        // FIXED: Enhanced message handler to prevent duplicates
        socket.on('send_message', async (data) => {
            try {
                const { message, sessionId } = data || {};

                if (!message || typeof message !== 'string' || message.trim().length === 0) {
                    socket.emit('message_error', {
                        success: false,
                        error: 'Message cannot be empty'
                    });
                    return;
                }

                if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
                    socket.emit('message_error', {
                        success: false,
                        error: 'No valid session found. Please join a session first.'
                    });
                    return;
                }

                const trimmedMessage = message.trim();

                // Generate unique message ID to prevent duplicates
                const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                // FIXED: Store user message ONCE with unique ID
                let userMessage;
                try {
                    userMessage = await addMessageToRedis(sessionId, {
                        id: messageId, // Use our unique ID
                        type: 'user',
                        content: trimmedMessage,
                        sender: 'user',
                        timestamp: new Date().toISOString()
                    });
                } catch (redisError) {
                    console.error('Redis error, using fallback:', redisError);
                    userMessage = {
                        id: messageId,
                        type: 'user',
                        content: trimmedMessage,
                        sender: 'user',
                        timestamp: new Date().toISOString(),
                        sessionId
                    };
                }

                // FIXED: Save to DB only once with the same ID
                try {
                    await saveMessageToDb(sessionId, userMessage);
                } catch (dbError) {
                    console.error('DB save error for user message:', dbError);
                }

                // FIXED: Broadcast user message to ALL clients in session (including sender)
                // This ensures everyone sees the same message once
                io.to(sessionId).emit('new_message', {
                    ...userMessage,
                    success: true
                });

                console.log(`Processing query: "${trimmedMessage}" for session: ${sessionId}`);
                const searchResult = await processSearchQuery(trimmedMessage, sessionId, socket);

                // Generate unique ID for AI message
                const aiMessageId = `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                let aiMessage;
                try {
                    aiMessage = await addMessageToRedis(sessionId, {
                        id: aiMessageId, // Use unique ID
                        type: 'assistant',
                        content: searchResult.aiAnswer || 'No relevant information found.',
                        sender: 'assistant',
                        timestamp: new Date().toISOString(),
                        metadata: {
                            source: searchResult.source,
                            searchStep: searchResult.searchStep,
                            totalFound: searchResult.totalFound,
                            sourceDetails: searchResult.sourceDetails,
                            success: searchResult.success,
                            aiError: searchResult.aiError
                        }
                    });
                } catch (redisError) {
                    console.error('Redis error for AI message:', redisError);
                    aiMessage = {
                        id: aiMessageId,
                        type: 'assistant',
                        content: searchResult.aiAnswer || 'No relevant information found.',
                        sender: 'assistant',
                        timestamp: new Date().toISOString(),
                        sessionId,
                        metadata: {
                            source: searchResult.source,
                            searchStep: searchResult.searchStep,
                            totalFound: searchResult.totalFound,
                            sourceDetails: searchResult.sourceDetails,
                            success: searchResult.success,
                            aiError: searchResult.aiError
                        }
                    };
                }

                try {
                    await saveMessageToDb(sessionId, aiMessage);
                } catch (dbError) {
                    console.error('DB save error for AI message:', dbError);
                }

                // Broadcast AI response to ALL clients in session
                io.to(sessionId).emit('new_message', {
                    ...aiMessage,
                    success: true
                });

                console.log('Message broadcasting completed');

            } catch (error) {
                console.error('Error processing message:', error);

                const errorMessage = {
                    id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'assistant',
                    content: 'Sorry, I encountered an error while processing your message. Please try again.',
                    sender: 'assistant',
                    timestamp: new Date().toISOString(),
                    error: true
                };

                io.to(sessionId).emit('new_message', errorMessage);

                socket.emit('message_error', {
                    success: false,
                    error: 'Failed to process message',
                    message: error.message
                });
            }
        });

        // Rest of your socket handlers...
        socket.on('get_history', async (data) => {
            try {
                const { sessionId, limit = 50, offset = 0 } = data || {};

                if (!isValidSessionId(sessionId)) {
                    socket.emit('history_error', {
                        success: false,
                        error: 'Invalid session ID'
                    });
                    return;
                }

                const history = await getCombinedChatHistory(sessionId, limit, offset);

                socket.emit('session_history', {
                    success: true,
                    sessionId,
                    history,
                    count: history.length
                });
            } catch (error) {
                console.error('Error getting history:', error);
                socket.emit('history_error', {
                    success: false,
                    error: 'Failed to get session history',
                    message: error.message
                });
            }
        });

        socket.on('clear_session', async (data) => {
            try {
                const { sessionId } = data || {};

                if (!isValidSessionId(sessionId) || sessionId !== socket.sessionId) {
                    socket.emit('clear_error', {
                        success: false,
                        error: 'Invalid session'
                    });
                    return;
                }

                try {
                    await clearRedisSession(sessionId);
                } catch (clearError) {
                    console.error('Error clearing Redis session:', clearError);
                }

                io.to(sessionId).emit('session_cleared', {
                    success: true,
                    sessionId,
                    message: 'Session cache cleared successfully',
                    timestamp: new Date().toISOString()
                });

                console.log(`Session ${sessionId} cleared by user ${socket.id}`);
            } catch (error) {
                console.error('Error clearing session:', error);
                socket.emit('clear_error', {
                    success: false,
                    error: 'Failed to clear session',
                    message: error.message
                });
            }
        });

        socket.on('ping', () => {
            socket.emit('pong', {
                timestamp: new Date().toISOString(),
                serverTime: Date.now()
            });
        });

        socket.on('disconnect', async (reason) => {
            console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

            if (socket.sessionId) {
                try {
                    await handleDisconnectionBackup(socket.sessionId);
                } catch (backupError) {
                    console.error('Error during disconnect backup:', backupError);
                }
            }
        });

        socket.on('error', (error) => {
            console.error(`Socket error for ${socket.id}:`, error);
        });

        socket.on('redis_error', async (data) => {
            const { sessionId } = data || {};
            if (isValidSessionId(sessionId)) {
                try {
                    await handleDisconnectionBackup(sessionId);
                } catch (backupError) {
                    console.error('Error during Redis error backup:', backupError);
                }
            }
        });
    });

    io.engine.on('connection_error', (err) => {
        console.error('Socket.IO Engine Error:', {
            req: err.req?.url,
            code: err.code,
            message: err.message,
            context: err.context
        });
    });
};

module.exports = { setupSocketHandlers };