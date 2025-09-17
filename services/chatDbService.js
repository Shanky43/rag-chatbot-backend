// // const prisma = require('./prismaService');

// // const createChatSession = async (sessionId) => {
// //     try {
// //         return await prisma.chatSession.create({
// //             data: {
// //                 session_id: sessionId,
// //                 created_at: new Date(),
// //                 updated_at: new Date()
// //             }
// //         });
// //     } catch (error) {
// //         // Session might already exist, ignore duplicate error
// //         if (error.code === 'P2002') {
// //             return await prisma.chatSession.findUnique({
// //                 where: { session_id: sessionId }
// //             });
// //         }
// //         throw error;
// //     }
// // };

// // // Helper function to ensure content is a string
// // const normalizeMessageContent = (content) => {
// //     if (typeof content === 'string') {
// //         return content;
// //     }

// //     if (typeof content === 'object' && content !== null) {
// //         // If content is an object with answer property (from AI response)
// //         if (content.answer) {
// //             return content.answer;
// //         }

// //         // If it's an object, stringify it
// //         return JSON.stringify(content);
// //     }

// //     // Fallback: convert to string
// //     return String(content);
// // };

// // // Save single message to database
// // const saveMessageToDb = async (sessionId, message) => {
// //     try {
// //         // Ensure session exists
// //         await createChatSession(sessionId);

// //         // Normalize content to ensure it's a string
// //         const normalizedContent = normalizeMessageContent(message.content);

// //         return await prisma.chatMessage.create({
// //             data: {
// //                 session_id: sessionId,
// //                 message_id: message.id.toString(),
// //                 type: message.type,
// //                 content: normalizedContent,
// //                 sender: message.sender,
// //                 timestamp: new Date(message.timestamp),
// //                 metadata: message.metadata ? JSON.stringify(message.metadata) : null
// //             }
// //         });
// //     } catch (error) {
// //         console.error('Error saving message to DB:', error);
// //         console.error('Message content type:', typeof message.content);
// //         console.error('Message content:', message.content);
// //         throw error;
// //     }
// // };

// // // Backup Redis session to database
// // const backupSessionToDb = async (sessionId, messages) => {
// //     try {
// //         if (!messages || messages.length === 0) return;

// //         // Ensure session exists
// //         await createChatSession(sessionId);

// //         // Get existing messages to avoid duplicates
// //         const existingMessages = await prisma.chatMessage.findMany({
// //             where: { session_id: sessionId },
// //             select: { message_id: true }
// //         });

// //         const existingIds = new Set(existingMessages.map(m => m.message_id));

// //         // Filter out messages that already exist
// //         const newMessages = messages.filter(msg => !existingIds.has(msg.id.toString()));

// //         if (newMessages.length === 0) return;

// //         // Bulk insert new messages with normalized content
// //         const messagesToInsert = newMessages.map(message => ({
// //             session_id: sessionId,
// //             message_id: message.id.toString(),
// //             type: message.type,
// //             content: normalizeMessageContent(message.content),
// //             sender: message.sender,
// //             timestamp: new Date(message.timestamp),
// //             metadata: message.metadata ? JSON.stringify(message.metadata) : null
// //         }));

// //         await prisma.chatMessage.createMany({
// //             data: messagesToInsert,
// //             skipDuplicates: true
// //         });

// //         // Update session timestamp
// //         await prisma.chatSession.update({
// //             where: { session_id: sessionId },
// //             data: { updated_at: new Date() }
// //         });

// //         console.log(`Backed up ${newMessages.length} messages for session ${sessionId}`);
// //         return newMessages.length;
// //     } catch (error) {
// //         console.error('Error backing up session to DB:', error);
// //         throw error;
// //     }
// // };

// // // Get chat history from database
// // const getChatHistoryFromDb = async (sessionId, limit = 50, offset = 0) => {
// //     try {
// //         const messages = await prisma.chatMessage.findMany({
// //             where: { session_id: sessionId },
// //             orderBy: { timestamp: 'asc' },
// //             take: limit,
// //             skip: offset
// //         });

