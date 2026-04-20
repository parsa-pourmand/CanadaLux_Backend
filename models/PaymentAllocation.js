const mongoose = require('mongoose');

const paymentAllocationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      required: true,
    },
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    amountApplied: {
      type: Number,
      required: true,
      min: 0.01,
    },
  },
  { timestamps: true }
);

paymentAllocationSchema.index({ paymentId: 1, invoiceId: 1 });
paymentAllocationSchema.index({ userId: 1, invoiceId: 1 });
paymentAllocationSchema.index({ userId: 1, paymentId: 1 });

const PaymentAllocation = mongoose.model('PaymentAllocation', paymentAllocationSchema);

module.exports = {
  PaymentAllocation,
};