require('dotenv').config();

const express = require('express');

const users = require('./routes/users');
const admin = require('./routes/admin');
const auth = require('./routes/auth');
const invoices = require('./routes/invoices');
const payment = require('./routes/payments');
const orders = require('./routes/orders');
const item = require('./routes/items');
const projects = require('./routes/projects');

const mongoose = require('mongoose');
const winston = require('winston');
const c = require('config');
const helmet = require('helmet');
const cors = require('cors');


// Configure Winston
winston.add(new winston.transports.Console({
  format: winston.format.simple()
}));

const app = express();

app.disable('x-powered-by');
app.use(helmet());

const port = process.env.PORT || 3000;

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use('/api/users', users)
app.use('/api/admin', admin);
app.use('/api/auth', auth)
app.use('/api/invoices', invoices)
app.use('/api/payments', payment)
app.use('/api/orders', orders)
app.use('/api/items', item);
app.use('/api/projects', projects);

if (!process.env.JWT_PRIVATE_KEY) {
  winston.error('FATAL ERROR: JWT_PRIVATE_KEY is not defined.');
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  winston.error('FATAL ERROR: MONGO_URI is not defined.');
  process.exit(1);
}

const db = process.env.MONGO_URI
mongoose.connect(db)
    .then(()=>{
        winston.info(`Connected to ${db}...`)
    })
    .catch(err=>winston.error('Could not connect to MongoDB...', err));


const server = app.listen(port, () => winston.info(`Listening on port ${port}...`));

module.exports = server;