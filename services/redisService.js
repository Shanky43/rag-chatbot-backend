// // // services/redisService.js
// // const Redis = require('ioredis');

// // let redisClient = null;
// // let isRedisAvailable = false;

// // // Create Redis client with error handling
// // const createRedisClient = () => {
// //     try {
// //         const client = new Redis({
// //             host: process.env.REDIS_HOST || '127.0.0.1',
// //             port: process.env.REDIS_PORT || 6379,
// //             password: process.env.REDIS_PASSWORD,
// //             retryDelayOnFailure: (times) => Math.min(times * 50, 2000),
// //             maxRetriesPerRequest: 1, // Reduced retries
// //             lazyConnect: true // Don't connect immediately
// //         });

// //         client.on('connect', () => {
// //             console.log('✅ Redis connected');
// //             isRedisAvailable = true;
// //         });

// //         client.on('error', (err) => {
// //             console.warn('⚠️ Redis unavailable, using fallback mode:', err.message);
// //             isRedisAvailable = false;
// //         });

// //         return client;
// //     } catch (error) {
// //         console.warn('⚠️ Redis client creation failed, using fallback mode');
// //         isRedisAvailable = false;
// //         return null;
// //     }
// // };

// // // Initialize client
// // redisClient = createRedisClient();

// // // Fallback storage (in-memory)
// // const fallbackStorage = new Map();
// // const SESSION_TTL = 24 * 60 * 60; // 24 hours
// // const getSessionKey = (sessionId) => `chat_session:${sessionId}`;

// // // Add message (with fallback)
// // const addMessageToRedis = async (sessionId, message) => {
// //     const messageData = {
// //         id: Date.now(),
// //         timestamp: new Date().toISOString(),
// //         ...message
// //     };

// //     if (isRedisAvailable && redisClient) {
// //         try {
// //             const sessionKey = getSessionKey(sessionId);
// //             await redisClient.lpush(sessionKey, JSON.stringify(messageData));
// //             await redisClient.expire(sessionKey, SESSION_TTL);
// //             return messageData;
// //         } catch (error) {
// //             console.warn('Redis failed, using fallback:', error.message);
// //             isRedisAvailable = false;
// //         }
// //     }

// //     // Fallback to in-memory storage
// //     const sessionKey = getSessionKey(sessionId);
// //     if (!fallbackStorage.has(sessionKey)) {
// //         fallbackStorage.set(sessionKey, []);
// //     }
// //     fallbackStorage.get(sessionKey).unshift(messageData);

// //     // Keep only last 100 messages in memory
// //     if (fallbackStorage.get(sessionKey).length > 100) {
// //         fallbackStorage.get(sessionKey).splice(100);
// //     }

// //     return messageData;
// // };

// // // Get session history (with fallback)
// // const getSessionHistory = async (sessionId, limit = 50) => {
// //     if (isRedisAvailable && redisClient) {
// //         try {
// //             const sessionKey = getSessionKey(sessionId);
// //             const messages = await redisClient.lrange(sessionKey, 0, limit - 1);
// //             return messages.map(msg => JSON.parse(msg)).reverse();
// //         } catch (error) {
// //             console.warn('Redis failed, using fallback:', error.message);
// //             isRedisAvailable = false;
// //         }
// //     }

// //     // Fallback to in-memory storage
// //     const sessionKey = getSessionKey(sessionId);
// //     const messages = fallbackStorage.get(sessionKey) || [];
// //     return messages.slice().reverse().slice(0, limit);
// // };

// // // Clear session (with fallback)
// // const clearRedisSession = async (sessionId) => {
// //     if (isRedisAvailable && redisClient) {
// //         try {
// //             const sessionKey = getSessionKey(sessionId);
// //             const deleted = await redisClient.del(sessionKey);
// //             return deleted > 0;
// //         } catch (error) {
// //             console.warn('Redis failed, using fallback:', error.message);
// //             isRedisAvailable = false;
// //         }
// //     }

// //     // Fallback to in-memory storage
// //     const sessionKey = getSessionKey(sessionId);
// //     const existed = fallbackStorage.has(sessionKey);
// //     fallbackStorage.delete(sessionKey);
// //     return existed;
// // };

