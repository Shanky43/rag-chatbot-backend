// // // // const prisma = require('./prismaService');

// // // // const createChatSession = async (sessionId) => {
// // // //     try {
// // // //         return await prisma.chatSession.create({
// // // //             data: {
// // // //                 session_id: sessionId,
// // // //                 created_at: new Date(),
// // // //                 updated_at: new Date()
// // // //             }
// // // //         });
// // // //     } catch (error) {
// // // //         // Session might already exist, ignore duplicate error
// // // //         if (error.code === 'P2002') {
// // // //             return await prisma.chatSession.findUnique({
// // // //                 where: { session_id: sessionId }
// // // //             });
// // // //         }
// // // //         throw error;
// // // //     }
// // // // };

// // // // // Helper function to ensure content is a string
// // // // const normalizeMessageContent = (content) => {
// // // //     if (typeof content === 'string') {
// // // //         return content;
// // // //     }

// // // //     if (typeof content === 'object' && content !== null) {
// // // //         // If content is an object with answer property (from AI response)
// // // //         if (content.answer) {
// // // //             return content.answer;
// // // //         }

// // // //         // If it's an object, stringify it
// // // //         return JSON.stringify(content);
// // // //     }

// // // //     // Fallback: convert to string
// // // //     return String(content);
// // // // };

// // // // // Save single message to database
// // // // const saveMessageToDb = async (sessionId, message) => {
// // // //     try {
// // // //         // Ensure session exists
// // // //         await createChatSession(sessionId);

// // // //         // Normalize content to ensure it's a string
// // // //         const normalizedContent = normalizeMessageContent(message.content);

// // // //         return await prisma.chatMessage.create({
// // // //             data: {
// // // //                 session_id: sessionId,
// // // //                 message_id: message.id.toString(),
// // // //                 type: message.type,
// // // //                 content: normalizedContent,
// // // //                 sender: message.sender,
// // // //                 timestamp: new Date(message.timestamp),
// // // //                 metadata: message.metadata ? JSON.stringify(message.metadata) : null
// // // //             }
// // // //         });
// // // //     } catch (error) {
// // // //         console.error('Error saving message to DB:', error);
// // // //         console.error('Message content type:', typeof message.content);
// // // //         console.error('Message content:', message.content);
// // // //         throw error;
// // // //     }
// // // // };

// // // // // Backup Redis session to database
// // // // const backupSessionToDb = async (sessionId, messages) => {
// // // //     try {
// // // //         if (!messages || messages.length === 0) return;

// // // //         // Ensure session exists
// // // //         await createChatSession(sessionId);

// // // //         // Get existing messages to avoid duplicates
// // // //         const existingMessages = await prisma.chatMessage.findMany({
// // // //             where: { session_id: sessionId },
// // // //             select: { message_id: true }
// // // //         });

// // // //         const existingIds = new Set(existingMessages.map(m => m.message_id));

// // // //         // Filter out messages that already exist
// // // //         const newMessages = messages.filter(msg => !existingIds.has(msg.id.toString()));

// // // //         if (newMessages.length === 0) return;

// // // //         // Bulk insert new messages with normalized content
// // // //         const messagesToInsert = newMessages.map(message => ({
// // // //             session_id: sessionId,
// // // //             message_id: message.id.toString(),
// // // //             type: message.type,
// // // //             content: normalizeMessageContent(message.content),
// // // //             sender: message.sender,
// // // //             timestamp: new Date(message.timestamp),
// // // //             metadata: message.metadata ? JSON.stringify(message.metadata) : null
// // // //         }));

// // // //         await prisma.chatMessage.createMany({
// // // //             data: messagesToInsert,
// // // //             skipDuplicates: true
// // // //         });

// // // //         // Update session timestamp
// // // //         await prisma.chatSession.update({
// // // //             where: { session_id: sessionId },
// // // //             data: { updated_at: new Date() }
// // // //         });

