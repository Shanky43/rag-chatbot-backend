// // const { default: axios } = require("axios");
// // const prisma = require("./prismaService");

// // const api_key = process.env.NEWS_API_KEY;
// // const news_api = process.env.NEWS_API;
// // async function fetchNews(searchTerm) {
// //     console.log(news_api, "news_api")
// //     try {
// //         const url = `${news_api}everything?q=${searchTerm}&pageSize=10&apiKey=${api_key}`;
// //         const newsResponse = await axios.get(url);
// //         console.log(newsResponse.data);
// //         return newsResponse.data.articles;
// //     } catch (error) {
// //         console.log(error, " error in fetchNews")
// //     }
// // }

// // async function saveNewsToDB(articles) {
// //     for (const article of articles) {
// //         await prisma.article.create({
// //             data: {
// //                 source_name: article.source?.name,
// //                 author: article.author,
// //                 title: article.title,
// //                 description: article.description,
// //                 content: article.content,
// //                 url: article.url,
// //                 published_at: article.publishedAt,
// //                 urlToImage: article.urlToImage
// //             }
// //         })
// //     }
// // }

// // module.exports = { fetchNews, saveNewsToDB };

// const { default: axios } = require("axios");
// const prisma = require("./prismaService");

// const api_key = process.env.NEWS_API_KEY;
// const news_api = process.env.NEWS_API;

// async function fetchNews(searchTerm) {
//     console.log(news_api, "news_api");

//     try {
//         const url = `${news_api}everything?q=${encodeURIComponent(searchTerm)}&pageSize=10&apiKey=${api_key}`;

//         // Add proper headers to avoid bot detection
//         const config = {
//             headers: {
//                 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//                 'Accept': 'application/json',
//                 'Accept-Language': 'en-US,en;q=0.9',
//                 'Accept-Encoding': 'gzip, deflate, br',
//                 'Connection': 'keep-alive',
//                 'Upgrade-Insecure-Requests': '1',
//                 'Sec-Fetch-Dest': 'document',
//                 'Sec-Fetch-Mode': 'navigate',
//                 'Sec-Fetch-Site': 'none',
//                 'Cache-Control': 'max-age=0'
//             },
//             timeout: 15000, // 15 second timeout
//             maxRedirects: 5
//         };

//         console.log('Fetching news from:', url);
//         const newsResponse = await axios.get(url, config);
//         console.log('News API response status:', newsResponse.status);

//         if (newsResponse.data && newsResponse.data.articles) {
//             return newsResponse.data.articles;
//         } else {
//             console.log('No articles found in response:', newsResponse.data);
//             return [];
//         }

//     } catch (error) {
//         console.log('Error in fetchNews:', {
//             message: error.message,
//             status: error.response?.status,
//             statusText: error.response?.statusText,
//             data: error.response?.data?.slice(0, 500) // First 500 chars of error response
//         });

//         // Return empty array instead of undefined
//         return [];
//     }
// }

// async function saveNewsToDB(articles) {
//     if (!articles || articles.length === 0) {
//         console.log('No articles to save');
//         return;
//     }

//     for (const article of articles) {
//         try {
//             await prisma.article.create({
//                 data: {
//                     source_name: article.source?.name || null,
//                     author: article.author || null,
//                     title: article.title || null,
//                     description: article.description || null,
//                     content: article.content || null,
//                     url: article.url || null,
//                     published_at: article.publishedAt ? new Date(article.publishedAt) : null,
//                     urlToImage: article.urlToImage || null
//                 }
//             });
//         } catch (dbError) {
//             console.log('Error saving article to DB:', dbError.message);
//         }
//     }
// }

// module.exports = { fetchNews, saveNewsToDB };
const { default: axios } = require("axios");
const prisma = require("./prismaService");

// API configurations
const NEWS_API_KEY = process.env.NEWS_API_KEY;
const NEWS_API_BASE = process.env.NEWS_API;
const GUARDIAN_API_KEY = process.env.GUARDIAN_API_KEY;

// Create axios instances for each API
const newsApiClient = axios.create({
    timeout: 20000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache'
    }
});

const guardianApiClient = axios.create({
    timeout: 20000,
    headers: {
        'User-Agent': 'NewsAggregator/1.0',
        'Accept': 'application/json'
    }
});

// NewsAPI fetcher
async function fetchFromNewsAPI(searchTerm) {
    if (!NEWS_API_KEY || !NEWS_API_BASE) {
        console.log('NewsAPI credentials not configured');
        return [];
    }

    try {
        console.log('Fetching from NewsAPI for:', searchTerm);

        const url = `${NEWS_API_BASE}everything?q=${encodeURIComponent(searchTerm)}&pageSize=10&sortBy=publishedAt&apiKey=${NEWS_API_KEY}`;
        console.log('NewsAPI URL:', url);

        const response = await newsApiClient.get(url);

        if (response.data && response.data.articles && response.data.articles.length > 0) {
            const articles = response.data.articles.map(article => ({
                source: { name: article.source?.name || 'NewsAPI' },
                author: article.author,
                title: article.title,
                description: article.description,
                content: article.content,
                url: article.url,
                publishedAt: article.publishedAt,
                urlToImage: article.urlToImage,
                apiSource: 'NewsAPI'
            }));

            console.log(`NewsAPI success: ${articles.length} articles`);
            return articles;
        }

        console.log('NewsAPI: No articles found');
        return [];

    } catch (error) {
        console.log('NewsAPI failed:', error.response?.status || error.message);
        return [];
    }
}

