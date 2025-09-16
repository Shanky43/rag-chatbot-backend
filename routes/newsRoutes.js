const express = require('express');
const router = express.Router();
const { fetchNews, saveNewsToDB } = require('../services/newsService');
const prisma = require('../services/prismaService');
const { getJinaEmbeddings } = require('../services/jinaService');
const { syncToQdrant } = require('../services/qdrantService.JS');
const { searchQdrant } = require('../services/qdrantService.JS');

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

router.get('/all-articles', async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const articles = await prisma.article.findMany({
            skip: skip,
            take: limit,
            orderBy: { published_at: 'desc' }
        });

        const totalCount = await prisma.article.count();

        res.status(200).json({
            status: 'success',
            totalCount: totalCount,
            page: page,
            limit: limit,
            articles: articles
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Failed to fetch articles' });
    }
});

//sync the jina embeddings with qdrant, by update the synced status
const BATCH_SIZE = 20;
router.post('/jina-sync', async (req, res) => {
    try {
        const unsyncedArticles = await prisma.article.findMany({
            where: { is_synced: false }
        });
        for (let i = 0; i < unsyncedArticles.length; i += BATCH_SIZE) {
            const batch = unsyncedArticles.slice(i, i + BATCH_SIZE);
            const contents = batch.map(a => a.content || "");
            const embeddings = await getJinaEmbeddings(contents)

            const syncArticles = batch.map((article, id) => {
                const embedding = embeddings[id];
                const syncPayload = {
                    source_name: article.source_name,
                    author: article.author,
                    title: article.title,
                    description: article.description,
                    urlToImage: article.urlToImage,
                    url: article.url,
                    published_at: article.published_at.toISOString(),
                    content: article.content
                }

                return syncToQdrant(id, embedding, syncPayload).then(() => {
                    prisma.article.update({
                        where: { id: article.id },
                        data: { is_synced: true, synced_at: new Date() }
                    })
                }).catch((error) => {
                    console.error(error, "syncing error")
                })
            })
            await Promise.all(syncArticles)

        }
        res.json({ status: 'success', synced: unsyncedArticles?.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: 'error', message: 'Sync failed' });
    }
})

//search the synced data in qdrant by converting the query into embeddings, which does the vector search
router.post("/search", async (req, res) => {
    const searchTerm = req.query.q;
    if (searchTerm) {
        return res.status(404).json({ message: "enter the valid search" })
    }
    try {

        const [queryEmbedding] = await getJinaEmbeddings([searchTerm]);
        const searchResult = await searchQdrant(queryEmbedding, 5);
        if (searchResult.length > 0) {
            return res.json({
                source: 'qdrant',
                articles: searchResults.map(r => r.payload)
            });
        }

        const freshArticles = await fetchFromNewsApi(query);
        if (freshArticles.length === 0) {
            return res.status(404).json({ message: 'No articles found.' });
        }
        const contents = freshArticles.map(a => a.content || '');
        const embeddings = await getJinaEmbeddings(contents);
        const dbSyncPromises = freshArticles.map((article, idx) =>
            prisma.article.create({
                data: {
                    id: article.id,
                    source_name: article.source_name,
                    author: article.author,
                    title: article.title,
                    description: article.description,
                    urlToImage: article.urlToImage,
                    url: article.url,
                    published_at: new Date(article.published_at),
                    content: article.content,
                    is_synced: true,
                    synced_at: new Date()
                }
            }).then(createdArticle =>
                syncToQdrant(createdArticle.id, embeddings[idx], {
                    source_name: createdArticle.source_name,
                    author: createdArticle.author,
                    title: createdArticle.title,
                    description: createdArticle.description,
                    urlToImage: createdArticle.urlToImage,
                    url: createdArticle.url,
                    published_at: createdArticle.published_at.toISOString(),
                    content: createdArticle.content
                })
            )
        );

        await Promise.all(dbSyncPromises);

        res.json({
            source: 'newsapi',
            articles: freshArticles
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Search failed.' });
    }
})

module.exports = router;