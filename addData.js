const fs = require('fs');
const path = require('path');
const prisma = require('../services/prismaService');

async function importArticles() {
  try {
    const filePath = path.join(__dirname, 'articles.json');
    const rawData = fs.readFileSync(filePath);
    const articles = JSON.parse(rawData);

    for (const article of articles) {
      await prisma.article.create({
        data: {
          source_name: article.source_name,
          author: article.author,
          title: article.title,
          description: article.description,
          content: article.content,
          url: article.url,
          published_at: article.published_at ? new Date(article.published_at) : null,
          url_to_image: article.url_to_image
        }
      });
    }

    console.log('✅ All articles imported successfully!');
  } catch (error) {
    console.error('❌ Error importing articles:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

importArticles();
