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
        status: Joi.string().valid('Active', 'Inactive', 'Discontinued')
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
        status: Joi.string().valid('Active', 'Inactive', 'Discontinued')
    }).min(1);

    return schema.validate(item);
}
module.exports.Item = Item;
module.exports.validate = validateItem;
module.exports.validatePatch = validatePatch;