// // // Session exists check (with fallback)
// // const redisSessionExists = async (sessionId) => {
// //     if (isRedisAvailable && redisClient) {
// //         try {
// //             const sessionKey = getSessionKey(sessionId);
// //             return await redisClient.exists(sessionKey) === 1;
// //         } catch (error) {
// //             isRedisAvailable = false;
// //         }
// //     }

// //     // Fallback to in-memory storage
// //     const sessionKey = getSessionKey(sessionId);
// //     return fallbackStorage.has(sessionKey);
// // };

// // // Get all messages (with fallback)
// // const getAllRedisSessionMessages = async (sessionId) => {
// //     if (isRedisAvailable && redisClient) {
// //         try {
// //             const sessionKey = getSessionKey(sessionId);
// //             const messages = await redisClient.lrange(sessionKey, 0, -1);
// //             return messages.map(msg => JSON.parse(msg)).reverse();
// //         } catch (error) {
// //             isRedisAvailable = false;
// //         }
// //     }

// //     // Fallback to in-memory storage
// //     const sessionKey = getSessionKey(sessionId);
// //     const messages = fallbackStorage.get(sessionKey) || [];
// //     return messages.slice().reverse();
// // };

// // module.exports = {
// //     addMessageToRedis,
// //     getSessionHistory,
// //     clearRedisSession,
// //     redisSessionExists,
// //     getAllRedisSessionMessages,
// //     isRedisAvailable: () => isRedisAvailable
// // };

// // services/redisService.js - FIXED VERSION
// const Redis = require('ioredis');

// let redisClient = null;
// let isRedisAvailable = false;

// // Create Redis client with error handling
// const createRedisClient = () => {
//     try {
//         const client = new Redis({
//             host: process.env.REDIS_HOST || '127.0.0.1',
//             port: process.env.REDIS_PORT || 6379,
//             password: process.env.REDIS_PASSWORD,
//             retryDelayOnFailure: (times) => Math.min(times * 50, 2000),
//             maxRetriesPerRequest: 1,
//             lazyConnect: true
//         });

//         client.on('connect', () => {
//             console.log('✅ Redis connected');
//             isRedisAvailable = true;
//         });

//         client.on('error', (err) => {
//             console.warn('⚠️ Redis unavailable, using fallback mode:', err.message);
//             isRedisAvailable = false;
//         });

//         return client;
//     } catch (error) {
//         console.warn('⚠️ Redis client creation failed, using fallback mode');
//         isRedisAvailable = false;
//         return null;
//     }
// };

// // Initialize client
// redisClient = createRedisClient();

// // Fallback storage (in-memory)
// const fallbackStorage = new Map();
// const SESSION_TTL = 24 * 60 * 60; // 24 hours
// const getSessionKey = (sessionId) => `chat_session:${sessionId}`;

// // FIXED: Add message with duplicate prevention
// const addMessageToRedis = async (sessionId, message) => {
//     // FIXED: Use the provided ID if available, otherwise generate one
//     const messageData = {
//         id: message.id || Date.now(),
//         timestamp: message.timestamp || new Date().toISOString(),
//         ...message
//     };

//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
            
//             // FIXED: Check if message already exists in Redis
//             const existingMessages = await redisClient.lrange(sessionKey, 0, -1);
//             const messageExists = existingMessages.some(msgStr => {
//                 try {
//                     const existingMsg = JSON.parse(msgStr);
//                     return existingMsg.id.toString() === messageData.id.toString();
//                 } catch (e) {
//                     return false;
//                 }
//             });

//             if (messageExists) {
//                 console.log(`Message ${messageData.id} already exists in Redis, skipping...`);
//                 return messageData;
//             }

