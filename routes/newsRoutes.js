const express = require('express');
const router = express.Router();
const { fetchNews, saveNewsToDB } = require('../services/newsService');
const prisma = require('../services/prismaService');
const { getJinaEmbeddings } = require('../services/jinaService');

const { generateAnswerWithContext } = require('../services/geminiService.js');
const { selectMostRelevantArticle } = require('../utils/searchRanking.js');
const { normalizeArticleData } = require('../utils/articleNormalizer.js');

const { syncToQdrant } = require('../services/qdrantService.JS');
const { searchQdrant } = require('../services/qdrantService.JS');


router.get('/fetch-news', async (req, res) => {
    try {
        const searchTerm = req.query.q;
        if (!searchTerm) {
            return res.status(400).json({ success: false, message: "Missing search term 'q'" });
        }
        const articles = await fetchNews(searchTerm);
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

// Sync the jina embeddings with qdrant, by updating the synced status
const BATCH_SIZE = 20;

router.post('/jina-sync', async (req, res) => {
    try {
        const unsyncedArticles = await prisma.article.findMany({
            where: { is_synced: false }
        });

        if (unsyncedArticles.length === 0) {
            return res.status(200).json({ status: "success", message: "No article to sync" });
        }

        let syncedCount = 0;

        for (let i = 0; i < unsyncedArticles.length; i += BATCH_SIZE) {
            const batch = unsyncedArticles.slice(i, i + BATCH_SIZE);
            const contents = batch.map(a => a.content || '');
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}, articles: ${batch.length}`);

            const embeddings = await getJinaEmbeddings(contents);

            if (!embeddings || embeddings.length === 0) {
                console.error('Embeddings returned empty or undefined!');
                continue; // Skip this batch
            }

            // Validate embedding dimensions (Jina v3 should be 1024)
            const expectedDimension = 1024;
            if (embeddings[0] && embeddings[0].length !== expectedDimension) {
                console.warn(`Warning: Embedding dimension is ${embeddings[0].length}, expected ${expectedDimension}`);
            }

            const syncPromises = batch.map(async (article, idx) => {
                const embedding = embeddings[idx];

                if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
                    console.error(`No valid embedding for article id ${article.id}`);
                    return false;
                }

                try {
                    const syncPayload = {
                        title: article.title,
                        description: article.description,
                        url: article.url
                    };

                    await syncToQdrant(article.id, embedding, syncPayload);
                    await prisma.article.update({
                        where: { id: article.id },
                        data: { is_synced: true, synced_at: new Date() }
                    });

                    return true;
                } catch (err) {
                    console.error(`Failed to sync article ${article.id}:`, err.message);
                    return false;
                }
            });

            const results = await Promise.all(syncPromises);
            syncedCount += results.filter(Boolean).length;
        }

        res.json({ status: 'success', synced: syncedCount, total: unsyncedArticles.length });
    } catch (error) {
        console.error('Error in /jina-sync router:', error);
        res.status(500).json({ status: 'error', message: 'Sync failed' });
    }
});

// Search the synced data in qdrant by converting the query into embeddings, which does the vector search
async function searchInDatabase(searchTerm, limit = 5) {
    try {
        // Enhanced keyword search with better matching
        const articles = await prisma.article.findMany({
            where: {
                OR: [
                    {
                        title: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        description: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    },
                    {
                        content: {
                            contains: searchTerm,
                            mode: 'insensitive'
                        }
                    }
                ]
            },
            orderBy: {
                published_at: 'desc'
            },
            take: limit
        });

        console.log(`Database search for "${searchTerm}": ${articles.length} results found`);
        return articles;
    } catch (error) {
        console.error('Database search error:', error);
        return [];
    }
}
router.post("/search", async (req, res) => {
    console.log(req.query, "request for search");
    const searchTerm = req.query.q;
    const generateAnswer = req.query.generateAnswer !== 'false';

    if (!searchTerm || searchTerm.trim() === '') {
        return res.status(400).json({ message: "Enter a valid search term" });
    }

    try {
        let articles = [];
        let source = '';
        let searchStep = 0;

        const dbResults = await searchInDatabase(searchTerm, 5);

        if (dbResults && dbResults.length > 0) {
            console.log(`Found ${dbResults.length} results in database`);
            articles = dbResults;
            source = 'database';
            searchStep = 1;
        } else {

            const queryEmbeddings = await getJinaEmbeddings([searchTerm]);

            if (!queryEmbeddings || queryEmbeddings.length === 0) {
                return res.status(500).json({ message: "Failed to generate query embedding" });
            }

            const queryEmbedding = queryEmbeddings[0];
            const searchResults = await searchQdrant(queryEmbedding, 5);

            if (searchResults && Array.isArray(searchResults) && searchResults.length > 0) {
                console.log(`Found ${searchResults.length} results in Qdrant`);
                articles = searchResults.map(r => ({
                    ...r.payload,
                    score: r.score,
                    similarity: `${Math.round(r.score * 100)}%`
                }));
                source = 'qdrant';
                searchStep = 2;
            } else {

                console.log("No results found anywhere, fetching fresh articles from News API...");
                const freshArticles = await fetchNews(searchTerm);

                if (!freshArticles || freshArticles.length === 0) {
                    return res.status(404).json({
                        message: 'No articles found anywhere.',
                        searchSteps: ['database', 'qdrant', 'newsapi'],
                        suggestion: 'Try different keywords or broader search terms'
                    });
                }


                const normalizedArticles = freshArticles.map(article => normalizeArticleData(article));

                const contents = normalizedArticles.map(a => a.content || a.description || '');
                const embeddings = await getJinaEmbeddings(contents);

                if (embeddings && embeddings.length === normalizedArticles.length) {
                    const dbSyncPromises = normalizedArticles.map(async (article, idx) => {
                        try {
                            const createdArticle = await prisma.article.create({
                                data: {
                                    source_name: article.source_name,
                                    author: article.author,
                                    title: article.title,
                                    description: article.description,
                                    urlToImage: article.urlToImage,
                                    url: article.url,
                                    published_at: article.published_at,
                                    content: article.content,
                                    is_synced: false,
                                    synced_at: null
                                }
                            });

                            const embedding = embeddings[idx];
                            if (embedding && Array.isArray(embedding) && embedding.length > 0) {
                                try {
                                    await syncToQdrant(createdArticle.id, embedding, {
                                        title: createdArticle.title,
                                        description: createdArticle.description,
                                        url: createdArticle.url,
                                        published_at: createdArticle.published_at
                                    });

                                    await prisma.article.update({
                                        where: { id: createdArticle.id },
                                        data: { is_synced: true, synced_at: new Date() }
                                    });

                                    console.log(`Article ${createdArticle.id} synced successfully`);
                                } catch (syncError) {
                                    console.error(`Failed to sync article ${createdArticle.id} to Qdrant:`, syncError.message);
                                }
                            }
                            return createdArticle;
                        } catch (error) {
                            console.error(`Failed to save article: ${article.title}`, error.message);
                            return null;
                        }
                    });

                    await Promise.all(dbSyncPromises);
                }


                articles = freshArticles;
                source = 'newsapi';
                searchStep = 3;
            }
        }


        if (articles.length > 0) {
            const mostRelevantArticle = selectMostRelevantArticle(articles, searchTerm);

            console.log(`Selected most relevant article: "${mostRelevantArticle.title?.substring(0, 60)}..."`);

            let aiResponse = null;
            if (generateAnswer && mostRelevantArticle) {
                console.log("Generating AI answer with single most relevant article...");
                try {

                    aiResponse = await generateAnswerWithContext(searchTerm, [mostRelevantArticle]);
                    console.log("AI answer generated successfully");
                } catch (error) {
                    console.error("Failed to generate AI answer:", error.message);
                }
            }

            return res.json({
                query: searchTerm,
                source: source,
                searchStep: searchStep,
                totalFound: articles.length,
                selectedArticle: {
                    ...mostRelevantArticle,
                    relevanceScore: mostRelevantArticle.relevanceScore?.toFixed(2)
                },
                aiAnswer: aiResponse,
                sourceDetails: {
                    title: mostRelevantArticle.title,
                    author: mostRelevantArticle.author,
                    source_name: mostRelevantArticle.source_name || mostRelevantArticle.source?.name,
                    url: mostRelevantArticle.url,
                    urlToImage: mostRelevantArticle.urlToImage,
                    published_at: mostRelevantArticle.published_at || mostRelevantArticle.publishedAt,
                    similarity: mostRelevantArticle.similarity,
                    score: mostRelevantArticle.score
                },
                sourcesConsidered: articles.length,
                message: aiResponse
                    ? `Found ${articles.length} articles, selected most relevant one for AI analysis`
                    : `Found ${articles.length} articles from ${source}`
            });
        }

        // No articles found
        return res.status(404).json({
            message: 'No articles found.',
            query: searchTerm,
            searchSteps: ['database', 'qdrant', 'newsapi']
        });

    } catch (error) {
        console.error('Error in /search route:', error);
        res.status(500).json({
            message: 'Search failed.',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});


module.exports = router;