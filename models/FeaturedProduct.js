const mongoose = require('mongoose');
const Joi = require('joi');

const featuredProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 255,
    trim: true,
  },
  description: {
    type: String,
    default: '',
    maxlength: 1000,
  },
  expectedPrice: {
    type: Number,
    min: 0,
    default: 0,
  },
  images: {
    type: [String],
    default: [],
  },
  expectedArrivalDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['Coming Soon', 'Available', 'Cancelled'],
    default: 'Coming Soon',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const FeaturedProduct = mongoose.model(
  'FeaturedProduct',
  featuredProductSchema
);

function validateFeaturedProduct(product) {
  const schema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(1000).allow('').optional(),
    expectedPrice: Joi.number().min(0).optional(),
    images: Joi.array().items(Joi.string()).optional(),
    expectedArrivalDate: Joi.date().optional(),
    status: Joi.string()
      .valid('Coming Soon', 'Available', 'Cancelled')
      .optional(),
  });

  return schema.validate(product);
}

module.exports.FeaturedProduct = FeaturedProduct;
module.exports.validate = validateFeaturedProduct;