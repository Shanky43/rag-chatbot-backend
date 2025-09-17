// // services/redisService.js
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
//             maxRetriesPerRequest: 1, // Reduced retries
//             lazyConnect: true // Don't connect immediately
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

// // Add message (with fallback)
// const addMessageToRedis = async (sessionId, message) => {
//     const messageData = {
//         id: Date.now(),
//         timestamp: new Date().toISOString(),
//         ...message
//     };

//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
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
//     fallbackStorage.get(sessionKey).unshift(messageData);

//     // Keep only last 100 messages in memory
//     if (fallbackStorage.get(sessionKey).length > 100) {
//         fallbackStorage.get(sessionKey).splice(100);
//     }

//     return messageData;
// };

// // Get session history (with fallback)
// const getSessionHistory = async (sessionId, limit = 50) => {
//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
//             const messages = await redisClient.lrange(sessionKey, 0, limit - 1);
//             return messages.map(msg => JSON.parse(msg)).reverse();
//         } catch (error) {
//             console.warn('Redis failed, using fallback:', error.message);
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     const messages = fallbackStorage.get(sessionKey) || [];
//     return messages.slice().reverse().slice(0, limit);
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

// // Get all messages (with fallback)
// const getAllRedisSessionMessages = async (sessionId) => {
//     if (isRedisAvailable && redisClient) {
//         try {
//             const sessionKey = getSessionKey(sessionId);
//             const messages = await redisClient.lrange(sessionKey, 0, -1);
//             return messages.map(msg => JSON.parse(msg)).reverse();
//         } catch (error) {
//             isRedisAvailable = false;
//         }
//     }

//     // Fallback to in-memory storage
//     const sessionKey = getSessionKey(sessionId);
//     const messages = fallbackStorage.get(sessionKey) || [];
//     return messages.slice().reverse();
// };

// module.exports = {
//     addMessageToRedis,
//     getSessionHistory,
//     clearRedisSession,
//     redisSessionExists,
//     getAllRedisSessionMessages,
//     isRedisAvailable: () => isRedisAvailable
// };

// services/redisService.js - FIXED VERSION
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
const SESSION_TTL = 24 * 60 * 60; // 24 hours
const getSessionKey = (sessionId) => `chat_session:${sessionId}`;

// FIXED: Add message with duplicate prevention
const addMessageToRedis = async (sessionId, message) => {
    // FIXED: Use the provided ID if available, otherwise generate one
    const messageData = {
        id: message.id || Date.now(),
        timestamp: message.timestamp || new Date().toISOString(),
        ...message
    };

    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            
            // FIXED: Check if message already exists in Redis
            const existingMessages = await redisClient.lrange(sessionKey, 0, -1);
            const messageExists = existingMessages.some(msgStr => {
                try {
                    const existingMsg = JSON.parse(msgStr);
                    return existingMsg.id.toString() === messageData.id.toString();
                } catch (e) {
                    return false;
                }
            });

            if (messageExists) {
                console.log(`Message ${messageData.id} already exists in Redis, skipping...`);
                return messageData;
            }

            await redisClient.lpush(sessionKey, JSON.stringify(messageData));
            await redisClient.expire(sessionKey, SESSION_TTL);
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
    
    // FIXED: Check for duplicates in fallback storage
    const messageExists = sessionMessages.some(msg => 
        msg.id.toString() === messageData.id.toString()
    );

    if (messageExists) {
        console.log(`Message ${messageData.id} already exists in fallback storage, skipping...`);
        return messageData;
    }

    sessionMessages.unshift(messageData);

    // Keep only last 100 messages in memory
    if (sessionMessages.length > 100) {
        sessionMessages.splice(100);
    }

    return messageData;
};

// FIXED: Get session history with deduplication
const getSessionHistory = async (sessionId, limit = 50) => {
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            const messages = await redisClient.lrange(sessionKey, 0, limit - 1);
            
            // FIXED: Parse and deduplicate messages
            const uniqueMessages = new Map();
            messages.forEach(msgStr => {
                try {
                    const msg = JSON.parse(msgStr);
                    uniqueMessages.set(msg.id.toString(), msg);
                } catch (e) {
                    console.warn('Failed to parse message from Redis:', e);
                }
            });
            
            return Array.from(uniqueMessages.values())
                .reverse()
                .slice(0, limit);
                
        } catch (error) {
            console.warn('Redis failed, using fallback:', error.message);
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    const messages = fallbackStorage.get(sessionKey) || [];
    
    // FIXED: Deduplicate fallback messages
    const uniqueMessages = new Map();
    messages.forEach(msg => {
        uniqueMessages.set(msg.id.toString(), msg);
    });
    
    return Array.from(uniqueMessages.values())
        .reverse()
        .slice(0, limit);
};

// Clear session (with fallback)
const clearRedisSession = async (sessionId) => {
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            const deleted = await redisClient.del(sessionKey);
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

// FIXED: Get all messages with deduplication
const getAllRedisSessionMessages = async (sessionId) => {
    if (isRedisAvailable && redisClient) {
        try {
            const sessionKey = getSessionKey(sessionId);
            const messages = await redisClient.lrange(sessionKey, 0, -1);
            
            // FIXED: Parse and deduplicate
            const uniqueMessages = new Map();
            messages.forEach(msgStr => {
                try {
                    const msg = JSON.parse(msgStr);
                    uniqueMessages.set(msg.id.toString(), msg);
                } catch (e) {
                    console.warn('Failed to parse message from Redis:', e);
                }
            });
            
            return Array.from(uniqueMessages.values()).reverse();
            
        } catch (error) {
            isRedisAvailable = false;
        }
    }

    // Fallback to in-memory storage
    const sessionKey = getSessionKey(sessionId);
    const messages = fallbackStorage.get(sessionKey) || [];
    
    // FIXED: Deduplicate fallback messages
    const uniqueMessages = new Map();
    messages.forEach(msg => {
        uniqueMessages.set(msg.id.toString(), msg);
    });
    
    return Array.from(uniqueMessages.values()).reverse();
};

module.exports = {
    addMessageToRedis,
    getSessionHistory,
    clearRedisSession,
    redisSessionExists,
    getAllRedisSessionMessages,
    isRedisAvailable: () => isRedisAvailable
};