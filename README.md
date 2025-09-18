# RAG-Powered News Chatbot - Backend Code Base

A comprehensive Retrieval-Augmented Generation (RAG) chatbot system that provides intelligent responses to news queries using real-time data retrieval and AI-powered answer generation.

**🌐 Live API**: [rag-chatbot-backend-oxlx.onrender.com](https://rag-chatbot-backend-oxlx.onrender.com)  
**🔗 Frontend Application**: [rag-chatbot-frontend-lake.vercel.app](https://rag-chatbot-frontend-lake.vercel.app)

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Usage](#usage)
- [WebSocket Events](#websocket-events)
- [Deployment](#deployment)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Overview

This project implements a sophisticated RAG (Retrieval-Augmented Generation) pipeline that enables users to query news articles and receive AI-generated responses based on relevant context. The system combines real-time news retrieval, semantic search, and intelligent response generation to create a comprehensive news chatbot experience.

### Key Capabilities
- Real-time news article retrieval and processing
- Intelligent semantic search using vector embeddings
- AI-powered response generation with context awareness
- Multi-tier search strategy (Database → Vector Search → External APIs)
- Session-based chat management with persistent storage
- Real-time WebSocket communication

## Features

### Smart Search Pipeline
- **Multi-layered Search**: Database → Qdrant Vector Search → News API fallback
- **Semantic Understanding**: Jina AI embeddings for contextual matching
- **Relevance Scoring**: Advanced article ranking based on query relevance

### AI-Powered Responses
- **Context-Aware Generation**: Google Gemini AI for intelligent responses
- **Source Attribution**: Transparent source referencing and citation
- **Fallback Mechanisms**: Graceful degradation when AI services are unavailable

### Real-Time Communication
- **WebSocket Integration**: Instant message delivery and status updates
- **Session Management**: Persistent chat sessions with unique identifiers
- **Live Status Updates**: Real-time search progress indicators

### Data Management
- **Hybrid Storage**: Redis for active sessions, PostgreSQL for persistence
- **Vector Database**: Qdrant for semantic search capabilities
- **Automatic Backup**: Session data backup on disconnection

### Scalability Features
- **Duplicate Prevention**: Advanced message deduplication across all layers
- **Error Recovery**: Comprehensive error handling and retry mechanisms
- **Performance Optimization**: Efficient batch processing and caching

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (Socket.IO)   │◄──►│   (Express.js)  │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                       ┌────────▼────────┐              │
                       │ WebSocket Layer │              │
                       │ (Real-time)     │              │
                       └────────┬────────┘              │
                                │                        │
                    ┌───────────▼───────────┐           │
                    │    Search Pipeline    │           │
                    │  1. Database Search   │           │
                    │  2. Vector Search     │           │
                    │  3. News API Fetch    │           │
                    └───────────┬───────────┘           │
                                │                        │
        ┌───────────────────────┼───────────────────────┼──────────────┐
        │                       │                        │              │
┌───────▼────────┐    ┌────────▼────────┐    ┌─────────▼──────┐    ┌──▼─────┐
│ PostgreSQL     │    │ Redis Cache     │    │ Qdrant Vector  │    │ AI APIs│
│ (Persistence)  │    │ (Sessions)      │    │ Database       │    │        │
└────────────────┘    └─────────────────┘    └────────────────┘    └────────┘
```

## Technology Stack

### Backend
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Real-time**: Socket.IO
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis (with fallback to in-memory)
- **Vector DB**: Qdrant

### AI & ML
- **Embeddings**: Jina AI (jina-embeddings-v3)
- **LLM**: Google Gemini 1.5 Flash
- **Search**: Semantic vector similarity

### External APIs
- **News Data**: News API
- **Vector Operations**: Qdrant Cloud/Self-hosted

### DevOps & Tools
- **Process Management**: PM2 (recommended)
- **Monitoring**: Morgan logging
- **Environment**: dotenv
- **HTTP Client**: Axios

## Prerequisites

- **Node.js**: Version 18.0 or higher
- **PostgreSQL**: Version 13 or higher
- **Redis**: Version 6 or higher (optional, has fallback)
- **Qdrant**: Vector database instance

### Required API Keys
- News API key from [newsapi.org](https://newsapi.org)
- Jina AI API key from [jina.ai](https://jina.ai)
- Google Gemini API key from [ai.google.dev](https://ai.google.dev)
- Qdrant instance (cloud or self-hosted)

## Live Application

### Backend Deployment
- **Platform**: Render
- **URL**: [rag-chatbot-backend-oxlx.onrender.com](https://rag-chatbot-backend-oxlx.onrender.com)
- **Health Check**: [/health endpoint](https://rag-chatbot-backend-oxlx.onrender.com/health)
- **Features**: 
  - Automatic deployments from main branch
  - PostgreSQL database integration
  - Environment variables management
  - SSL/HTTPS enabled
  - 24/7 uptime monitoring

### Frontend Integration
- **Platform**: Vercel
- **URL**: [rag-chatbot-frontend-lake.vercel.app](https://rag-chatbot-frontend-lake.vercel.app)
- **WebSocket Connection**: Real-time communication with deployed backend

## Installation

### 1. Clone Repository
```bash
git clone <repository-url>
cd rag-news-chatbot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# (Optional) Seed database
npx prisma db seed
```

### 4. Environment Configuration
Create a `.env` file in the root directory:

```env
# Database
POSTGRES_URL="postgresql://username:password@localhost:5432/rag_chatbot"

# Redis (optional - has fallback)
REDIS_HOST="localhost"
REDIS_PORT="6379"
REDIS_PASSWORD=""

# API Keys
NEWS_API_KEY="your_news_api_key"
NEWS_API="https://newsapi.org/v2/"
JINA_API_KEY="your_jina_api_key"
JINA_API_URL="https://api.jina.ai/v1/embeddings"
GEMINI_API_KEY="your_gemini_api_key"

# Qdrant
QDRANT_URL="https://your-cluster-url.qdrant.tech"
QDRANT_API_KEY="your_qdrant_api_key"

# Server
PORT="5000"
NODE_ENV="production"
FRONTEND_URL="http://localhost:3000"
```

### 5. Start Application
```bash
# Development
npm run dev

# Production
npm start
```

## API Documentation

### Authentication
Currently, no authentication is required. Each session is identified by a unique session ID.

### Base URL
```
# Production API
https://rag-chatbot-backend-oxlx.onrender.com/api/v1

# Local Development
http://localhost:5000/api/v1
```

### Endpoints

#### Chat Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/chat/sessions` | List all chat sessions |
| `POST` | `/chat/sessions` | Create new chat session |
| `GET` | `/chat/sessions/:id/history` | Get session message history |
| `DELETE` | `/chat/sessions/:id` | Delete entire session |
| `DELETE` | `/chat/sessions/:id/cache` | Clear session cache only |
| `POST` | `/chat/sessions/:id/backup` | Manual session backup |

#### News & Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/fetch-news?q={query}` | Fetch and store news articles |
| `GET` | `/all-articles` | Get paginated articles list |
| `POST` | `/search?q={query}` | Search articles with AI response |
| `POST` | `/jina-sync` | Sync articles to vector database |

### Example Requests

#### Create Chat Session
```bash
# Production API
curl -X POST https://rag-chatbot-backend-oxlx.onrender.com/api/v1/chat/sessions \
  -H "Content-Type: application/json"

# Local Development
curl -X POST http://localhost:5000/api/v1/chat/sessions \
  -H "Content-Type: application/json"
```

#### Search with AI Response
```bash
# Production API
curl -X POST "https://rag-chatbot-backend-oxlx.onrender.com/api/v1/search?q=climate%20change" \
  -H "Content-Type: application/json"

# Local Development  
curl -X POST "http://localhost:5000/api/v1/search?q=climate%20change" \
  -H "Content-Type: application/json"
```

#### Get Session History
```bash
# Production API
curl -X GET https://rag-chatbot-backend-oxlx.onrender.com/api/v1/chat/sessions/{sessionId}/history \
  -H "Content-Type: application/json"

# Local Development
curl -X GET http://localhost:5000/api/v1/chat/sessions/{sessionId}/history \
  -H "Content-Type: application/json"
```

## Database Schema

### Tables

#### Articles
```sql
CREATE TABLE "Article" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "author" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "urlToImage" TEXT,
  "url" TEXT NOT NULL,
  "content" TEXT,
  "published_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "source_name" TEXT,
  "is_synced" BOOLEAN DEFAULT FALSE,
  "synced_at" TIMESTAMP
);
```

#### Chat Sessions
```sql
CREATE TABLE "chat_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" TEXT UNIQUE NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);
```

#### Chat Messages
```sql
CREATE TABLE "chat_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "session_id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "timestamp" TIMESTAMP NOT NULL,
  "metadata" TEXT,
  UNIQUE("session_id", "message_id")
);
```

### Indexes
- `chat_messages(session_id, timestamp)` - Fast session message retrieval
- `Article(is_synced)` - Efficient sync status queries
- `Article(published_at)` - Chronological article sorting

## Usage

### Starting a Chat Session

1. **Connect via WebSocket**:
```javascript
// Production WebSocket connection
const socket = io('https://rag-chatbot-backend-oxlx.onrender.com');

// Local development
// const socket = io('http://localhost:5000');

// Join a session
socket.emit('join_session', { 
  sessionId: 'optional-existing-id' // If not provided, new session is created
});
```

2. **Send Messages**:
```javascript
socket.emit('send_message', {
  sessionId: 'your-session-id',
  message: 'What are the latest news about climate change?'
});
```

3. **Listen for Responses**:
```javascript
socket.on('new_message', (message) => {
  console.log('New message:', message);
});

socket.on('status_update', (status) => {
  console.log('Status:', status);
});
```

### Search Pipeline Flow

1. **Database Search**: Query existing articles for keyword matches
2. **Vector Search**: If no results, perform semantic search using Qdrant
3. **External Fetch**: If still no results, fetch fresh articles from News API
4. **AI Processing**: Generate contextual response using most relevant article
5. **Response Delivery**: Stream response with source attribution

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_session` | `{sessionId?}` | Join or create chat session |
| `send_message` | `{sessionId, message}` | Send user message |
| `get_history` | `{sessionId, limit?, offset?}` | Request message history |
| `clear_session` | `{sessionId}` | Clear session cache |
| `ping` | `{}` | Health check |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `session_joined` | `{sessionId, history}` | Session join confirmation |
| `new_message` | `{id, content, sender, timestamp}` | New chat message |
| `status_update` | `{status, message, visible}` | Search progress updates |
| `session_cleared` | `{sessionId}` | Cache clear confirmation |
| `pong` | `{timestamp, serverTime}` | Health check response |

### Status Update Types

- `initializing` - Search starting
- `analyzing` - Processing query semantically
- `fetching` - Retrieving external data
- `found` - Results discovered
- `processing` - Selecting relevant content
- `generating` - AI response creation
- `complete` - Process finished
- `error` - Error occurred

## Deployment

### Production Environment

#### Current Deployment
- **Backend**: Deployed on **Render** - [rag-chatbot-backend-oxlx.onrender.com](https://rag-chatbot-backend-oxlx.onrender.com)
- **Frontend**: Deployed on **Vercel** - [rag-chatbot-frontend-lake.vercel.app](https://rag-chatbot-frontend-lake.vercel.app)
- **Database**: PostgreSQL on Render
- **Cache**: Redis (with in-memory fallback)

### Docker Deployment (Alternative)

1. **Create Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npx prisma generate
EXPOSE 5000
CMD ["npm", "start"]
```

2. **Docker Compose**:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
      
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: rag_chatbot
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] SSL certificates installed
- [ ] Reverse proxy configured (Nginx/Cloudflare)
- [ ] Process manager setup (PM2)
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Log rotation configured

#### Render Deployment Configuration
```yaml
# render.yaml
services:
  - type: web
    name: rag-chatbot-backend
    env: node
    buildCommand: npm install && npx prisma generate && npx prisma migrate deploy
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: POSTGRES_URL
        fromDatabase:
          name: rag-chatbot-db
          property: connectionString
      - key: REDIS_HOST
        fromService:
          type: redis
          name: rag-chatbot-redis
          property: host
```

### Environment-Specific Configurations

#### Production (Render)
```env
NODE_ENV=production
LOG_LEVEL=error
POSTGRES_URL=postgresql://user:pass@hostname:port/database
FRONTEND_URL=https://rag-chatbot-frontend-lake.vercel.app
```

## Performance

### Optimization Strategies

1. **Database Indexing**: Optimized indexes for session and article queries
2. **Connection Pooling**: Prisma connection pooling for database efficiency
3. **Redis Caching**: Session data cached for fast retrieval
4. **Vector Search**: Efficient semantic search with Qdrant
5. **Batch Processing**: Articles processed in configurable batches

### Performance Metrics

- **Message Processing**: ~2-5 seconds end-to-end
- **Database Queries**: <100ms for indexed queries
- **Vector Search**: ~200-500ms for semantic matching
- **AI Response**: 2-8 seconds depending on context size
- **Concurrent Sessions**: Supports 100+ concurrent users

### Scaling Considerations

- **Horizontal Scaling**: Stateless design enables easy horizontal scaling
- **Database Sharding**: Session data can be sharded by session_id
- **Cache Distribution**: Redis cluster for distributed caching
- **Load Balancing**: WebSocket sticky sessions recommended

## Troubleshooting

### Common Issues

#### 1. WebSocket Connection Failures
```
Error: WebSocket connection failed
```
**Solutions**:
- Check CORS configuration
- Verify port accessibility
- Review firewall settings
- Check for proxy interference

#### 2. Database Connection Issues
```
Error: Can't reach database server
```
**Solutions**:
- Verify POSTGRES_URL format
- Check PostgreSQL service status
- Review connection pool limits
- Validate credentials

#### 3. Redis Unavailable (Graceful Degradation)
```
Warning: Redis unavailable, using fallback mode
```
**Behavior**: Application continues with in-memory storage
**Solutions**:
- Check Redis connection parameters
- Verify Redis service status
- Review authentication settings

#### 4. AI Service Failures
```
Error: Gemini API overloaded (503)
```
**Behavior**: Automatic retry with exponential backoff
**Solutions**:
- Wait for service recovery
- Check API key quotas
- Review rate limits

#### 5. Vector Database Issues
```
Error: Qdrant collection not found
```
**Solutions**:
- Check Qdrant URL and API key
- Verify collection exists
- Review embedding dimensions

### Debug Mode

Enable debug logging:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Health Check Endpoint

Monitor application health:
```bash
# Production API
curl https://rag-chatbot-backend-oxlx.onrender.com/health

# Local Development
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "server": "running",
    "redis": "connected",
    "socket": "active",
    "database": "connected"
  }
}
```

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test thoroughly
4. Commit changes: `git commit -m 'Add amazing feature'`
5. Push to branch: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style

- **ESLint**: Follow provided linting rules
- **Prettier**: Use for code formatting
- **Naming**: Use camelCase for JavaScript, snake_case for database
- **Comments**: Document complex logic and API interactions

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## License

This project is open source and available under the [MIT License](LICENSE).

```
Copyright (c) 2024 RAG-Powered News Chatbot

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## Support & Contact

For technical support and questions:

- Create an issue in the GitHub repository
- Check the troubleshooting section above
- Review the health endpoint: `/health`
- Verify environment variables
- Check application logs