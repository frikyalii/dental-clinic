require('dotenv').config();
require('express-async-errors'); // lets async route handlers throw into the error middleware
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', routes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.sqlMessage || err.message });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Dental clinic API running on http://localhost:${PORT}`));
