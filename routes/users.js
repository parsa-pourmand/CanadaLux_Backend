const express = require('express');
const { User, validate, validatePatch } = require('../models/User');
const bcrypt = require('bcrypt');
const _ = require('lodash');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { registerLimiter } = require('../middleware/rateLimiter');
const { Order } = require('../models/Order');
const { Quote } = require('../models/Quote');
const { Invoice } = require('../models/Invoice');

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');

  if (!user) return res.status(404).send('User not found.');

  res.send(user);
});


router.post('/', registerLimiter, async (req, res, next) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let user = await User.findOne({ email: req.body.email });
    if (user) return res.status(400).send('User already registered.');

    user = new User({
        Firstname: req.body.Firstname,
        Lastname: req.body.Lastname,
        email: req.body.email,
        password: req.body.password,
        companyName: req.body.companyName || '',
        phoneNumber: req.body.phoneNumber || '',
        billingAddress: req.body.billingAddress || '',
        shippingAddress: req.body.shippingAddress || '',
        profileImage: req.body.profileImage || ''
    });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);

    await user.save();
    
    const token = user.generateAuthToken();

    res.status(201).send({
        token,
        user: _.pick(user, [
            '_id',
            'Firstname',
            'Lastname',
            'email',
            'companyName',
            'phoneNumber',
            'billingAddress',
            'shippingAddress',
            'points',
            'discount',
            'role',
            'profileImage'
        ])
    });
});

// GET all users - admin only
router.get('/admin/all', [auth, admin], async (req, res, next) => {
  try {
    const users = await User.find({ isDeleted: false })
      .select('-password')
      .sort({ createdAt: -1 });

    res.send(users);
  } catch (err) {
    next(err);
  }
});

// GET one user - admin only
router.get('/admin/:id', [auth, admin], async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) return res.status(404).send('User not found.');

    res.send(user);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/:id/details', [auth, admin], async (req, res, next) => {
  try {

    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).send('User not found.');

    const orders = await Order.find({ userId: req.params.id })
      .populate('project', 'name')
      .populate('lineItems.itemId', 'name')
      .sort({ createdAt: -1 });

    const quotes = await Quote.find({ userId: req.params.id })
      .sort({ createdAt: -1 });

    const invoices = await Invoice.find({ userId: req.params.id });

    const totalOwed = invoices.reduce((sum, invoice) => {
      if (invoice.status?.toLowerCase() === 'paid') return sum;

      const balance = invoice.balance || 0;

      return sum + Math.max(0, balance);
    }, 0);

    res.send({
      user,
      orders,
      quotes,
      totalOwed,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH user discount - admin only
router.patch('/admin/:id/discount', [auth, admin], async (req, res, next) => {
  try {
    const discount = Number(req.body.discount);

    if (Number.isNaN(discount) || discount < 0 || discount > 100) {
      return res.status(400).send('Discount must be between 0 and 100.');
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { discount },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) return res.status(404).send('User not found.');

    res.send(user);
  } catch (err) {
    next(err);
  }
});

router.patch('/me/profile', auth, async (req, res, next) => {
    try {
        const { error } = validatePatch(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).send('User not found.');

        const updateFields = {};

        if (req.body.email !== undefined && req.body.email.toLowerCase() !== user.email.toLowerCase()) {
            const existingUser = await User.findOne({
                email: req.body.email.toLowerCase(),
                _id: { $ne: req.user._id }
            });

            if (existingUser) return res.status(400).send('Email already in use.');

            updateFields.email = req.body.email.toLowerCase();
        }

        if (req.body.phoneNumber !== undefined)
            updateFields.phoneNumber = req.body.phoneNumber;

        if (req.body.billingAddress !== undefined)
            updateFields.billingAddress = req.body.billingAddress;

        if (req.body.shippingAddress !== undefined)
            updateFields.shippingAddress = req.body.shippingAddress;

        if (req.body.companyName !== undefined)
            updateFields.companyName = req.body.companyName;

        if (req.body.profileImage !== undefined)
            updateFields.profileImage = req.body.profileImage;

        if (req.body.password !== undefined) {

            if (!req.body.currentPassword)
                return res.status(400).send('Old password is required.');

            const validPassword = await bcrypt.compare(
                req.body.currentPassword,
                user.password
            );

            if (!validPassword)
                return res.status(400).send('Old password is incorrect.');

            const salt = await bcrypt.genSalt(10);
            updateFields.password = await bcrypt.hash(req.body.password, salt);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            { $set: updateFields },
            { new: true, runValidators: true }
        ).select('-password');

        const token = updatedUser.generateAuthToken();

        res
        .header('x-auth-token', token)
        .send(updatedUser);

    } catch (err) {
        next(err);
    }
});



router.delete('/', [auth, admin], async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) return res.status(404).send('User not found.');

        user.isDeleted = true;
        user.deletedAt = new Date();
        user.email = `deleted_${user._id}_${user.email}`;

        await user.save();

        res.send('Account deleted.');
    } catch (err) {
        next(err);
    }
});

module.exports = router;