// //         return messages.map(msg => ({
// //             id: parseInt(msg.message_id),
// //             timestamp: msg.timestamp.toISOString(),
// //             type: msg.type,
// //             content: msg.content, // Already a string from DB
// //             sender: msg.sender,
// //             metadata: msg.metadata ? JSON.parse(msg.metadata) : null
// //         }));
// //     } catch (error) {
// //         console.error('Error getting chat history from DB:', error);
// //         return [];
// //     }
// // };

// // // Get combined chat history (Redis + DB)
// // const getCombinedChatHistory = async (sessionId, limit = 50) => {
// //     try {
// //         // Get from Redis first (most recent)
// //         const redisHistory = await require('./redisService').getSessionHistory(sessionId, limit);

// //         // If Redis has enough messages, return them
// //         if (redisHistory.length >= limit) {
// //             return redisHistory.slice(0, limit);
// //         }

// //         // Get additional messages from DB
// //         const remainingLimit = limit - redisHistory.length;
// //         const dbHistory = await getChatHistoryFromDb(sessionId, remainingLimit);

// //         // Get the latest message timestamp from Redis to avoid duplicates
// //         const latestRedisTimestamp = redisHistory.length > 0 ?
// //             new Date(redisHistory[redisHistory.length - 1].timestamp) : new Date(0);

// //         // Filter DB messages that are older than Redis messages
// //         const filteredDbHistory = dbHistory.filter(msg =>
// //             new Date(msg.timestamp) < latestRedisTimestamp
// //         );

// //         // Combine and sort by timestamp
// //         const combined = [...filteredDbHistory, ...redisHistory];
// //         return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
// //     } catch (error) {
// //         console.error('Error getting combined chat history:', error);
// //         // Fallback to DB only
// //         return await getChatHistoryFromDb(sessionId, limit);
// //     }
// // };

// // // Delete chat session and messages
// // const deleteChatSession = async (sessionId) => {
// //     try {
// //         await prisma.chatMessage.deleteMany({
// //             where: { session_id: sessionId }
// //         });

// //         await prisma.chatSession.delete({
// //             where: { session_id: sessionId }
// //         });

// //         return true;
// //     } catch (error) {
// //         console.error('Error deleting chat session:', error);
// //         return false;
// //     }
// // };

// // // Get session statistics
// // const getSessionDbStats = async (sessionId) => {
// //     try {
// //         const session = await prisma.chatSession.findUnique({
// //             where: { session_id: sessionId },
// //             include: {
// //                 _count: {
// //                     select: { messages: true }
// //                 }
// //             }
// //         });

// //         if (!session) return null;

// //         return {
// //             sessionId,
// //             messageCount: session._count.messages,
// //             createdAt: session.created_at.toISOString(),
// //             updatedAt: session.updated_at.toISOString()
// //         };
// //     } catch (error) {
// //         console.error('Error getting session DB stats:', error);
// //         return null;
// //     }
// // };

// // module.exports = {
// //     createChatSession,
// //     saveMessageToDb,
// //     backupSessionToDb,
// //     getChatHistoryFromDb,
// //     getCombinedChatHistory,
// //     deleteChatSession,
// //     getSessionDbStats
// // };
// const prisma = require('./prismaService');

// const createChatSession = async (sessionId) => {
//     try {
//         return await prisma.chatSession.create({
//             data: {
//                 session_id: sessionId,
//                 created_at: new Date(),
//                 updated_at: new Date()
//             }
//         });
//     } catch (error) {
//         // Session might already exist, ignore duplicate error
//         if (error.code === 'P2002') {
//             return await prisma.chatSession.findUnique({
//                 where: { session_id: sessionId }
//             });
//         }
//         throw error;
//     }
// };

// // Get all chat sessions with their last message for sidebar
// const getAllChatSessions = async (limit = 50, offset = 0) => {
//     try {
//         const sessions = await prisma.chatSession.findMany({
//             orderBy: { updated_at: 'desc' },
//             take: limit,
//             skip: offset,
//             include: {
//                 messages: {
//                     orderBy: { timestamp: 'desc' },
//                     take: 1,
//                     where: {
//                         NOT: {
//                             type: 'system'
//                         }
//                     }
//                 },
//                 _count: {
//                     select: { messages: true }
//                 }
//             }
//         });

