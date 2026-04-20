const mongoose = require('mongoose');
const Joi = require('joi');

const lineItemSchema = new mongoose.Schema(
  {
    itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 }, // final per-unit price snapshot after sale + tax, before user discount
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
      default: 0,
    },
    redeemedPoints: {
      type: Number,
      min: 0,
      default: 0,
    },
    redeemedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    profit: {
      type: Number,
      min: 0,
      default: 0,
    },
    pointsEarned: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { timestamps: true }
);

orderSchema.index({ userId: 1, orderNumber: 1 }, { unique: true });

orderSchema.pre('validate', async function (next) {
  try {
    const User = mongoose.model('User');
    const Item = mongoose.model('Item');

    const user = await User.findById(this.userId).select('discount');
    const userDiscountPercent = Number(user?.discount || 0);

    let subtotalBeforeAnyDiscount = 0;   // original price + tax
    let subtotalAfterSaleBeforeUser = 0; // sale-adjusted + tax
    let profitBeforeUserDiscount = 0;    // sale-adjusted profit before user discount

    for (const lineItem of this.lineItems || []) {
      const item = await Item.findById(lineItem.itemId);
      if (!item) throw new Error('Item not found.');

      const quantity = Number(lineItem.quantity || 0);
      const originalSellingPrice = Number(item.sellingPrice || 0);

      let saleAdjustedSellingPrice = originalSellingPrice;
      if (item.onSale && item.salePercentage > 0) {
        saleAdjustedSellingPrice = originalSellingPrice * (1 - item.salePercentage / 100);
      }

      const taxMultiplier = Number(item.hst) === 13 ? 1.13 : 1;

      const originalUnitPriceWithTax = originalSellingPrice * taxMultiplier;
      const saleAdjustedUnitPriceWithTax = saleAdjustedSellingPrice * taxMultiplier;

      subtotalBeforeAnyDiscount += originalUnitPriceWithTax * quantity;
      subtotalAfterSaleBeforeUser += saleAdjustedUnitPriceWithTax * quantity;

      lineItem.unitPrice = Math.round(saleAdjustedUnitPriceWithTax * 100) / 100;

      const purchasingPrice = Number(item.purchasingPrice || 0);
      const profitPerUnit = Math.max(0, saleAdjustedSellingPrice - purchasingPrice);
      profitBeforeUserDiscount += profitPerUnit * quantity;
    }

    const userDiscountAmount = subtotalAfterSaleBeforeUser * (userDiscountPercent / 100);
    const subtotalAfterUserDiscount = subtotalAfterSaleBeforeUser - userDiscountAmount;

    // apply redeemed points
    let redeemedAmount = Number(this.redeemedPoints || 0) / 100;

    // don't allow over-discount
    if (redeemedAmount > subtotalAfterUserDiscount) {
      redeemedAmount = subtotalAfterUserDiscount;
    }

    const finalAmount = subtotalAfterUserDiscount - redeemedAmount;

    // total discount includes sale + user discount + redeemed points
    const totalDiscountAmount = subtotalBeforeAnyDiscount - finalAmount;

    // adjust profit proportionally
    let finalProfit = profitBeforeUserDiscount;

    if (subtotalAfterSaleBeforeUser > 0) {
      finalProfit *= subtotalAfterUserDiscount / subtotalAfterSaleBeforeUser;
    }

    if (subtotalAfterUserDiscount > 0) {
      finalProfit *= finalAmount / subtotalAfterUserDiscount;
    } else {
      finalProfit = 0;
    }

    this.discount = Math.round(totalDiscountAmount * 100) / 100;
    this.redeemedAmount = Math.round(redeemedAmount * 100) / 100;
    this.amount = Math.round(finalAmount * 100) / 100;
    this.profit = Math.round(Math.max(0, finalProfit) * 100) / 100;
    this.pointsEarned = Math.floor(this.profit * 5);

    next();
  } catch (err) {
    next(err);
  }
});

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
          notes: Joi.string().allow('').trim().optional(),
        }).unknown(false)
      )
      .min(1)
      .required(),
    orderedDate: Joi.date().optional(),
    shipmentDate: Joi.date().optional(),
    status: Joi.string().valid('Pending', 'Shipped', 'Delivered', 'Cancelled').optional(),
  }).unknown(false);

  return schema.validate(order);
}

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
          notes: Joi.string().allow('').trim().optional(),
        }).unknown(false)
      )
      .min(1)
      .optional(),
    orderedDate: Joi.date().optional(),
    shipmentDate: Joi.date().optional(),
    status: Joi.string().valid('Pending', 'Shipped', 'Delivered', 'Cancelled').optional(),
  })
    .min(1)
    .unknown(false);

  return schema.validate(order);
}

const Order = mongoose.model('Order', orderSchema);

module.exports = {
  Order,
  validateOrder,
  validateOrderPatch,
};