
const axios = require('axios');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = 'articles';

async function ensureCollectionExists(embeddingSize) {
    try {
        const response = await axios.get(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
            headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
        });

        // Check if the existing collection has the correct vector size
        const existingSize = response.data.result.config.params.vectors.size;
        if (existingSize !== embeddingSize) {
            console.log(`Collection '${COLLECTION_NAME}' exists but has wrong vector size (${existingSize} vs ${embeddingSize}). Recreating...`);

            // Delete existing collection
            await axios.delete(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
                headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
            });
            console.log(`Collection '${COLLECTION_NAME}' deleted`);

            // Create new collection with correct size
            await createCollection(embeddingSize);
            return true;
        }

        console.log(`Collection '${COLLECTION_NAME}' exists with correct vector size: ${existingSize}`);
        return true;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.log(`Collection '${COLLECTION_NAME}' not found. Creating...`);
            await createCollection(embeddingSize);
            return true;
        } else {
            console.error('Error checking/creating collection:', error.response?.data || error.message);
            throw error;
        }
    }
}

async function createCollection(embeddingSize) {
    try {
        const createResponse = await axios.put(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
            vectors: {
                size: embeddingSize,
                distance: "Cosine"
            }
        }, {
            headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
        });
        console.log(`Collection '${COLLECTION_NAME}' created with vector size: ${embeddingSize}`);
        return createResponse;
    } catch (error) {
        console.error('Error creating collection:', error.response?.data || error.message);
        throw error;
    }
}

async function syncToQdrant(id, embedding, payload) {
    console.log("id: ", id, "embedding length:", embedding?.length, "payload:", payload);

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
        return response.data;
    } catch (error) {
        console.error('Error occurred in syncToQdrant:', error.response?.data || error.message);
        throw error;
    }
}

async function searchQdrant(embedding, topK = 5) {
    console.log("embedding length in search:", embedding?.length);

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
        throw error;
    }
}

module.exports = { syncToQdrant, searchQdrant };