// // // //         console.log(`Backed up ${newMessages.length} messages for session ${sessionId}`);
// // // //         return newMessages.length;
// // // //     } catch (error) {
// // // //         console.error('Error backing up session to DB:', error);
// // // //         throw error;
// // // //     }
// // // // };

// // // // // Get chat history from database
// // // // const getChatHistoryFromDb = async (sessionId, limit = 50, offset = 0) => {
// // // //     try {
// // // //         const messages = await prisma.chatMessage.findMany({
// // // //             where: { session_id: sessionId },
// // // //             orderBy: { timestamp: 'asc' },
// // // //             take: limit,
// // // //             skip: offset
// // // //         });

// // // //         return messages.map(msg => ({
// // // //             id: parseInt(msg.message_id),
// // // //             timestamp: msg.timestamp.toISOString(),
// // // //             type: msg.type,
// // // //             content: msg.content, // Already a string from DB
// // // //             sender: msg.sender,
// // // //             metadata: msg.metadata ? JSON.parse(msg.metadata) : null
// // // //         }));
// // // //     } catch (error) {
// // // //         console.error('Error getting chat history from DB:', error);
// // // //         return [];
// // // //     }
// // // // };

// // // // // Get combined chat history (Redis + DB)
// // // // const getCombinedChatHistory = async (sessionId, limit = 50) => {
// // // //     try {
// // // //         // Get from Redis first (most recent)
// // // //         const redisHistory = await require('./redisService').getSessionHistory(sessionId, limit);

// // // //         // If Redis has enough messages, return them
// // // //         if (redisHistory.length >= limit) {
// // // //             return redisHistory.slice(0, limit);
// // // //         }

// // // //         // Get additional messages from DB
// // // //         const remainingLimit = limit - redisHistory.length;
// // // //         const dbHistory = await getChatHistoryFromDb(sessionId, remainingLimit);

// // // //         // Get the latest message timestamp from Redis to avoid duplicates
// // // //         const latestRedisTimestamp = redisHistory.length > 0 ?
// // // //             new Date(redisHistory[redisHistory.length - 1].timestamp) : new Date(0);

// // // //         // Filter DB messages that are older than Redis messages
// // // //         const filteredDbHistory = dbHistory.filter(msg =>
// // // //             new Date(msg.timestamp) < latestRedisTimestamp
// // // //         );

// // // //         // Combine and sort by timestamp
// // // //         const combined = [...filteredDbHistory, ...redisHistory];
// // // //         return combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
// // // //     } catch (error) {
// // // //         console.error('Error getting combined chat history:', error);
// // // //         // Fallback to DB only
// // // //         return await getChatHistoryFromDb(sessionId, limit);
// // // //     }
// // // // };

// // // // // Delete chat session and messages
// // // // const deleteChatSession = async (sessionId) => {
// // // //     try {
// // // //         await prisma.chatMessage.deleteMany({
// // // //             where: { session_id: sessionId }
// // // //         });

// // // //         await prisma.chatSession.delete({
// // // //             where: { session_id: sessionId }
// // // //         });

// // // //         return true;
// // // //     } catch (error) {
// // // //         console.error('Error deleting chat session:', error);
// // // //         return false;
// // // //     }
// // // // };

// // // // // Get session statistics
// // // // const getSessionDbStats = async (sessionId) => {
// // // //     try {
// // // //         const session = await prisma.chatSession.findUnique({
// // // //             where: { session_id: sessionId },
// // // //             include: {
// // // //                 _count: {
// // // //                     select: { messages: true }
// // // //                 }
// // // //             }
// // // //         });

// // // //         if (!session) return null;

// // // //         return {
// // // //             sessionId,
// // // //             messageCount: session._count.messages,
// // // //             createdAt: session.created_at.toISOString(),
// // // //             updatedAt: session.updated_at.toISOString()
// // // //         };
// // // //     } catch (error) {
// // // //         console.error('Error getting session DB stats:', error);
// // // //         return null;
// // // //     }
// // // // };

