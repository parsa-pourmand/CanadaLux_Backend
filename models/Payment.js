const mongoose = require('mongoose');
const Joi = require('joi');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice',
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
  },
}, 
    { timestamps: true }
);

paymentSchema.index({ userId: 1, paymentNumber: 1 }, { unique: true });

const Payment = mongoose.model('Payment', paymentSchema);

function validatePayment(payment) {

    const objectId = Joi.string().length(24).hex();

    const schema = Joi.object({
        userId: objectId.required(),
        invoiceId: objectId.required(),
        paymentNumber: Joi.string().required(),
        amount: Joi.number().greater(0).required(),
        date: Joi.date(),
        method: Joi.string().valid('Credit Card', 'PayPal', 'Bank Transfer', 'Cash', 'Other').required(),
        notes: Joi.string().allow('').trim(),
    });
    return schema.validate(payment);
}


function validatePaymentPatch(payment) {
  const objectId = Joi.string().length(24).hex();

  const schema = Joi.object({

    invoiceId: objectId,
    paymentNumber: Joi.string().trim(),
    amount: Joi.number().greater(0),
    date: Joi.date(),
    method: Joi.string().valid('Credit Card', 'PayPal', 'Bank Transfer', 'Cash', 'Other'),
    notes: Joi.string().allow('').trim(),
  })
    .min(1) // must provide at least one field
    .unknown(false); // reject extra fields

  return schema.validate(payment);
}

module.exports = {
  Payment,
  validatePayment,
  validatePaymentPatch
};