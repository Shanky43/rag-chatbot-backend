function calculateRelevanceScore(article, query) {
    let score = 0;
    const queryWords = query.toLowerCase().split(' ');

    const titleMatches = queryWords.filter(word =>
        article.title?.toLowerCase().includes(word)
    ).length;
    score += titleMatches * 3;

    const descMatches = queryWords.filter(word =>
        article.description?.toLowerCase().includes(word)
    ).length;
    score += descMatches * 2;


    const contentMatches = queryWords.filter(word =>
        article.content?.toLowerCase().includes(word)
    ).length;
    score += contentMatches * 1;


    const articleDate = new Date(article.published_at || article.publishedAt);
    if (!isNaN(articleDate.getTime())) {
        const daysDiff = (Date.now() - articleDate.getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 10 - daysDiff);
        score += recencyScore * 0.5;
    }


    if (article.score) {
        score += article.score * 10;
    }

    return score;
}

function selectMostRelevantArticle(articles, query) {
    if (!articles || articles.length === 0) return null;
    if (articles.length === 1) return articles[0];

    const scoredArticles = articles.map(article => ({
        ...article,
        relevanceScore: calculateRelevanceScore(article, query)
    }));

    scoredArticles.sort((a, b) => b.relevanceScore - a.relevanceScore);

    console.log('Article relevance scores:', scoredArticles.map(a => ({
        title: a.title?.substring(0, 50) + '...',
        score: a.relevanceScore.toFixed(2)
    })));

    return scoredArticles[0];
}
module.exports = { selectMostRelevantArticle, calculateRelevanceScore }