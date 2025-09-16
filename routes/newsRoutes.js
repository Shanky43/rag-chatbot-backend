const express = require('express');
const router = express.Router();
const { fetchNews, saveNewsToDB } = require('../services/newsService');

router.get('/fetch-news', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.status(400).json({ success: false, message: "Missing search term 'q'" });
        }
        const articles = await fetchNews(searchTerm); // Pass searchTerm to fetchNews
        await saveNewsToDB(articles);
        res.status(200).json({ success: true, count: articles.length, articles });
    } catch (error) {
        console.log(error, " error in /fetch-news route");
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;