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
        return response.data.embeddings;
    } catch (error) {
        console.error(error, "error in jina embedding setup")
    }

}
module.exports = { getJinaEmbeddings };