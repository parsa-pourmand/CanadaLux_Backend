const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');
const { Quote, validateQuote, validateQuoteResponse } = require('../models/Quote');
const { Notification } = require('../models/Notification');

const sendPushNotification = require('../utils/sendPushNotification');
const { User } = require('../models/User');

const router = express.Router();

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

    await Notification.create({
      userId: quote.userId,
      title: 'Quote Response',
      message: `Your quote "${quote.title}" has received a response.`,
      type: 'quote',
      relatedQuoteId: quote._id,
    });

    const quoteUser = await User.findById(quote.userId);

    if (quoteUser) {
      await sendPushNotification(
        quoteUser.expoPushTokens,
        'Quote Response',
        `Your quote "${quote.title}" has been answered.`,
        {
          type: 'quote',
          quoteId: quote._id.toString(),
        }
      );
    }

    res.send(quote);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

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

    const admins = await User.find({ role: 'admin' });

    for (const adminUser of admins) {
      await Notification.create({
        userId: adminUser._id,
        title: 'New Quote Request',
        message: `New quote request from ${req.user.Firstname || 'user'}.`,
        type: 'admin_quote',
        relatedQuoteId: quote._id,
      });
    }

    for (const adminUser of admins) {
      await sendPushNotification(
        adminUser.expoPushTokens,
        'New Quote Request',
        `New quote request from ${req.user.Firstname || 'user'}`,
        {
          type: 'admin_quote',
          quoteId: quote._id.toString(),
        }
      );
    }

    res.status(201).send(quote);
  } catch (err) {
    res.status(500).send(err.message);
  }
});



module.exports = router;