// // // // module.exports = {
// // // //     createChatSession,
// // // //     saveMessageToDb,
// // // //     backupSessionToDb,
// // // //     getChatHistoryFromDb,
// // // //     getCombinedChatHistory,
// // // //     deleteChatSession,
// // // //     getSessionDbStats
// // // // };
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

// // // Get all chat sessions with their last message for sidebar
// // const getAllChatSessions = async (limit = 50, offset = 0) => {
// //     try {
// //         const sessions = await prisma.chatSession.findMany({
// //             orderBy: { updated_at: 'desc' },
// //             take: limit,
// //             skip: offset,
// //             include: {
// //                 messages: {
// //                     orderBy: { timestamp: 'desc' },
// //                     take: 1,
// //                     where: {
// //                         NOT: {
// //                             type: 'system'
// //                         }
// //                     }
// //                 },
// //                 _count: {
// //                     select: { messages: true }
// //                 }
// //             }
// //         });

// //         return sessions.map(session => {
// //             const lastMessage = session.messages[0];
// //             let title = 'New Chat';

// //             // Generate title from first user message or use last message content
// //             if (lastMessage) {
// //                 const content = lastMessage.content;
// //                 if (content && content.length > 0) {
// //                     // Create title from first 50 characters of content
// //                     title = content.length > 50 ? content.substring(0, 47) + '...' : content;
// //                 }
// //             }

// //             return {
// //                 id: session.session_id,
// //                 title,
// //                 lastMessage: lastMessage ? (
// //                     lastMessage.content.length > 100 ?
// //                         lastMessage.content.substring(0, 97) + '...' :
// //                         lastMessage.content
// //                 ) : 'No messages yet',
// //                 timestamp: session.updated_at.toISOString(),
// //                 messageCount: session._count.messages,
// //                 createdAt: session.created_at.toISOString(),
// //                 updatedAt: session.updated_at.toISOString()
// //             };
// //         });
// //     } catch (error) {
// //         console.error('Error getting all chat sessions:', error);
// //         return [];
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
// //     getAllChatSessions,
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

// // FIXED: Get all chat sessions with better title generation and proper session isolation
// const getAllChatSessions = async (limit = 50, offset = 0) => {
//     try {
//         const sessions = await prisma.chatSession.findMany({
//             orderBy: { updated_at: 'desc' },
//             take: limit,
//             skip: offset,
//             include: {
//                 messages: {
//                     orderBy: { timestamp: 'desc' },
//                     take: 2, // Get 2 messages to better determine title
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
//             let title = 'New Chat';
//             let lastMessage = 'No messages yet';

//             if (session.messages && session.messages.length > 0) {
//                 // FIXED: Better title generation logic
//                 const messages = session.messages.reverse(); // Oldest first
//                 const firstUserMessage = messages.find(msg => msg.type === 'user');
//                 const latestMessage = session.messages[0]; // Most recent

//                 // Use first user message for title, latest message for preview
//                 if (firstUserMessage) {
//                     const content = firstUserMessage.content;
//                     if (content && content.length > 0) {
//                         // Create title from first 50 characters of first user message
//                         title = content.length > 50 ? content.substring(0, 47) + '...' : content;
//                     }
//                 }

//                 // Use latest message for preview
//                 if (latestMessage) {
//                     const content = latestMessage.content;
//                     lastMessage = content && content.length > 100 ?
//                         content.substring(0, 97) + '...' :
//                         (content || 'No messages yet');
//                 }
//             }

//             return {
//                 id: session.session_id,
//                 title: title.trim(),
//                 lastMessage: lastMessage.trim(),
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

// // ENHANCED: Save single message to database with better duplicate handling
// const saveMessageToDb = async (sessionId, message) => {
//     try {
//         // Ensure session exists
//         await createChatSession(sessionId);

