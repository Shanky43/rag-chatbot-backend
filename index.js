const express = require('express');

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient()
const cors = require("cors");
const morgan = require('morgan');
const newsRoutes = require('./routes/newsRoutes');



app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.get("/test-connection", async (req, res) => {
    try {
        const response = await prisma.$queryRaw`SELECT NOW()`;
        res.status(200).json({ status: "success", time: response.rows[0] });
    } catch (error) {
        console.error("Error testing connection", error);
        res.status(500).json({ status: "error", message: "Internal Server Error" });
    }
});

app.use('/api/news', newsRoutes);



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});