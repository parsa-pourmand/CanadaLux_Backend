const express = require('express');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { User } = require('../models/User');

const router = express.Router();

router.patch('/users/:id/discount', [auth, admin], async (req, res) => {
  const discount = Number(req.body.discount);

  if (Number.isNaN(discount) || discount < 0 || discount > 100) {
    return res.status(400).send('Discount must be a number between 0 and 100.');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { discount } },
    { new: true, runValidators: true }
  );

  if (!user) return res.status(404).send('User not found.');

  res.send(user);
});

module.exports = router;