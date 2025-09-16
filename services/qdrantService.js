const axios = require('axios');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'articles';

async function ensureCollectionExists(embeddingSize) {
    try {
        const response = await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
            headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
        });
        console.log(`Collection '${COLLECTION_NAME}' exists`);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`Collection '${COLLECTION_NAME}' not found. Creating...`);
            const createResponse = await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
                vectors: {
                    size: embeddingSize,
                    distance: "Cosine"
                }
            }, {
                headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
            });
            console.log(`Collection '${COLLECTION_NAME}' created`);
            return true;
        } else {
            console.error('Error checking/creating collection:', error);
            throw error;
        }
    }
}

async function syncToQdrant(id, embedding, payload) {
    console.log("id: ", id, "embedding:", embedding, "payload:", payload)
    if (!embedding || !embedding.length) {
        throw new Error('Embedding is empty or undefined');
    }

    await ensureCollectionExists(embedding.length);

    const body = {
        points: [{
            id: id.toString(),
            vector: embedding,
            payload
        }]
    };

    try {
        const response = await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, body, {
            headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
        });
        console.log('Synced to Qdrant:', response.data);
    } catch (error) {
        console.error('Error occurred in syncToQdrant:', error.response?.data || error.message);
    }
}

async function searchQdrant(embedding, topK = 5) {
    console.log("embedding in search qdrant", embedding)
    if (!embedding || !embedding?.length) {
        throw new Error('Embedding is empty or undefined');
    }

    await ensureCollectionExists(embedding.length);

    const apiUrl = `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`;
    try {
        const response = await axios.post(apiUrl, {
            vector: embedding,
            top: topK,
            include_payload: true
        }, {
            headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
        });
        return response.data.result;
    } catch (error) {
        console.error('Error in searchQdrant:', error.response?.data || error.message);
    }
}

module.exports = { syncToQdrant, searchQdrant };
