const express = require('express');
const { Item, validate, validatePatch } = require('../models/Item');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

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
router.post('/', [auth, admin], async (req, res) => {
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
        status: req.body.status || 'Active',
        hst: req.body.hst || 0
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
router.patch('/:id', [auth, admin], async (req, res) => {
    try {
        const existingItem = await Item.findById(req.params.id);
        if (!existingItem) return res.status(404).send('Item not found.');

        const updatedData = {
            name: req.body.name !== undefined ? req.body.name : existingItem.name,
            description: req.body.description !== undefined ? req.body.description : existingItem.description,
            image: req.body.image !== undefined ? req.body.image : existingItem.image,
            sku: req.body.sku !== undefined ? req.body.sku : existingItem.sku,
            sellingPrice: req.body.sellingPrice !== undefined ? req.body.sellingPrice : existingItem.sellingPrice,
            purchasingPrice: req.body.purchasingPrice !== undefined ? req.body.purchasingPrice : existingItem.purchasingPrice,
            stockQuantity: req.body.stockQuantity !== undefined ? req.body.stockQuantity : existingItem.stockQuantity,
            status: req.body.status !== undefined ? req.body.status : existingItem.status,
            hst: req.body.hst !== undefined ? req.body.hst : existingItem.hst,
            onSale: req.body.onSale !== undefined ? req.body.onSale : existingItem.onSale,
            salePercentage: req.body.salePercentage !== undefined ? req.body.salePercentage : existingItem.salePercentage
        };

        const { error } = validate(updatedData);
        if (error) return res.status(400).send(error.details[0].message);

        const item = await Item.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        res.send(item);
    } catch (err) {
        if (err.code === 11000)
            return res.status(409).send('SKU already exists.');

        res.status(400).send('Invalid item id.');
    }
});

// Delete item
router.delete('/:id', [auth, admin], async (req, res) => {
    try {
        const item = await Item.findByIdAndDelete(req.params.id);

        if (!item) return res.status(404).send('Item not found.');

        res.send(item);
    } catch (err) {
        res.status(400).send('Invalid item id.');
    }
});

module.exports = router;