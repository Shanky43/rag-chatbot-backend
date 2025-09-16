const { default: axios } = require("axios");
const prisma = require("./prismaService");

const api_key = process.env.NEWS_API_KEY;
const news_api = process.env.NEWS_API;
async function fetchNews(searchTerm) {
    try {
        const url = `${news_api}everything?q=${searchTerm}&pageSize=15&apiKey=${api_key}`;
        const newsResponse = await axios.get(url);
        console.log(newsResponse.data);
        return newsResponse.data.articles;
    } catch (error) {
        console.log(error, " error in fetchNews")
    }
}

async function saveNewsToDB(articles) {
    for (const article of articles) {
        await prisma.article.create({
            data: {
                source_name: article.source?.name,
                author: article.author,
                title: article.title,
                description: article.description,
                content: article.content,
                url: article.url,
                published_at: article.publishedAt,
                urlToImage: article.urlToImage
            }
        })
    }
}

module.exports = { fetchNews, saveNewsToDB };
