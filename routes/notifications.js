const express = require('express');
const auth = require('../middleware/auth');
const validateObjectId = require('../middleware/validateObjectId');
const { Notification } = require('../models/Notification');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user._id,
    }).sort('-createdAt');

    res.send(notifications);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

router.patch('/:id/read', [auth, validateObjectId], async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user._id,
      },
      { read: true },
      { returnDocument: 'after'  }
    );

    if (!notification)
      return res.status(404).send('Notification not found.');

    res.send(notification);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;