const express = require('express');
const {
  FeaturedProduct,
  validate,
} = require('../models/FeaturedProduct');

const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

router.get('/', auth, async (req, res, next) => {
  try {
    const products = await FeaturedProduct.find()
      .sort({ createdAt: -1 });

    res.send(products);
  } catch (err) {
    next(err);
  }
});

router.post('/', [auth, admin], async (req, res, next) => {
  try {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const product = new FeaturedProduct({
      name: req.body.name,
      description: req.body.description || '',
      expectedPrice: req.body.expectedPrice || 0,
      images: req.body.images || [],
      expectedArrivalDate: req.body.expectedArrivalDate,
      status: req.body.status || 'Coming Soon',
    });

    await product.save();

    res.status(201).send(product);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', [auth, admin, validateObjectId], async (req, res, next) => {
  try {
    const existingProduct = await FeaturedProduct.findById(req.params.id);
    if (!existingProduct) return res.status(404).send('Featured product not found.');

    const updatedData = {
      name: req.body.name !== undefined ? req.body.name : existingProduct.name,
      description:
        req.body.description !== undefined
          ? req.body.description
          : existingProduct.description,
      expectedPrice:
        req.body.expectedPrice !== undefined
          ? req.body.expectedPrice
          : existingProduct.expectedPrice,
      images:
        req.body.images !== undefined ? req.body.images : existingProduct.images,
      expectedArrivalDate:
        req.body.expectedArrivalDate !== undefined
          ? req.body.expectedArrivalDate
          : existingProduct.expectedArrivalDate,
      status: req.body.status !== undefined ? req.body.status : existingProduct.status,
    };

    const { error } = validate(updatedData);
    if (error) return res.status(400).send(error.details[0].message);

    const product = await FeaturedProduct.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    res.send(product);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', [auth, admin, validateObjectId], async (req, res, next) => {
  try {
    const product = await FeaturedProduct.findByIdAndDelete(req.params.id);

    if (!product) return res.status(404).send('Featured product not found.');

    res.send(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;