//             await redisClient.lpush(sessionKey, JSON.stringify(messageData));
//             await redisClient.expire(sessionKey, SESSION_TTL);
//             return messageData;
//         } catch (error) {
//             console.warn('Redis failed, using fallback:', error.message);
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     if (!fallbackStorage.has(sessionKey)) {
//         fallbackStorage.set(sessionKey, []);
//     }

//     const sessionMessages = fallbackStorage.get(sessionKey);
    
//     // FIXED: Check for duplicates in fallback storage
//     const messageExists = sessionMessages.some(msg => 
//         msg.id.toString() === messageData.id.toString()
//     );

//     if (messageExists) {
//         console.log(`Message ${messageData.id} already exists in fallback storage, skipping...`);
//         return messageData;
//     }

//     sessionMessages.unshift(messageData);

//     // Keep only last 100 messages in memory
//     if (sessionMessages.length > 100) {
//         sessionMessages.splice(100);
//     }

//     return messageData;
// };

// // FIXED: Get session history with deduplication
// const getSessionHistory = async (sessionId, limit = 50) => {
//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
//             const messages = await redisClient.lrange(sessionKey, 0, limit - 1);
            
//             // FIXED: Parse and deduplicate messages
//             const uniqueMessages = new Map();
//             messages.forEach(msgStr => {
//                 try {
//                     const msg = JSON.parse(msgStr);
//                     uniqueMessages.set(msg.id.toString(), msg);
//                 } catch (e) {
//                     console.warn('Failed to parse message from Redis:', e);
//                 }
//             });
            
//             return Array.from(uniqueMessages.values())
//                 .reverse()
//                 .slice(0, limit);
                
//         } catch (error) {
//             console.warn('Redis failed, using fallback:', error.message);
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     const messages = fallbackStorage.get(sessionKey) || [];
    
//     // FIXED: Deduplicate fallback messages
//     const uniqueMessages = new Map();
//     messages.forEach(msg => {
//         uniqueMessages.set(msg.id.toString(), msg);
//     });
    
//     return Array.from(uniqueMessages.values())
//         .reverse()
//         .slice(0, limit);
// };

// // Clear session (with fallback)
// const clearRedisSession = async (sessionId) => {
//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
//             const deleted = await redisClient.del(sessionKey);
//             return deleted > 0;
//         } catch (error) {
//             console.warn('Redis failed, using fallback:', error.message);
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     const existed = fallbackStorage.has(sessionKey);
//     fallbackStorage.delete(sessionKey);
//     return existed;
// };

// // Session exists check (with fallback)
// const redisSessionExists = async (sessionId) => {
//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
//             return await redisClient.exists(sessionKey) === 1;
//         } catch (error) {
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     return fallbackStorage.has(sessionKey);
// };

// // FIXED: Get all messages with deduplication
// const getAllRedisSessionMessages = async (sessionId) => {
//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
//             const messages = await redisClient.lrange(sessionKey, 0, -1);
            
//             // FIXED: Parse and deduplicate
//             const uniqueMessages = new Map();
//             messages.forEach(msgStr => {
//                 try {
//                     const msg = JSON.parse(msgStr);
//                     uniqueMessages.set(msg.id.toString(), msg);
//                 } catch (e) {
//                     console.warn('Failed to parse message from Redis:', e);
//                 }
//             });
            
//             return Array.from(uniqueMessages.values()).reverse();
            
//         } catch (error) {
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     const messages = fallbackStorage.get(sessionKey) || [];
    
//     // FIXED: Deduplicate fallback messages
//     const uniqueMessages = new Map();
//     messages.forEach(msg => {
//         uniqueMessages.set(msg.id.toString(), msg);
//     });
    
//     return Array.from(uniqueMessages.values()).reverse();
// };

// module.exports = {
//     addMessageToRedis,
//     getSessionHistory,
//     clearRedisSession,
//     redisSessionExists,
//     getAllRedisSessionMessages,
//     isRedisAvailable: () => isRedisAvailable
// };

// services/redisService.js - ENHANCED VERSION with better duplicate prevention
const Redis = require('ioredis');

let redisClient = null;
let isRedisAvailable = false;

// Create Redis client with error handling
const createRedisClient = () => {
    try {
        const client = new Redis({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD,
            retryDelayOnFailure: (times) => Math.min(times * 50, 2000),
            maxRetriesPerRequest: 1,
            lazyConnect: true
        });

        client.on('connect', () => {
            console.log('✅ Redis connected');
            isRedisAvailable = true;
        });

        client.on('error', (err) => {
            console.warn('⚠️ Redis unavailable, using fallback mode:', err.message);
            isRedisAvailable = false;
        });

        return client;
    } catch (error) {
        console.warn('⚠️ Redis client creation failed, using fallback mode');
        isRedisAvailable = false;
        return null;
    }
};

// Initialize client
redisClient = createRedisClient();

// Fallback storage (in-memory)
const fallbackStorage = new Map();
const messageIdTracker = new Set(); // Track processed message IDs
const SESSION_TTL = 24 * 60 * 60; // 24 hours
const getSessionKey = (sessionId) => `chat_session:${sessionId}`;

// ENHANCED: Add message with comprehensive duplicate prevention
const addMessageToRedis = async (sessionId, message) => {
    // Generate unique ID if not provided
    const messageData = {
        id: message.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: message.timestamp || new Date().toISOString(),
        ...message
    };

    // ENHANCED: Global duplicate check
    const messageKey = `${sessionId}_${messageData.id}`;
    if (messageIdTracker.has(messageKey)) {
        console.log(`Message ${messageData.id} already processed globally, skipping...`);
        return messageData;
    }

    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            
            // ENHANCED: Check if message already exists with atomic operation
            const existingCheck = await redisClient.eval(`
                local messages = redis.call('lrange', KEYS[1], 0, -1)
                for i, msg in ipairs(messages) do
                    local parsed = cjson.decode(msg)
                    if parsed.id == ARGV[1] then
                        return 1
                    end
                end
                return 0
            `, 1, sessionKey, messageData.id.toString());

            if (existingCheck === 1) {
                console.log(`Message ${messageData.id} already exists in Redis, skipping...`);
                messageIdTracker.add(messageKey);
                return messageData;
            }

            // Add message if it doesn't exist
            await redisClient.lpush(sessionKey, JSON.stringify(messageData));
            await redisClient.expire(sessionKey, SESSION_TTL);
            
            messageIdTracker.add(messageKey);
            console.log(`Added message ${messageData.id} to Redis session ${sessionId}`);
            return messageData;
        } catch (error) {
            console.warn('Redis failed, using fallback:', error.message);
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    if (!fallbackStorage.has(sessionKey)) {
        fallbackStorage.set(sessionKey, []);
    }

    const sessionMessages = fallbackStorage.get(sessionKey);
    
    // ENHANCED: Check for duplicates in fallback storage
    const messageExists = sessionMessages.some(msg => 
        msg.id.toString() === messageData.id.toString()
    );

    if (messageExists) {
        console.log(`Message ${messageData.id} already exists in fallback storage, skipping...`);
        messageIdTracker.add(messageKey);
        return messageData;
    }

    sessionMessages.unshift(messageData);

    // Keep only last 100 messages in memory
    if (sessionMessages.length > 100) {
        sessionMessages.splice(100);
    }

    messageIdTracker.add(messageKey);
    console.log(`Added message ${messageData.id} to fallback storage session ${sessionId}`);
    return messageData;
};

// ENHANCED: Get session history with better deduplication
const getSessionHistory = async (sessionId, limit = 50) => {
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            const messages = await redisClient.lrange(sessionKey, 0, limit - 1);
            
            // ENHANCED: Parse and deduplicate messages with better tracking
            const uniqueMessages = new Map();
            const processedIds = new Set();
            
            messages.forEach(msgStr => {
                try {
                    const msg = JSON.parse(msgStr);
                    const msgId = msg.id.toString();
                    
                    if (!processedIds.has(msgId)) {
                        uniqueMessages.set(msgId, msg);
                        processedIds.add(msgId);
                    }
                } catch (e) {
                    console.warn('Failed to parse message from Redis:', e);
                }
            });
            
            const result = Array.from(uniqueMessages.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
                .slice(0, limit);
                
            console.log(`Retrieved ${result.length} unique messages from Redis for session ${sessionId}`);
            return result;
                
        } catch (error) {
            console.warn('Redis failed, using fallback:', error.message);
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    const messages = fallbackStorage.get(sessionKey) || [];
    
    // ENHANCED: Deduplicate fallback messages
    const uniqueMessages = new Map();
    const processedIds = new Set();
    
    messages.forEach(msg => {
        const msgId = msg.id.toString();
        if (!processedIds.has(msgId)) {
            uniqueMessages.set(msgId, msg);
            processedIds.add(msgId);
        }
    });
    
    const result = Array.from(uniqueMessages.values())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .slice(0, limit);
        
    console.log(`Retrieved ${result.length} unique messages from fallback for session ${sessionId}`);
    return result;
};

// ENHANCED: Clear session with better cleanup
const clearRedisSession = async (sessionId) => {
    // Clean up global message tracking for this session
    const sessionPrefix = `${sessionId}_`;
    const keysToRemove = [];
    
    messageIdTracker.forEach(key => {
        if (key.startsWith(sessionPrefix)) {
            keysToRemove.push(key);
        }
    });
    
    keysToRemove.forEach(key => messageIdTracker.delete(key));
    
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            const deleted = await redisClient.del(sessionKey);
            console.log(`Cleared Redis session ${sessionId}: ${deleted > 0 ? 'success' : 'not found'}`);
            return deleted > 0;
        } catch (error) {
            console.warn('Redis failed, using fallback:', error.message);
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    const existed = fallbackStorage.has(sessionKey);
    fallbackStorage.delete(sessionKey);
    console.log(`Cleared fallback session ${sessionId}: ${existed ? 'success' : 'not found'}`);
    return existed;
};

// Session exists check (with fallback)
const redisSessionExists = async (sessionId) => {
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            return await redisClient.exists(sessionKey) === 1;
        } catch (error) {
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    return fallbackStorage.has(sessionKey);
};

// ENHANCED: Get all messages with comprehensive deduplication
const getAllRedisSessionMessages = async (sessionId) => {
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            const messages = await redisClient.lrange(sessionKey, 0, -1);
            
            // ENHANCED: Parse and deduplicate with better tracking
            const uniqueMessages = new Map();
            const processedIds = new Set();
            
            messages.forEach(msgStr => {
                try {
                    const msg = JSON.parse(msgStr);
                    const msgId = msg.id.toString();
                    
                    if (!processedIds.has(msgId)) {
                        uniqueMessages.set(msgId, msg);
                        processedIds.add(msgId);
                    }
                } catch (e) {
                    console.warn('Failed to parse message from Redis:', e);
                }
            });
            
            const result = Array.from(uniqueMessages.values())
                .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                
            console.log(`Retrieved ${result.length} unique messages from Redis for backup ${sessionId}`);
            return result;
            
        } catch (error) {
            console.warn('Redis failed for getAllMessages:', error.message);
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    const messages = fallbackStorage.get(sessionKey) || [];
    
    // ENHANCED: Deduplicate fallback messages
    const uniqueMessages = new Map();
    const processedIds = new Set();
    
    messages.forEach(msg => {
        const msgId = msg.id.toString();
        if (!processedIds.has(msgId)) {
            uniqueMessages.set(msgId, msg);
            processedIds.add(msgId);
        }
    });
    
    const result = Array.from(uniqueMessages.values())
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
    console.log(`Retrieved ${result.length} unique messages from fallback for backup ${sessionId}`);
    return result;
};

// ENHANCED: Cleanup function to prevent memory leaks
const cleanupOldMessageTracking = () => {
    // Clean up message tracking older than 24 hours
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const keysToRemove = [];
    
    messageIdTracker.forEach(key => {
        // Extract timestamp from message key format: sessionId_timestamp_randomString
        const parts = key.split('_');
        if (parts.length >= 3) {
            const timestamp = parseInt(parts[1]);
            if (timestamp && timestamp < oneDayAgo) {
                keysToRemove.push(key);
            }
        }
    });
    
    keysToRemove.forEach(key => messageIdTracker.delete(key));
    console.log(`Cleaned up ${keysToRemove.length} old message tracking entries`);
};

// Run cleanup every hour
setInterval(cleanupOldMessageTracking, 60 * 60 * 1000);

module.exports = {
    addMessageToRedis,
    getSessionHistory,
    clearRedisSession,
    redisSessionExists,
    getAllRedisSessionMessages,
    isRedisAvailable: () => isRedisAvailable,
    cleanupOldMessageTracking
};