//         // Normalize content to ensure it's a string
//         const normalizedContent = normalizeMessageContent(message.content);

//         // ENHANCED: Check if message already exists before inserting
//         const existingMessage = await prisma.chatMessage.findUnique({
//             where: {
//                 session_message_unique: {
//                     session_id: sessionId,
//                     message_id: message.id.toString()
//                 }
//             }
//         });

//         if (existingMessage) {
//             console.log(`Message ${message.id} already exists in DB for session ${sessionId}, skipping...`);
//             return existingMessage;
//         }

//         const savedMessage = await prisma.chatMessage.create({
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

//         console.log(`Saved message ${message.id} to DB for session ${sessionId}`);
//         return savedMessage;
//     } catch (error) {
//         // If it's a unique constraint error, the message already exists
//         if (error.code === 'P2002') {
//             console.log(`Message ${message.id} already exists in DB (unique constraint), skipping...`);
//             return null;
//         }

//         console.error('Error saving message to DB:', error);
//         console.error('Message content type:', typeof message.content);
//         console.error('Message content:', message.content);
//         throw error;
//     }
// };

// // ENHANCED: Backup Redis session to database with better duplicate handling
// const backupSessionToDb = async (sessionId, messages) => {
//     try {
//         if (!messages || messages.length === 0) {
//             console.log(`No messages to backup for session ${sessionId}`);
//             return 0;
//         }

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

//         if (newMessages.length === 0) {
//             console.log(`No new messages to backup for session ${sessionId}`);
//             return 0;
//         }

//         // ENHANCED: Bulk insert new messages with normalized content and error handling
//         const messagesToInsert = newMessages.map(message => ({
//             session_id: sessionId,
//             message_id: message.id.toString(),
//             type: message.type,
//             content: normalizeMessageContent(message.content),
//             sender: message.sender,
//             timestamp: new Date(message.timestamp),
//             metadata: message.metadata ? JSON.stringify(message.metadata) : null
//         }));

//         try {
//             await prisma.chatMessage.createMany({
//                 data: messagesToInsert,
//                 skipDuplicates: true
//             });
//         } catch (bulkInsertError) {
//             console.error('Bulk insert failed, trying individual inserts:', bulkInsertError);

//             // Fallback: Insert messages individually
//             let successCount = 0;
//             for (const messageData of messagesToInsert) {
//                 try {
//                     await prisma.chatMessage.create({ data: messageData });
//                     successCount++;
//                 } catch (individualError) {
//                     if (individualError.code !== 'P2002') { // Not a duplicate error
//                         console.error(`Failed to insert message ${messageData.message_id}:`, individualError);
//                     }
//                 }
//             }
//             newMessages.length = successCount;
//         }

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

// // ENHANCED: Get combined chat history with better deduplication
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
//         const sorted = combined.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

//         // ENHANCED: Final deduplication by message ID
//         const uniqueMessages = new Map();
//         sorted.forEach(msg => {
//             const msgId = msg.id.toString();
//             if (!uniqueMessages.has(msgId)) {
//                 uniqueMessages.set(msgId, msg);
//             }
//         });

//         const result = Array.from(uniqueMessages.values()).slice(0, limit);
//         console.log(`Combined history for session ${sessionId}: ${result.length} unique messages`);
//         return result;
//     } catch (error) {
//         console.error('Error getting combined chat history:', error);
//         // Fallback to DB only
//         return await getChatHistoryFromDb(sessionId, limit);
//     }
// };

// // Delete chat session and messages
// const deleteChatSession = async (sessionId) => {
//     try {
//         // Delete messages first (cascade should handle this, but being explicit)
//         await prisma.chatMessage.deleteMany({
//             where: { session_id: sessionId }
//         });

//         // Delete session
//         await prisma.chatSession.delete({
//             where: { session_id: sessionId }
//         });

