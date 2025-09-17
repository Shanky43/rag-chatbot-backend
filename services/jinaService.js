const { default: axios } = require("axios");

async function getJinaEmbeddings(textsArray) {
    const apiKey = process.env.JINA_API_KEY;
    const apiURL = process.env.JINA_API_URL;

    const payload = {
        model: 'jina-embeddings-v3',
        task: 'text-matching',
        input: textsArray
    };

    try {
        const response = await axios.post(apiURL, payload, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        console.log("Full response.data:", response.data);

        if (!response.data || !response.data.data) {
            throw new Error("Embeddings not found in response");
        }

        const embeddings = response.data.data.map(item => item.embedding);
        return embeddings;

    } catch (error) {
        console.error("Error in Jina embedding setup:", error.response?.data || error.message);
        return [];
    }
}

module.exports = { getJinaEmbeddings };
