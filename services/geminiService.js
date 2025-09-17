// services/geminiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { calculateRelevanceScore } = require('../utils/searchRanking.js');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateAnswerWithContext(query, articles, topK = 3) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const topArticles = articles
            .map(article => ({
                ...article,
                relevanceScore: calculateRelevanceScore(article, query)
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, topK);

        // Prepare context from articles
        const context = articles.map((article, idx) =>
            `Article ${idx + 1}:
            Title: ${article.title}
            Description: ${article.description}
            Content: ${article.content || article.description}
            Source: ${article.url}
            ---`
        ).join('\n');

        const prompt = `Based on the following articles, provide a comprehensive answer to the user's query.

Query: "${query}"

Context Articles:
${context}

Instructions:
- Provide a detailed, well-structured answer based on the articles
- Include relevant facts and information from the sources
- Mention sources when referencing specific information
- If the articles don't fully answer the query, mention what information is available
- Keep the response informative and objective

Answer:`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return {
            answer: response.text(),
            sourcesUsed: topArticles.length,
            topSources: topArticles.map(a => ({
                title: a.title,
                url: a.url,
                relevanceScore: a.relevanceScore.toFixed(2)
            }))
        };

    } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error('Failed to generate AI response');
    }
}

module.exports = { generateAnswerWithContext };