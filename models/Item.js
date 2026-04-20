const mongoose = require('mongoose');
const Joi = require('joi');

const itemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        minlength: 2,
        maxlength: 255,
        trim: true
    },
    description: {
        type: String,
        maxlength: 1024,
        default: '',
        trim: true
    },
    image: {
        type: String,
        default: '',
        trim: true
    },
    sku: {
        type: String,
        maxlength: 100,
        trim: true
    },
    sellingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    purchasingPrice: {
        type: Number,
        required: true,
        min: 0
    },
    stockQuantity: {
        type: Number,
        required: true,
        min: 0,
        validate: {
            validator: Number.isInteger,
            message: 'Stock quantity must be an integer.'
        }
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Discontinued'],
        default: 'Active'
    },
    hst: {
        type: Number,
        enum: [0, 13],
        default: 0
    },
    onSale: {
        type: Boolean,
        default: false
    },
    salePercentage: {
        type: Number,
        min: 0,
        max: 100,
        default: 0,
        validate: {
            validator: function (value) {
                if (this.onSale) return value > 0;
                return value === 0;
            },
            message: 'salePercentage must be greater than 0 when onSale is true, and 0 when onSale is false.'
        }
    }
}, { timestamps: true });

itemSchema.index({ sku: 1 }, { unique: true, sparse: true });

const Item = mongoose.model('Item', itemSchema);

function validateItem(item) {
    const schema = Joi.object({
        name: Joi.string().min(2).max(255).required(),
        description: Joi.string().max(1024).allow(''),
        image: Joi.string().max(2048).allow(''),
        sku: Joi.string().max(100).allow(''),
        sellingPrice: Joi.number().min(0).required(),
        purchasingPrice: Joi.number().min(0).required(),
        stockQuantity: Joi.number().integer().min(0).required(),
        status: Joi.string().valid('Active', 'Inactive', 'Discontinued'),
        hst: Joi.number().valid(0, 13),
        onSale: Joi.boolean().default(false),
        salePercentage: Joi.number().min(0).max(100).when('onSale', {
            is: true,
            then: Joi.number().min(0.01).max(100).required(),
            otherwise: Joi.number().valid(0).default(0)
        })
    });

    return schema.validate(item);
}

function validatePatch(item) {
    const schema = Joi.object({
        name: Joi.string().min(2).max(255),
        description: Joi.string().max(1024).allow(''),
        image: Joi.string().max(2048).allow(''),
        sku: Joi.string().max(100).allow(''),
        sellingPrice: Joi.number().min(0),
        purchasingPrice: Joi.number().min(0),
        stockQuantity: Joi.number().integer().min(0),
        status: Joi.string().valid('Active', 'Inactive', 'Discontinued'),
        hst: Joi.number().valid(0, 13),
        onSale: Joi.boolean(),
        salePercentage: Joi.number().min(0).max(100)
    }).min(1);

    return schema.validate(item);
}

module.exports.Item = Item;
module.exports.validate = validateItem;
module.exports.validatePatch = validatePatch;