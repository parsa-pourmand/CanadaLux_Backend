const mongoose = require('mongoose');
const Joi = require('joi');

const lineItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // snapshot at order time
    notes: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    lineItems: {
      type: [lineItemSchema],
      required: true,
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: 'Order must include at least one line item.',
      },
    },
    // Computed on server from lineItems + discount
    amount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    orderedDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    shipmentDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
      default: 'Pending',
    },
    discount: {
      type: Number,
      min: 0,
      max: 100,
      default: 0, // percentage
    },
  },
  { timestamps: true }
);

// Unique per user
orderSchema.index({ userId: 1, orderNumber: 1 }, { unique: true });

// Compute amount from lineItems + discount (rounded to 2 decimals)
orderSchema.pre('validate', function () {
  const subtotal = (this.lineItems || []).reduce((sum, li) => {
    const qty = Number(li.quantity || 0);
    const price = Number(li.unitPrice || 0);
    return sum + qty * price;
  }, 0);

  const discount = Number(this.discount || 0);
  const discountFactor = 1 - discount / 100;

  const total = subtotal * discountFactor;

  // round to 2 decimals
  this.amount = Math.round(total * 100) / 100;
});

const Order = mongoose.model('Order', orderSchema);

/**
 * CREATE validation (POST)
 * - amount is NOT accepted from client (server computes it)
 * - unknown(false) blocks extra fields
 */
function validateOrder(order) {
  const objectId = Joi.string().length(24).hex();

  const schema = Joi.object({
    userId: objectId.required(),
    project: objectId.required(),
    lineItems: Joi.array()
      .items(
        Joi.object({
          itemId: objectId.required(),
          quantity: Joi.number().integer().min(1).required(),
          unitPrice: Joi.number().min(0).required(),
          notes: Joi.string().allow('').trim().optional(),
        }).unknown(false)
      )
      .min(1)
      .required(),

    orderedDate: Joi.date().optional(),
    shipmentDate: Joi.date().optional(),
    status: Joi.string().valid('Pending', 'Shipped', 'Delivered', 'Cancelled').optional(),
    discount: Joi.number().min(0).max(100).optional(),
  }).unknown(false);

  return schema.validate(order);
}

/**
 * PATCH validation (optional but useful)
 * - all fields optional
 * - still blocks unknown keys
 * - amount is NOT patchable by client
 */
function validateOrderPatch(order) {
  const objectId = Joi.string().length(24).hex();

  const schema = Joi.object({
    project: objectId.optional(),
    orderNumber: Joi.string().trim().optional(),

    lineItems: Joi.array()
      .items(
        Joi.object({
          itemId: objectId.required(),
          quantity: Joi.number().integer().min(1).required(),
          unitPrice: Joi.number().min(0).required(),
          notes: Joi.string().allow('').trim().optional(),
        }).unknown(false)
      )
      .min(1)
      .optional(),

    orderedDate: Joi.date().optional(),
    shipmentDate: Joi.date().optional(),
    status: Joi.string().valid('Pending', 'Shipped', 'Delivered', 'Cancelled').optional(),
    discount: Joi.number().min(0).max(100).optional(),
  })
    .min(1)
    .unknown(false);

  return schema.validate(order);
}

module.exports = {
  Order,
  validateOrder,
  validateOrderPatch,
};