// Guardian API fetcher
async function fetchFromGuardian(searchTerm) {
    if (!GUARDIAN_API_KEY) {
        console.log('Guardian API key not configured');
        return [];
    }

    try {
        console.log('Fetching from Guardian API for:', searchTerm);

        const url = `https://content.guardianapis.com/search` +
            `?q=${encodeURIComponent(searchTerm)}` +
            `&show-fields=byline,trailText,bodyText,thumbnail,headline` +
            `&page-size=10` +
            `&order-by=newest` +
            `&api-key=${GUARDIAN_API_KEY}`;

        console.log('Guardian URL:', url);
        const response = await guardianApiClient.get(url);

        if (response.data && response.data.response && response.data.response.results) {
            const articles = response.data.response.results.map(article => ({
                source: { name: 'The Guardian' },
                author: article.fields?.byline || 'Guardian Staff',
                title: article.fields?.headline || article.webTitle,
                description: article.fields?.trailText || article.webTitle,
                content: article.fields?.bodyText || null,
                url: article.webUrl,
                publishedAt: article.webPublicationDate,
                urlToImage: article.fields?.thumbnail || null,
                apiSource: 'Guardian'
            }));

            console.log(`Guardian success: ${articles.length} articles`);
            return articles;
        }

        console.log('Guardian: No articles found');
        return [];

    } catch (error) {
        console.log('Guardian API failed:', error.response?.status || error.message);
        return [];
    }
}

// Main fetch function - always hits both APIs simultaneously
async function fetchNews(searchTerm) {
    console.log(`Fetching news from both sources for: "${searchTerm}"`);

    try {
        // Hit both APIs simultaneously
        const [newsApiResults, guardianResults] = await Promise.allSettled([
            fetchFromNewsAPI(searchTerm),
            fetchFromGuardian(searchTerm)
        ]);

        // Extract articles from successful calls
        const newsApiArticles = newsApiResults.status === 'fulfilled' ? newsApiResults.value : [];
        const guardianArticles = guardianResults.status === 'fulfilled' ? guardianResults.value : [];

        // Combine all articles
        const allArticles = [...newsApiArticles, ...guardianArticles];

        // Remove duplicates based on URL
        const uniqueArticles = allArticles.filter((article, index, self) =>
            index === self.findIndex(a => a.url === article.url)
        );

        console.log(`Total articles: NewsAPI(${newsApiArticles.length}) + Guardian(${guardianArticles.length}) = ${uniqueArticles.length} unique articles`);

        return uniqueArticles;

    } catch (error) {
        console.log('Error in fetchNews:', error.message);
        return [];
    }
}

// Save articles to database
async function saveNewsToDB(articles) {
    if (!articles || articles.length === 0) {
        console.log('No articles to save');
        return { saved: 0, errors: 0, skipped: 0 };
    }

    console.log(`Saving ${articles.length} articles to database`);

    let saved = 0;
    let errors = 0;
    let skipped = 0;

    for (const article of articles) {
        try {
            // Skip articles without essential data
            if (!article.title || !article.url) {
                console.log('Skipping article - missing title or URL');
                skipped++;
                continue;
            }

            // Check for duplicates
            const existingArticle = await prisma.article.findFirst({
                where: {
                    OR: [
                        { url: article.url },
                        {
                            title: article.title,
                            source_name: article.source?.name
                        }
                    ]
                }
            });

            if (existingArticle) {
                console.log('Skipping duplicate article:', article.title?.substring(0, 50));
                skipped++;
                continue;
            }

            // Prepare and validate data
            const articleData = {
                source_name: article.source?.name?.substring(0, 255) || 'Unknown',
                author: article.author?.substring(0, 255) || null,
                title: article.title.substring(0, 500),
                description: article.description?.substring(0, 1000) || null,
                content: article.content?.substring(0, 5000) || null,
                url: article.url.substring(0, 500),
                urlToImage: article.urlToImage?.substring(0, 500) || null,
                published_at: article.publishedAt ? new Date(article.publishedAt) : new Date()
            };

            // Validate date
            if (isNaN(articleData.published_at.getTime())) {
                articleData.published_at = new Date();
            }

            await prisma.article.create({ data: articleData });
            saved++;

        } catch (dbError) {
            console.log('Error saving article to DB:', dbError.message);
            errors++;
        }
    }

    console.log(`Database save complete - Saved: ${saved}, Skipped: ${skipped}, Errors: ${errors}`);
    return { saved, errors, skipped };
}

module.exports = { fetchNews, saveNewsToDB };