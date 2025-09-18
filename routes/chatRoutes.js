
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { addMessageToRedis, redisSessionExists, clearRedisSession } = require('../services/redisService');
const { createChatSession, getCombinedChatHistory, backupSessionToDb, deleteChatSession, getSessionDbStats } = require('../services/chatDbService');



router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to the RAG Chatbot API',
        endpoints: {
            createSession: 'POST /sessions',
            getAllSessions: 'GET /sessions',
            getSessionHistory: 'GET /sessions/:sessionId/history',
            clearSessionCache: 'DELETE /sessions/:sessionId/cache',
            deleteSession: 'DELETE /sessions/:sessionId',
            backupSession: 'POST /sessions/:sessionId/backup',
            health: '/health'
        }
    });
});

// Get all chat sessions with basic info
router.get('/sessions', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const sessions = await require('../services/chatDbService').getAllChatSessions(parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            sessions,
            total: sessions.length
        });
    } catch (error) {
        console.error('Error getting sessions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get sessions'
        });
    }
});



// Create new chat session
router.post('/sessions', async (req, res) => {
    try {
        const sessionId = uuidv4();

        // Create session in DB
        await createChatSession(sessionId);

        // Add initial system message to Redis
        await addMessageToRedis(sessionId, {
            type: 'system',
            content: 'Hello! I\'m your RAG-powered news chatbot. Ask me about any recent news, current events, or topics you\'re curious about!',
            sender: 'system'
        });

        res.status(201).json({
            success: true,
            sessionId,
            message: 'Chat session created successfully'
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create session'
        });
    }
});

// Get combined session history (Redis + DB)
router.get('/sessions/:sessionId/history', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { limit = 50 } = req.query;

        const history = await getCombinedChatHistory(sessionId, parseInt(limit));
        const stats = await getSessionDbStats(sessionId);

        res.json({
            success: true,
            sessionId,
            history,
            stats,
            total: history.length
        });
    } catch (error) {
        console.error('Error getting session history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get session history'
        });
    }
});

// Clear Redis cache (keep DB history)
router.delete('/sessions/:sessionId/cache', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const cleared = await clearRedisSession(sessionId);

        res.json({
            success: true,
            message: cleared ? 'Session cache cleared' : 'Session cache was already empty'
        });
    } catch (error) {
        console.error('Error clearing session cache:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear session cache'
        });
    }
});

// Delete entire session (Redis + DB)
router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        // Clear Redis first
        await clearRedisSession(sessionId);

        // Delete from DB
        const deleted = await deleteChatSession(sessionId);

        res.json({
            success: true,
            message: deleted ? 'Session deleted successfully' : 'Session not found'
        });
    } catch (error) {
        console.error('Error deleting session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete session'
        });
    }
});

// Backup Redis session to DB manually
router.post('/sessions/:sessionId/backup', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const { getAllRedisSessionMessages } = require('../services/redisService');
        const messages = await getAllRedisSessionMessages(sessionId);

        if (messages.length === 0) {
            return res.json({
                success: true,
                message: 'No messages to backup'
            });
        }

        const backedUpCount = await backupSessionToDb(sessionId, messages);

        res.json({
            success: true,
            message: `Backed up ${backedUpCount} messages`,
            backedUpCount
        });
    } catch (error) {
        console.error('Error backing up session:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to backup session'
        });
    }
});

module.exports = router;