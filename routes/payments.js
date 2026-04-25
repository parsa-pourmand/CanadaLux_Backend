const express = require('express');
const mongoose = require('mongoose');
const { Payment, validatePayment, validatePaymentPatch } = require('../models/Payment');
const { PaymentAllocation } = require('../models/PaymentAllocation');
const { Invoice } = require('../models/Invoice');

const validateObjectId = require('../middleware/validateObjectId');
const auth = require('../middleware/auth');
const generateDocumentNumber = require('../utils/generator');

const router = express.Router();

// Get all payments for the authenticated user
router.get('/', auth, async (req, res, next) => {
  try {
    const payments = await Payment.find({ userId: req.user._id }).sort('-date');
    res.send(payments);
  } catch (err) {
    next(err);
  }
});

// Get a specific payment by ID, with allocations
router.get('/:id', [auth, validateObjectId], async (req, res, next) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!payment) return res.status(404).send('Payment not found.');

    const allocations = await PaymentAllocation.find({
      paymentId: payment._id,
      userId: req.user._id,
    }).sort('createdAt');

    res.send({ payment, allocations });
  } catch (err) {
    next(err);
  }
});

router.get('/credit-summary', auth, async (req, res, next) => {
  try {
    const payments = await Payment.find({
      userId: req.user._id,
      unappliedAmount: { $gt: 0 }
    }).sort({ date: 1 });

    const totalCredit = payments.reduce(
      (sum, p) => sum + Number(p.unappliedAmount || 0),
      0
    );

    res.send({
      totalCredit: Number(totalCredit.toFixed(2)),
      credits: payments.map(p => ({
        paymentId: p._id,
        paymentNumber: p.paymentNumber,
        date: p.date,
        unappliedAmount: p.unappliedAmount
      }))
    });
  } catch (err) {
    next(err);
  }
});

// Create a new payment and auto-apply it to oldest unpaid invoices first
router.post('/', auth, async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { error } = validatePayment({ ...req.body, userId: req.user._id });
    if (error) {
      return res.status(400).send(error.details[0].message || error.details[0].context?.custom);
    }

    let createdPayment;
    let createdAllocations = [];

    await session.withTransaction(async () => {
      const unpaidInvoices = await Invoice.find(
        {
          userId: req.user._id,
          balance: { $gt: 0 },
        },
        null,
        { session }
      ).sort({ dateIssued: 1, _id: 1 });

      if (!unpaidInvoices.length) {
        const e = new Error('There are no unpaid invoices for this customer.');
        e.statusCode = 400;
        throw e;
      }

      let remainingAmount = Number(req.body.amount);

      const paymentNumber = await generateDocumentNumber({
        type: 'payment',
        prefix: 'PAY',
        session,
      });

      const payment = new Payment({
        userId: req.user._id,
        paymentNumber,
        amount: Number(req.body.amount),
        unappliedAmount: 0,
        method: req.body.method,
        notes: req.body.notes,
        ...(req.body.date ? { date: req.body.date } : {}),
      });

      await payment.save({ session });

      for (const invoice of unpaidInvoices) {
        if (remainingAmount <= 0) break;

        const invoiceBalance = Number(invoice.balance || 0);
        if (invoiceBalance <= 0) continue;

        const amountApplied = Math.min(invoiceBalance, remainingAmount);

        invoice.balance = Number((invoiceBalance - amountApplied).toFixed(2));
        await invoice.save({ session });

        const allocation = new PaymentAllocation({
          userId: req.user._id,
          paymentId: payment._id,
          invoiceId: invoice._id,
          amountApplied: Number(amountApplied.toFixed(2)),
        });

        await allocation.save({ session });
        createdAllocations.push(allocation);

        remainingAmount = Number((remainingAmount - amountApplied).toFixed(2));
      }

      payment.unappliedAmount = Number(Math.max(0, remainingAmount).toFixed(2));
      await payment.save({ session });

      createdPayment = payment;
    });

    res.status(201).send({
      payment: createdPayment,
      allocations: createdAllocations,
    });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
});

// Update a payment by ID
// Keep this intentionally limited: metadata only
router.patch('/:id', [auth, validateObjectId], async (req, res, next) => {
  try {
    const { error } = validatePaymentPatch(req.body);
    if (error) {
      return res.status(400).send(error.details[0].message || error.details[0].context?.custom);
    }

    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!payment) return res.status(404).send('Payment not found.');

    if (req.body.date !== undefined) payment.date = req.body.date;
    if (req.body.method !== undefined) payment.method = req.body.method;
    if (req.body.notes !== undefined) payment.notes = req.body.notes;

    await payment.save();

    res.send(payment);
  } catch (err) {
   next(err);
  }
});

// Delete a payment by ID and restore all affected invoice balances
router.delete('/:id', [auth, validateObjectId], async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    let deletedPayment;
    let deletedAllocations = [];

    await session.withTransaction(async () => {
      const payment = await Payment.findOne(
        { _id: req.params.id, userId: req.user._id },
        null,
        { session }
      );

      if (!payment) {
        const e = new Error('Payment not found.');
        e.statusCode = 404;
        throw e;
      }

      const allocations = await PaymentAllocation.find(
        { paymentId: payment._id, userId: req.user._id },
        null,
        { session }
      );

      for (const allocation of allocations) {
        const invoice = await Invoice.findOne(
          { _id: allocation.invoiceId, userId: req.user._id },
          null,
          { session }
        );

        if (invoice) {
          invoice.balance = Number((Number(invoice.balance || 0) + Number(allocation.amountApplied || 0)).toFixed(2));
          await invoice.save({ session });
        }
      }

      await PaymentAllocation.deleteMany(
        { paymentId: payment._id, userId: req.user._id },
        { session }
      );

      deletedPayment = await Payment.findOneAndDelete(
        { _id: payment._id, userId: req.user._id },
        { session }
      );

      deletedAllocations = allocations;
    });

    res.send({
      payment: deletedPayment,
      allocations: deletedAllocations,
    });
  } catch (err) {
    next(err);
  } finally {
    session.endSession();
  }
});

module.exports = router;
