const express = require('express');
const { Item, validate, validatePatch } = require('../models/Item');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all items
router.get('/', auth, async (req, res) => {
    try {
        const items = await Item.find().sort('name');
        res.send(items);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// Get item by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const item = await Item.findById(req.params.id);
        if (!item) return res.status(404).send('Item not found.');

        res.send(item);
    } catch (err) {
        res.status(400).send('Invalid item id.');
    }
});

// Create item
router.post('/', auth, async (req, res) => {
    const { error } = validate(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    let item = new Item({
        name: req.body.name,
        description: req.body.description || '',
        sku: req.body.sku || undefined,
        image: req.body.image || '',
        sellingPrice: req.body.sellingPrice,
        purchasingPrice: req.body.purchasingPrice,
        stockQuantity: req.body.stockQuantity,
        status: req.body.status || 'Active'
    });

    try {
        item = await item.save();
        res.send(item);
    } catch (err) {
        if (err.code === 11000)
            return res.status(409).send('SKU already exists.');

        res.status(500).send(err.message);
    }
});

// Update item
router.patch('/:id', auth, async (req, res) => {
    const { error } = validatePatch(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const updateFields = {};

    if (req.body.name !== undefined)
        updateFields.name = req.body.name;

    if (req.body.description !== undefined)
        updateFields.description = req.body.description;

    if (req.body.sku !== undefined)
        updateFields.sku = req.body.sku || undefined;

    if (req.body.image !== undefined)
        updateFields.image = req.body.image;

    if (req.body.sellingPrice !== undefined)
        updateFields.sellingPrice = req.body.sellingPrice;

    if (req.body.purchasingPrice !== undefined)
        updateFields.purchasingPrice = req.body.purchasingPrice;

    if (req.body.stockQuantity !== undefined)
        updateFields.stockQuantity = req.body.stockQuantity;

    if (req.body.status !== undefined)
        updateFields.status = req.body.status;

    try {
        const item = await Item.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        if (!item) return res.status(404).send('Item not found.');

        res.send(item);
    } catch (err) {
        if (err.code === 11000)
            return res.status(409).send('SKU already exists.');

        res.status(400).send('Invalid item id.');
    }
});

// Delete item
router.delete('/:id', auth, async (req, res) => {
    try {
        const item = await Item.findByIdAndDelete(req.params.id);

        if (!item) return res.status(404).send('Item not found.');

        res.send(item);
    } catch (err) {
        res.status(400).send('Invalid item id.');
    }
});

module.exports = router;