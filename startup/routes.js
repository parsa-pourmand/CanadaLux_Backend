const express = require('express');

const users = require('../routes/users');
const admin = require('../routes/admin');
const auth = require('../routes/auth');
const invoices = require('../routes/invoices');
const payments = require('../routes/payments');
const orders = require('../routes/orders');
const items = require('../routes/items');
const projects = require('../routes/projects');

const error = require('../middleware/error');

module.exports = function (app) {
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.status(200).send({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date()
    });
  });

  app.use('/api/users', users);
  app.use('/api/admin', admin);
  app.use('/api/auth', auth);
  app.use('/api/invoices', invoices);
  app.use('/api/payments', payments);
  app.use('/api/orders', orders);
  app.use('/api/items', items);
  app.use('/api/projects', projects);

  app.use(error);
};