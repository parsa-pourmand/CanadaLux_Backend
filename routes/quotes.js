const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const { Quote, validateQuote, validateQuoteResponse } = require('../models/Quote');

const router = express.Router();

// User: get own quotes
router.get('/', auth, async (req, res) => {
  try {
    const quotes = await Quote.find({ userId: req.user._id }).sort('-createdAt');
    res.send(quotes);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// User: get one own quote
router.get('/:id', [auth, validateObjectId], async (req, res) => {
  try {
    const quote = await Quote.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!quote) return res.status(404).send('Quote not found.');

    res.send(quote);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// User: create quote
router.post('/', auth, async (req, res) => {
  try {
    const { error } = validateQuote({
      ...req.body,
      userId: req.user._id,
    });

    if (error) {
      return res.status(400).send(error.details[0].message);
    }

    const quote = new Quote({
      userId: req.user._id,
      title: req.body.title,
      details: req.body.details,
      images: req.body.images || [],
      status: 'Pending',
    });

    await quote.save();

    // Later: forward quote to company/retailer portal here
    // Later: notify staff/admin here

    res.status(201).send(quote);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Admin: get all quotes
router.get('/admin/all', [auth, admin], async (req, res) => {
  try {
    const quotes = await Quote.find()
      .populate('userId', 'Firstname Lastname email companyName')
      .sort('-createdAt');

    res.send(quotes);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Admin: respond to quote
router.patch('/admin/:id/respond', [auth, admin, validateObjectId], async (req, res) => {
  try {
    const { error } = validateQuoteResponse(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const quote = await Quote.findById(req.params.id);
    if (!quote) return res.status(404).send('Quote not found.');

    quote.retailerResponse = req.body.retailerResponse;
    quote.status = 'Responded';
    quote.respondedAt = new Date();

    await quote.save();

    // Later: send push notification to user here

    res.send(quote);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;