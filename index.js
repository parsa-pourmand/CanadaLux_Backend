require('dotenv').config();

const express = require('express');
const users = require('./routes/users');
const admin = require('./routes/admin');
const auth = require('./routes/auth');
const invoices = require('./routes/invoices');
const payment = require('./routes/payments');
const orders = require('./routes/orders');
const item = require('./routes/items');
const mongoose = require('mongoose');
const winston = require('winston');
const c = require('config');

// Configure Winston
winston.add(new winston.transports.Console({
  format: winston.format.simple()
}));

const app = express();


const port = process.env.PORT || 3000;

app.use(express.json());
app.use('/api/users', users)
app.use('/api/admin', admin);
app.use('/api/auth', auth)
app.use('/api/invoices', invoices)
app.use('/api/payments', payment)
app.use('/api/orders', orders)
app.use('/api/items', item);

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