//         return sessions.map(session => {
//             const lastMessage = session.messages[0];
//             let title = 'New Chat';

//             // Generate title from first user message or use last message content
//             if (lastMessage) {
//                 const content = lastMessage.content;
//                 if (content && content.length > 0) {
//                     // Create title from first 50 characters of content
//                     title = content.length > 50 ? content.substring(0, 47) + '...' : content;
//                 }
//             }

//             return {
//                 id: session.session_id,
//                 title,
//                 lastMessage: lastMessage ? (
//                     lastMessage.content.length > 100 ?
//                         lastMessage.content.substring(0, 97) + '...' :
//                         lastMessage.content
//                 ) : 'No messages yet',
//                 timestamp: session.updated_at.toISOString(),
//                 messageCount: session._count.messages,
//                 createdAt: session.created_at.toISOString(),
//                 updatedAt: session.updated_at.toISOString()
//             };
//         });
//     } catch (error) {
//         console.error('Error getting all chat sessions:', error);
//         return [];
//     }
// };

// // Helper function to ensure content is a string
// const normalizeMessageContent = (content) => {
//     if (typeof content === 'string') {
//         return content;
//     }

//     if (typeof content === 'object' && content !== null) {
//         // If content is an object with answer property (from AI response)
//         if (content.answer) {
//             return content.answer;
//         }

//         // If it's an object, stringify it
//         return JSON.stringify(content);
//     }

//     // Fallback: convert to string
//     return String(content);
// };

// // Save single message to database
// const saveMessageToDb = async (sessionId, message) => {
//     try {
//         // Ensure session exists
//         await createChatSession(sessionId);

//         // Normalize content to ensure it's a string
//         const normalizedContent = normalizeMessageContent(message.content);

//         return await prisma.chatMessage.create({
//             data: {
//                 session_id: sessionId,
//                 message_id: message.id.toString(),
//                 type: message.type,
//                 content: normalizedContent,
//                 sender: message.sender,
//                 timestamp: new Date(message.timestamp),
//                 metadata: message.metadata ? JSON.stringify(message.metadata) : null
//             }
//         });
//     } catch (error) {
//         console.error('Error saving message to DB:', error);
//         console.error('Message content type:', typeof message.content);
//         console.error('Message content:', message.content);
//         throw error;
//     }
// };

// // Backup Redis session to database
// const backupSessionToDb = async (sessionId, messages) => {
//     try {
//         if (!messages || messages.length === 0) return;

//         // Ensure session exists
//         await createChatSession(sessionId);

//         // Get existing messages to avoid duplicates
//         const existingMessages = await prisma.chatMessage.findMany({
//             where: { session_id: sessionId },
//             select: { message_id: true }
//         });

//         const existingIds = new Set(existingMessages.map(m => m.message_id));

//         // Filter out messages that already exist
//         const newMessages = messages.filter(msg => !existingIds.has(msg.id.toString()));

//         if (newMessages.length === 0) return;

//         // Bulk insert new messages with normalized content
//         const messagesToInsert = newMessages.map(message => ({
//             session_id: sessionId,
//             message_id: message.id.toString(),
//             type: message.type,
//             content: normalizeMessageContent(message.content),
//             sender: message.sender,
//             timestamp: new Date(message.timestamp),
//             metadata: message.metadata ? JSON.stringify(message.metadata) : null
//         }));

//         await prisma.chatMessage.createMany({
//             data: messagesToInsert,
//             skipDuplicates: true
//         });

//         // Update session timestamp
//         await prisma.chatSession.update({
//             where: { session_id: sessionId },
//             data: { updated_at: new Date() }
//         });

//         console.log(`Backed up ${newMessages.length} messages for session ${sessionId}`);
//         return newMessages.length;
//     } catch (error) {
//         console.error('Error backing up session to DB:', error);
//         throw error;
//     }
// };

// // Get chat history from database
// const getChatHistoryFromDb = async (sessionId, limit = 50, offset = 0) => {
//     try {
//         const messages = await prisma.chatMessage.findMany({
//             where: { session_id: sessionId },
//             orderBy: { timestamp: 'asc' },
//             take: limit,
//             skip: offset
//         });

