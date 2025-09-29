const express = require('express');
const app = express();
const dotenv = require('dotenv');

dotenv.config();
app.use(express.json());


app.get('/', (req, res) => {
    res.send('Пошел нахуй отсюда иуда');
});

const PORT = process.env.PORT || 5001;


app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});
