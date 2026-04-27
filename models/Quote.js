const mongoose = require('mongoose');
const Joi = require('joi');

const quoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 255,
    },
    details: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 5000,
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['Pending', 'SentToRetailer', 'Responded', 'Closed', 'Cancelled'],
      default: 'Pending',
    },
    retailerResponse: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
    respondedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

function validateQuote(quote) {
  const schema = Joi.object({
    userId: Joi.string().length(24).hex().required(),
    title: Joi.string().trim().min(2).max(255).required(),
    details: Joi.string().trim().min(5).max(5000).required(),
    images: Joi.array().items(Joi.string()).optional(),
  }).unknown(false);

  return schema.validate(quote);
}

function validateQuoteResponse(body) {
  const schema = Joi.object({
    retailerResponse: Joi.string().trim().min(1).max(5000).required(),
  }).unknown(false);

  return schema.validate(body);
}

const Quote = mongoose.model('Quote', quoteSchema);

module.exports = {
  Quote,
  validateQuote,
  validateQuoteResponse,
};