//         return messages.map(msg => ({
//             id: parseInt(msg.message_id),
//             timestamp: msg.timestamp.toISOString(),
//             type: msg.type,
//             content: msg.content, // Already a string from DB
//             sender: msg.sender,
//             metadata: msg.metadata ? JSON.parse(msg.metadata) : null
//         }));
//     } catch (error) {
//         console.error('Error getting chat history from DB:', error);
//         return [];
//     }
// };

// // Get combined chat history (Redis + DB)
// const getCombinedChatHistory = async (sessionId, limit = 50) => {
//     try {
//         // Get from Redis first (most recent)
//         const redisHistory = await require('./redisService').getSessionHistory(sessionId, limit);

//         // If Redis has enough messages, return them
//         if (redisHistory.length >= limit) {
//             return redisHistory.slice(0, limit);
//         }

//         // Get additional messages from DB
//         const remainingLimit = limit - redisHistory.length;
//         const dbHistory = await getChatHistoryFromDb(sessionId, remainingLimit);

//         // Get the latest message timestamp from Redis to avoid duplicates
//         const latestRedisTimestamp = redisHistory.length > 0 ?
//             new Date(redisHistory[redisHistory.length - 1].timestamp) : new Date(0);

//         // Filter DB messages that are older than Redis messages
//         const filteredDbHistory = dbHistory.filter(msg =>
//             new Date(msg.timestamp) < latestRedisTimestamp
//         );

//         // Combine and sort by timestamp
//         const combined = [...filteredDbHistory, ...redisHistory];
//         return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
//     } catch (error) {
//         console.error('Error getting combined chat history:', error);
//         // Fallback to DB only
//         return await getChatHistoryFromDb(sessionId, limit);
//     }
// };

// // Delete chat session and messages
// const deleteChatSession = async (sessionId) => {
//     try {
//         await prisma.chatMessage.deleteMany({
//             where: { session_id: sessionId }
//         });

//         await prisma.chatSession.delete({
//             where: { session_id: sessionId }
//         });

//         return true;
//     } catch (error) {
//         console.error('Error deleting chat session:', error);
//         return false;
//     }
// };

// // Get session statistics
// const getSessionDbStats = async (sessionId) => {
//     try {
//         const session = await prisma.chatSession.findUnique({
//             where: { session_id: sessionId },
//             include: {
//                 _count: {
//                     select: { messages: true }
//                 }
//             }
//         });

//         if (!session) return null;

//         return {
//             sessionId,
//             messageCount: session._count.messages,
//             createdAt: session.created_at.toISOString(),
//             updatedAt: session.updated_at.toISOString()
//         };
//     } catch (error) {
//         console.error('Error getting session DB stats:', error);
//         return null;
//     }
// };

// module.exports = {
//     createChatSession,
//     getAllChatSessions,
//     saveMessageToDb,
//     backupSessionToDb,
//     getChatHistoryFromDb,
//     getCombinedChatHistory,
//     deleteChatSession,
//     getSessionDbStats
// };
// services/chatDbService.js - FIXED VERSION
const prisma = require('./prismaService');

const createChatSession = async (sessionId) => {
    try {
        return await prisma.chatSession.create({
            data: {
                session_id: sessionId,
                created_at: new Date(),
                updated_at: new Date()
            }
        });
    } catch (error) {
        // Session might already exist, ignore duplicate error
        if (error.code === 'P2002') {
            return await prisma.chatSession.findUnique({
                where: { session_id: sessionId }
            });
        }
        throw error;
    }
};

