function normalizeArticleData(article, source = 'newsapi') {
    const normalized = {
        title: article.title,
        description: article.description,
        content: article.content,
        url: article.url,
        urlToImage: article.urlToImage,
        author: article.author
    };


    if (article.publishedAt) {
        const date = new Date(article.publishedAt);
        normalized.published_at = isNaN(date.getTime()) ? new Date() : date;
    } else if (article.published_at) {
        normalized.published_at = new Date(article.published_at);
    } else {
        normalized.published_at = new Date();
    }

    if (article.source) {
        if (typeof article.source === 'object') {
            normalized.source_name = article.source.name || article.source.id || 'Unknown';
        } else {
            normalized.source_name = article.source;
        }
    } else {
        normalized.source_name = article.source_name || 'Unknown';
    }

    return normalized;
}
module.exports = { normalizeArticleData }