//         console.log(`Deleted chat session ${sessionId} from database`);
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
        if (error.code === 'P2002') {
            return await prisma.chatSession.findUnique({
                where: { session_id: sessionId }
            });
        }
        throw error;
    }
};

const getAllChatSessions = async (limit = 50, offset = 0) => {
    try {
        const sessions = await prisma.chatSession.findMany({
            orderBy: { updated_at: 'desc' },
            take: limit,
            skip: offset,
            include: {
                messages: {
                    orderBy: { timestamp: 'desc' },
                    take: 2,
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
            let title = 'New Chat';
            let lastMessage = 'No messages yet';

            if (session.messages && session.messages.length > 0) {
                const messages = session.messages.reverse();
                const firstUserMessage = messages.find(msg => msg.type === 'user');
                const latestMessage = session.messages[0];

                if (firstUserMessage) {
                    const content = firstUserMessage.content;
                    if (content && content.length > 0) {
                        title = content.length > 50 ? content.substring(0, 47) + '...' : content;
                    }
                }

                if (latestMessage) {
                    const content = latestMessage.content;
                    lastMessage = content && content.length > 100 ?
                        content.substring(0, 97) + '...' :
                        (content || 'No messages yet');
                }
            }

            return {
                id: session.session_id,
                title: title.trim(),
                lastMessage: lastMessage.trim(),
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

const normalizeMessageContent = (content) => {
    if (typeof content === 'string') {
        return content;
    }

    if (typeof content === 'object' && content !== null) {
        if (content.answer) {
            return content.answer;
        }
        return JSON.stringify(content);
    }

    return String(content);
};

const saveMessageToDb = async (sessionId, message) => {
    try {
        await createChatSession(sessionId);
        const normalizedContent = normalizeMessageContent(message.content);

        const existingMessage = await prisma.chatMessage.findUnique({
            where: {
                session_message_unique: {
                    session_id: sessionId,
                    message_id: message.id.toString()
                }
            }
        });

        if (existingMessage) {
            console.log(`Message ${message.id} already exists in DB for session ${sessionId}, skipping...`);
            return existingMessage;
        }

        const savedMessage = await prisma.chatMessage.create({
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

        console.log(`Saved message ${message.id} to DB for session ${sessionId}`);
        return savedMessage;
    } catch (error) {
        if (error.code === 'P2002') {
            console.log(`Message ${message.id} already exists in DB (unique constraint), skipping...`);
            return null;
        }

        console.error('Error saving message to DB:', error);
        throw error;
    }
};

const backupSessionToDb = async (sessionId, messages) => {
    try {
        if (!messages || messages.length === 0) {
            console.log(`No messages to backup for session ${sessionId}`);
            return 0;
        }

        await createChatSession(sessionId);

        const existingMessages = await prisma.chatMessage.findMany({
            where: { session_id: sessionId },
            select: { message_id: true }
        });

        const existingIds = new Set(existingMessages.map(m => m.message_id));
        const newMessages = messages.filter(msg => !existingIds.has(msg.id.toString()));

        if (newMessages.length === 0) {
            console.log(`No new messages to backup for session ${sessionId}`);
            return 0;
        }

        const messagesToInsert = newMessages.map(message => ({
            session_id: sessionId,
            message_id: message.id.toString(),
            type: message.type,
            content: normalizeMessageContent(message.content),
            sender: message.sender,
            timestamp: new Date(message.timestamp),
            metadata: message.metadata ? JSON.stringify(message.metadata) : null
        }));

        try {
            await prisma.chatMessage.createMany({
                data: messagesToInsert,
                skipDuplicates: true
            });
        } catch (bulkInsertError) {
            console.error('Bulk insert failed, trying individual inserts:', bulkInsertError);

            let successCount = 0;
            for (const messageData of messagesToInsert) {
                try {
                    await prisma.chatMessage.create({ data: messageData });
                    successCount++;
                } catch (individualError) {
                    if (individualError.code !== 'P2002') {
                        console.error(`Failed to insert message ${messageData.message_id}:`, individualError);
                    }
                }
            }
            newMessages.length = successCount;
        }

        await prisma.chatSession.update({
            where: { session_id: sessionId },
            data: { updated_at: new Date() }
        });

        console.log(`Backed up ${newMessages.length} messages for session ${sessionId}`);
        return newMessages.length;
    } catch (error) {
        console.error('Error backing up session to DB:', error);
        throw error;
    }
};

// FIXED: Corrected getChatHistoryFromDb function
const getChatHistoryFromDb = async (sessionId, limit = 50, offset = 0) => {
    try {
        console.log(`Getting chat history from DB for session: ${sessionId}, limit: ${limit}, offset: ${offset}`);

        const messages = await prisma.chatMessage.findMany({
            where: { session_id: sessionId },
            orderBy: { timestamp: 'asc' },
            take: limit,
            skip: offset
        });

        console.log(`Found ${messages.length} messages in DB for session ${sessionId}`);

        return messages.map(msg => ({
            id: msg.message_id, // Keep as string for consistency
            timestamp: msg.timestamp.toISOString(),
            type: msg.type,
            content: msg.content,
            sender: msg.sender,
            metadata: msg.metadata ? JSON.parse(msg.metadata) : null
        }));
    } catch (error) {
        console.error('Error getting chat history from DB:', error);
        return [];
    }
};

// FIXED: Completely rewritten getCombinedChatHistory function
const getCombinedChatHistory = async (sessionId, limit = 50) => {
    try {
        console.log(`Getting combined history for session: ${sessionId}, limit: ${limit}`);

        // Get from Redis first (most recent messages)
        let redisHistory = [];
        try {
            const { getSessionHistory } = require('./redisService');
            redisHistory = await getSessionHistory(sessionId, Math.min(limit, 20)); // Limit Redis check
            console.log(`Found ${redisHistory.length} messages in Redis for session ${sessionId}`);
        } catch (redisError) {
            console.error('Error getting Redis history:', redisError);
            redisHistory = [];
        }

        // Get from database
        const dbHistory = await getChatHistoryFromDb(sessionId, limit);
        console.log(`Found ${dbHistory.length} messages in DB for session ${sessionId}`);

        // If we have both Redis and DB data, we need to merge them properly
        if (redisHistory.length > 0 && dbHistory.length > 0) {
            // Create a map to avoid duplicates by message ID
            const messageMap = new Map();

            // Add DB messages first (older)
            dbHistory.forEach(msg => {
                messageMap.set(msg.id.toString(), msg);
            });

            // Add Redis messages (newer), potentially overwriting DB versions
            redisHistory.forEach(msg => {
                messageMap.set(msg.id.toString(), msg);
            });

            // Convert back to array and sort by timestamp
            const combinedMessages = Array.from(messageMap.values());
            combinedMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            const result = combinedMessages.slice(0, limit);
            console.log(`Combined history: ${result.length} unique messages`);
            return result;
        }

        // If only Redis has data
        if (redisHistory.length > 0) {
            console.log(`Using Redis history only: ${redisHistory.length} messages`);
            return redisHistory.slice(0, limit);
        }

        // If only DB has data or both are empty
        console.log(`Using DB history only: ${dbHistory.length} messages`);
        return dbHistory.slice(0, limit);

    } catch (error) {
        console.error('Error getting combined chat history:', error);
        // Fallback to DB only
        return await getChatHistoryFromDb(sessionId, limit);
    }
};

const deleteChatSession = async (sessionId) => {
    try {
        await prisma.chatMessage.deleteMany({
            where: { session_id: sessionId }
        });

        await prisma.chatSession.delete({
            where: { session_id: sessionId }
        });

        console.log(`Deleted chat session ${sessionId} from database`);
        return true;
    } catch (error) {
        console.error('Error deleting chat session:', error);
        return false;
    }
};

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