// Get all chat sessions with their last message for sidebar
const getAllChatSessions = async (limit = 50, offset = 0) => {
    try {
        const sessions = await prisma.chatSession.findMany({
            orderBy: { updated_at: 'desc' },
            take: limit,
            skip: offset,
            include: {
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                    where: {
                        NOT: {
                            type: 'system'
                        }
                    }
                },
                _count: {
                    select: { messages: true }
                }
            }
        });

        return sessions.map(session => {
            const lastMessage = session.messages[0];
            let title = 'New Chat';

            // Generate title from first user message or use last message content
            if (lastMessage) {
                const content = lastMessage.content;
                if (content && content.length > 0) {
                    // Create title from first 50 characters of content
                    title = content.length > 50 ? content.substring(0, 47) + '...' : content;
                }
            }

            return {
                id: session.session_id,
                title,
                lastMessage: lastMessage ? (
                    lastMessage.content.length > 100 ?
                        lastMessage.content.substring(0, 97) + '...' :
                        lastMessage.content
                ) : 'No messages yet',
                timestamp: session.updated_at.toISOString(),
                messageCount: session._count.messages,
                createdAt: session.created_at.toISOString(),
                updatedAt: session.updated_at.toISOString()
            };
        });
    } catch (error) {
        console.error('Error getting all chat sessions:', error);
        return [];
    }
};

// Helper function to ensure content is a string
const normalizeMessageContent = (content) => {
    if (typeof content === 'string') {
        return content;
    }

    if (typeof content === 'object' && content !== null) {
        // If content is an object with answer property (from AI response)
        if (content.answer) {
            return content.answer;
        }

        // If it's an object, stringify it
        return JSON.stringify(content);
    }

    // Fallback: convert to string
    return String(content);
};

// FIXED: Save single message to database with duplicate prevention
const saveMessageToDb = async (sessionId, message) => {
    try {
        // Ensure session exists
        await createChatSession(sessionId);

        // Normalize content to ensure it's a string
        const normalizedContent = normalizeMessageContent(message.content);

        // FIXED: Check if message already exists to prevent duplicates
        const existingMessage = await prisma.chatMessage.findUnique({
            where: {
                session_id_message_id: {
                    session_id: sessionId,
                    message_id: message.id.toString()
                }
            }
        });

        // If message already exists, return it instead of creating a duplicate
        if (existingMessage) {
            console.log(`Message ${message.id} already exists in DB, skipping...`);
            return existingMessage;
        }

        // Create new message
        return await prisma.chatMessage.create({
            data: {
                session_id: sessionId,
                message_id: message.id.toString(),
                type: message.type,
                content: normalizedContent,
                sender: message.sender,
                timestamp: new Date(message.timestamp),
                metadata: message.metadata ? JSON.stringify(message.metadata) : null
            }
        });
    } catch (error) {
        // If it's a unique constraint error, the message already exists
        if (error.code === 'P2002') {
            console.log(`Duplicate message ${message.id} detected, skipping...`);
            return await prisma.chatMessage.findUnique({
                where: {
                    session_id_message_id: {
                        session_id: sessionId,
                        message_id: message.id.toString()
                    }
                }
            });
        }
        
        console.error('Error saving message to DB:', error);
        console.error('Message content type:', typeof message.content);
        console.error('Message content:', message.content);
        throw error;
    }
};

// FIXED: Backup Redis session to database with improved duplicate handling
const backupSessionToDb = async (sessionId, messages) => {
    try {
        if (!messages || messages.length === 0) return 0;

        // Ensure session exists
        await createChatSession(sessionId);

        // Get existing message IDs to avoid duplicates
        const existingMessages = await prisma.chatMessage.findMany({
            where: { session_id: sessionId },
            select: { message_id: true }
        });

        const existingIds = new Set(existingMessages.map(m => m.message_id));

        // Filter out messages that already exist
        const newMessages = messages.filter(msg => {
            const messageId = msg.id.toString();
            return !existingIds.has(messageId);
        });

        if (newMessages.length === 0) {
            console.log(`No new messages to backup for session ${sessionId}`);
            return 0;
        }

        console.log(`Backing up ${newMessages.length} new messages for session ${sessionId}`);

        // FIXED: Use transaction for atomic operation
        const result = await prisma.$transaction(async (tx) => {
            // Bulk insert new messages with normalized content
            const messagesToInsert = newMessages.map(message => ({
                session_id: sessionId,
                message_id: message.id.toString(),
                type: message.type,
                content: normalizeMessageContent(message.content),
                sender: message.sender,
                timestamp: new Date(message.timestamp),
                metadata: message.metadata ? JSON.stringify(message.metadata) : null
            }));

            await tx.chatMessage.createMany({
                data: messagesToInsert,
                skipDuplicates: true // Extra safety
            });

            // Update session timestamp
            await tx.chatSession.update({
                where: { session_id: sessionId },
                data: { updated_at: new Date() }
            });

            return newMessages.length;
        });

        console.log(`Successfully backed up ${result} messages for session ${sessionId}`);
        return result;
    } catch (error) {
        console.error('Error backing up session to DB:', error);
        throw error;
    }
};

