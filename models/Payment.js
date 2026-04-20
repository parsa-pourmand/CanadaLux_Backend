const mongoose = require('mongoose');
const Joi = require('joi');

const paymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    unappliedAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },
    method: {
      type: String,
      enum: ['Credit Card', 'PayPal', 'Bank Transfer', 'Cash', 'Other'],
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, paymentNumber: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

function validatePayment(payment) {
  const schema = Joi.object({
    userId: Joi.string().length(24).hex().required(),
    amount: Joi.number().greater(0).required(),
    date: Joi.date().optional(),
    method: Joi.string()
      .valid('Credit Card', 'PayPal', 'Bank Transfer', 'Cash', 'Other')
      .required(),
    notes: Joi.string().allow('').trim().optional(),
  }).unknown(false);

  return schema.validate(payment);
}

// Keep patch very limited for safety
function validatePaymentPatch(payment) {
  const schema = Joi.object({
    date: Joi.date().optional(),
    method: Joi.string().valid('Credit Card', 'PayPal', 'Bank Transfer', 'Cash', 'Other').optional(),
    notes: Joi.string().allow('').trim().optional(),
  })
    .min(1)
    .unknown(false);

  return schema.validate(payment);
}

module.exports = {
  Payment,
  validatePayment,
  validatePaymentPatch,
};