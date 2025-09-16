const axios = require('axios');

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

async function syncToQdrant(id, embedding, payload) {
    const body = {
        points: [{
            id: id.toString(),
            vector: embedding,
            payload
        }]
    };

    try {
        await axios.put(`${QDRANT_URL}/collections/articles/points`, body, {
            headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }

        });
    } catch (error) {
        console.error(error, "error occurred in syncToQdrant")
    }
}

async function searchQdrant(embedding, topK = 5) {
    const apiUrl = `${QDRANT_URL}/collections/articles/points/search`;
    const response = await axios.post(apiUrl, {
        vector: embedding,
        top: topK,
        include_payload: true
    }, {
        headers: { 'Authorization': `Bearer ${QDRANT_API_KEY}` }
    });

    return response.data.result;
}

module.exports = { syncToQdrant, searchQdrant };
