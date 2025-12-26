const express = require('express');
const cors = require('cors');
const scheduleRoutes = require('./routes/scheduleRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api', scheduleRoutes);

app.get('/', (req, res) => {
    res.send('KTMB API is running');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
