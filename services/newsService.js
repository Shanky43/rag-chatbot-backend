// const { default: axios } = require("axios");
// const prisma = require("./prismaService");

// const api_key = process.env.NEWS_API_KEY;
// const news_api = process.env.NEWS_API;
// async function fetchNews(searchTerm) {
//     console.log(news_api, "news_api")
//     try {
//         const url = `${news_api}everything?q=${searchTerm}&pageSize=10&apiKey=${api_key}`;
//         const newsResponse = await axios.get(url);
//         console.log(newsResponse.data);
//         return newsResponse.data.articles;
//     } catch (error) {
//         console.log(error, " error in fetchNews")
//     }
// }

// async function saveNewsToDB(articles) {
//     for (const article of articles) {
//         await prisma.article.create({
//             data: {
//                 source_name: article.source?.name,
//                 author: article.author,
//                 title: article.title,
//                 description: article.description,
//                 content: article.content,
//                 url: article.url,
//                 published_at: article.publishedAt,
//                 urlToImage: article.urlToImage
//             }
//         })
//     }
// }

// module.exports = { fetchNews, saveNewsToDB };

const { default: axios } = require("axios");
const prisma = require("./prismaService");

const api_key = process.env.NEWS_API_KEY;
const news_api = process.env.NEWS_API;

async function fetchNews(searchTerm) {
    console.log(news_api, "news_api");

    try {
        const url = `${news_api}everything?q=${encodeURIComponent(searchTerm)}&pageSize=10&apiKey=${api_key}`;

        // Add proper headers to avoid bot detection
        const config = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
            },
            timeout: 15000, // 15 second timeout
            maxRedirects: 5
        };

        console.log('Fetching news from:', url);
        const newsResponse = await axios.get(url, config);
        console.log('News API response status:', newsResponse.status);

        if (newsResponse.data && newsResponse.data.articles) {
            return newsResponse.data.articles;
        } else {
            console.log('No articles found in response:', newsResponse.data);
            return [];
        }

    } catch (error) {
        console.log('Error in fetchNews:', {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data?.slice(0, 500) // First 500 chars of error response
        });

        // Return empty array instead of undefined
        return [];
    }
}

async function saveNewsToDB(articles) {
    if (!articles || articles.length === 0) {
        console.log('No articles to save');
        return;
    }

    for (const article of articles) {
        try {
            await prisma.article.create({
                data: {
                    source_name: article.source?.name || null,
                    author: article.author || null,
                    title: article.title || null,
                    description: article.description || null,
                    content: article.content || null,
                    url: article.url || null,
                    published_at: article.publishedAt ? new Date(article.publishedAt) : null,
                    urlToImage: article.urlToImage || null
                }
            });
        } catch (dbError) {
            console.log('Error saving article to DB:', dbError.message);
        }
    }
}

module.exports = { fetchNews, saveNewsToDB };