// FIXED: Get chat history from database with deduplication
const getChatHistoryFromDb = async (sessionId, limit = 50, offset = 0) => {
    try {
        const messages = await prisma.chatMessage.findMany({
            where: { session_id: sessionId },
            orderBy: { timestamp: 'asc' },
            take: limit,
            skip: offset,
            distinct: ['message_id'], // FIXED: Ensure unique messages only
        });

        return messages.map(msg => ({
            id: parseInt(msg.message_id),
            timestamp: msg.timestamp.toISOString(),
            type: msg.type,
            content: msg.content, // Already a string from DB
            sender: msg.sender,
            metadata: msg.metadata ? JSON.parse(msg.metadata) : null
        }));
    } catch (error) {
        console.error('Error getting chat history from DB:', error);
        return [];
    }
};

// FIXED: Get combined chat history with better deduplication logic
const getCombinedChatHistory = async (sessionId, limit = 50) => {
    try {
        // Get from Redis first (most recent)
        const redisHistory = await require('./redisService').getSessionHistory(sessionId, limit);

        // If Redis has enough messages, return them
        if (redisHistory.length >= limit) {
            // FIXED: Remove duplicates by message ID
            const uniqueMessages = new Map();
            redisHistory.forEach(msg => {
                uniqueMessages.set(msg.id.toString(), msg);
            });
            return Array.from(uniqueMessages.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .slice(0, limit);
        }

        // Get additional messages from DB
        const remainingLimit = limit - redisHistory.length;
        const dbHistory = await getChatHistoryFromDb(sessionId, remainingLimit);

        // Create a Map to track unique messages by ID
        const uniqueMessages = new Map();

        // Add Redis messages first (they're more recent)
        redisHistory.forEach(msg => {
            uniqueMessages.set(msg.id.toString(), msg);
        });

        // Add DB messages only if they don't already exist
        dbHistory.forEach(msg => {
            const messageId = msg.id.toString();
            if (!uniqueMessages.has(messageId)) {
                uniqueMessages.set(messageId, msg);
            }
        });

        // Convert back to array and sort by timestamp
        const combined = Array.from(uniqueMessages.values());
        return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    } catch (error) {
        console.error('Error getting combined chat history:', error);
        // Fallback to DB only with deduplication
        const dbHistory = await getChatHistoryFromDb(sessionId, limit);
        const uniqueMessages = new Map();
        dbHistory.forEach(msg => {
            uniqueMessages.set(msg.id.toString(), msg);
        });
        return Array.from(uniqueMessages.values());
    }
};

// Delete chat session and messages
const deleteChatSession = async (sessionId) => {
    try {
        await prisma.chatMessage.deleteMany({
            where: { session_id: sessionId }
        });

        await prisma.chatSession.delete({
            where: { session_id: sessionId }
        });

        return true;
    } catch (error) {
        console.error('Error deleting chat session:', error);
        return false;
    }
};

// Get session statistics
const getSessionDbStats = async (sessionId) => {
    try {
        const session = await prisma.chatSession.findUnique({
            where: { session_id: sessionId },
            include: {
                _count: {
                    select: { messages: true }
                }
            }
        });

        if (!session) return null;

        return {
            sessionId,
            messageCount: session._count.messages,
            createdAt: session.created_at.toISOString(),
            updatedAt: session.updated_at.toISOString()
        };
    } catch (error) {
        console.error('Error getting session DB stats:', error);
        return null;
    }
};

module.exports = {
    createChatSession,
    getAllChatSessions,
    saveMessageToDb,
    backupSessionToDb,
    getChatHistoryFromDb,
    getCombinedChatHistory,
    deleteChatSession,
    getSessionDbStats
};