const express = require('express');
const { User, validate, validatePatch } = require('../models/User');
const bcrypt = require('bcrypt');
const _ = require('lodash');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');

  if (!user) return res.status(404).send('User not found.');

  res.send(user);
});

router.get('/', auth, async (req, res, next) => {
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
            'role'
        ])
    });
});

router.patch('/', auth, async (req, res, next) => {
    try {
        const { error } = validatePatch(req.body);
        if (error) return res.status(400).send(error.details[0].message);

        const user = await User.findById(req.user._id);
        if (!user) return res.status(404).send('User not found.');

        const updateFields = {};

        if (req.body.email !== undefined) {
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

        if (req.body.password !== undefined) {

            if (!req.body.oldPassword)
                return res.status(400).send('Old password is required.');

            const validPassword = await bcrypt.compare(
                req.body.oldPassword,
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

        res.send(updatedUser);

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