const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const { User } = require('../models/User');
const { Invoice } = require('../models/Invoice');
const { Payment } = require('../models/Payment');
const { PaymentAllocation } = require('../models/PaymentAllocation');

const router = express.Router();

router.patch('/users/:id/discount', [auth, admin], async (req, res) => {
  const discount = Number(req.body.discount);

  if (Number.isNaN(discount) || discount < 0 || discount > 100) {
    return res.status(400).send('Discount must be a number between 0 and 100.');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { $set: { discount } },
    { new: true, runValidators: true }
  );

  if (!user) return res.status(404).send('User not found.');

  res.send(user);
});

router.post('/invoices/:id/apply-credit', [auth, admin], async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let updatedInvoice;
    let allocationsCreated = [];
    let totalApplied = 0;

    await session.withTransaction(async () => {
      const invoice = await Invoice.findById(req.params.id).session(session);

      if (!invoice) {
        const e = new Error('Invoice not found.');
        e.statusCode = 404;
        throw e;
      }

      if (invoice.balance <= 0) {
        const e = new Error('This invoice has no outstanding balance.');
        e.statusCode = 400;
        throw e;
      }

      const creditPayments = await Payment.find({
        userId: invoice.userId,
        unappliedAmount: { $gt: 0 }
      })
        .sort({ date: 1, _id: 1 })
        .session(session);

      if (!creditPayments.length) {
        const e = new Error('No available credit to apply.');
        e.statusCode = 400;
        throw e;
      }

      let remainingInvoiceBalance = Number(invoice.balance || 0);

      for (const payment of creditPayments) {
        if (remainingInvoiceBalance <= 0) break;

        const availableCredit = Number(payment.unappliedAmount || 0);
        if (availableCredit <= 0) continue;

        const amountApplied = Math.min(remainingInvoiceBalance, availableCredit);
        const roundedAmountApplied = Number(amountApplied.toFixed(2));

        if (roundedAmountApplied <= 0) continue;

        const allocation = new PaymentAllocation({
          userId: invoice.userId,
          paymentId: payment._id,
          invoiceId: invoice._id,
          amountApplied: roundedAmountApplied,
        });

        await allocation.save({ session });

        payment.unappliedAmount = Number(
          (Number(payment.unappliedAmount) - roundedAmountApplied).toFixed(2)
        );
        await payment.save({ session });

        remainingInvoiceBalance = Number(
          (remainingInvoiceBalance - roundedAmountApplied).toFixed(2)
        );

        totalApplied = Number((totalApplied + roundedAmountApplied).toFixed(2));
        allocationsCreated.push(allocation);
      }

      invoice.balance = remainingInvoiceBalance;
      await invoice.save({ session });

      updatedInvoice = invoice;
    });

    res.send({
      invoice: updatedInvoice,
      totalApplied,
      allocations: allocationsCreated,
    });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).send(err.message);
    res.status(500).send(err.message);
  } finally {
    session.endSession();
  }
});

module.exports = router;