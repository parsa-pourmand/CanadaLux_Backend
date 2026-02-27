const express = require('express');
const users = require('./routes/users');
const auth = require('./routes/auth');
const invoices = require('./routes/invoices');
const payment = require('./routes/payments');
const orders = require('./routes/orders');
const mongoose = require('mongoose');
const config = require('config');
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
app.use('/api/auth', auth)
app.use('/api/invoices', invoices)
app.use('/api/payments', payment)
app.use('/api/orders', orders)

if (!config.get('jwtPrivateKey')) {
    winston.error('FATAL ERROR: jwtPrivateKey is not defined.');
    process.exit(1);
}



const db = config.get('db')
mongoose.connect(db)
    .then(()=>{
        winston.info(`Connected to ${db}...`)
    })
    .catch(err=>winston.error('Could not connect to MongoDB...', err));


const server = app.listen(port, () => winston.info(`Listening on port ${port}...`));

module.exports = server;