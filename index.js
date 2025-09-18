
const { PrismaClient } = require('@prisma/client');
const express = require('express');
const cors = require("cors");
const morgan = require('morgan');
const http = require('http');
const socketIo = require('socket.io');

require('dotenv').config();

// Import routes and functional components
const { setupSocketHandlers } = require('./socket/socketHandler.js');
const newsRoutes = require('./routes/newsRoutes');
const chatRoutes = require('./routes/chatRoutes');

const prisma = new PrismaClient()
const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));


// Configure Socket.IO
// const io = socketIo(server, {
//     cors: {
//         origin: process.env.FRONTEND_URL || "http://localhost:3000",
//         methods: ["GET", "POST"],
//         credentials: true
//     }
// });
const io = socketIo(server, {
    cors: {
        origin: "*"
    }
});


app.get("/test-connection", async (req, res) => {
    try {
        const response = await prisma.$queryRaw`SELECT NOW()`;
        res.status(200).json({ status: "success", time: response.rows[0] });
    } catch (error) {
        console.error("Error testing connection", error);
        res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

// app.use('/api/news', newsRoutes);
app.use('/api/v1', newsRoutes);
app.use('/api/v1/chat', chatRoutes);

app.get('/health', (req, res) => {
    const { isRedisAvailable } = require('./services/redisService');

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            server: 'running',
            redis: isRedisAvailable() ? 'connected' : 'fallback_mode',
            socket: 'active',
            database: 'connected'
        }
    });
});

// Initialize Socket.IO with functional handler
setupSocketHandlers(io);
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server, io };