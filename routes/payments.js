const express = require('express');
const { Payment, validatePayment, validatePaymentPatch } = require('../models/Payment');
const {Invoice} = require('../models/Invoice');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all payments for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user._id }).sort('-date');
    res.send(payments);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Create a new payment
router.post('/', auth, async (req, res) => {
  try {
    const { error } = validatePayment({ ...req.body, userId: req.user._id });
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context.custom);

    const invoice = await Invoice.findOne({ _id: req.body.invoiceId, userId: req.user._id });
    if (!invoice) return res.status(404).send('Invoice not found.');

    // Check if payment amount exceeds invoice balance
    if (req.body.amount > invoice.balance) {
      return res.status(400).send('Payment amount cannot exceed invoice balance.');
    }

    const payment = new Payment({
      userId: req.user._id,
      invoiceId: req.body.invoiceId,
      paymentNumber: req.body.paymentNumber,
      amount: req.body.amount,
      date: req.body.date, // optional; model defaults
      method: req.body.method,
      notes: req.body.notes,
    });

    await payment.save();

    // Update the invoice balance
    invoice.balance -= payment.amount;
    await invoice.save();

    res.status(201).send(payment);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.paymentNumber) {
      return res.status(409).send('Payment number already exists.');
    }
    res.status(500).send(err.message);
  }
});

// Get a specific payment by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!payment) return res.status(404).send('Payment not found.');
    res.send(payment);
  } catch (err) {
    res.status(400).send('Invalid payment id.');
  }
}); 

// Update a payment by ID
router.patch('/:id', auth, async (req, res) => {
  try {
    const { error } = validatePaymentPatch(req.body);
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context.custom);

    const payment = await Payment.findOne({ _id: req.params.id, userId: req.user._id });
    if (!payment) return res.status(404).send('Payment not found.');

    const oldInvoiceId = String(payment.invoiceId);
    const newInvoiceId = String(req.body.invoiceId ?? payment.invoiceId);

    const oldAmount = payment.amount;
    const newAmount = req.body.amount ?? payment.amount;

    // Load the old invoice (must belong to the user)
    const oldInvoice = await Invoice.findOne({ _id: oldInvoiceId, userId: req.user._id });
    if (!oldInvoice) return res.status(404).send('Invoice not found.');

    // Load the target invoice (could be the same as old)
    const targetInvoice =
      newInvoiceId === oldInvoiceId
        ? oldInvoice
        : await Invoice.findOne({ _id: newInvoiceId, userId: req.user._id });

    if (!targetInvoice) return res.status(404).send('New invoice not found.');

    // Update invoice balances safely
    if (newInvoiceId === oldInvoiceId) {
      // Same invoice: only the difference matters
      const diff = newAmount - oldAmount; // new - old
      if (diff > targetInvoice.balance) {
        return res.status(400).send('Payment amount cannot exceed invoice balance.');
      }

      targetInvoice.balance -= diff;
      await targetInvoice.save();
    } else {
      // Invoice changed: refund old invoice, charge new invoice
      if (newAmount > targetInvoice.balance) {
        return res.status(400).send('Payment amount cannot exceed invoice balance.');
      }

      oldInvoice.balance += oldAmount;
      targetInvoice.balance -= newAmount;

      await oldInvoice.save();
      await targetInvoice.save();
    }

    // Apply only provided fields (avoid overwriting with undefined)
    if (req.body.invoiceId !== undefined) payment.invoiceId = req.body.invoiceId;
    if (req.body.paymentNumber !== undefined) payment.paymentNumber = req.body.paymentNumber;
    if (req.body.amount !== undefined) payment.amount = req.body.amount;
    if (req.body.date !== undefined) payment.date = req.body.date;
    if (req.body.method !== undefined) payment.method = req.body.method;
    if (req.body.notes !== undefined) payment.notes = req.body.notes;

    await payment.save();

    res.send(payment);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.paymentNumber) {
      return res.status(409).send('Payment number already exists.');
    }
    res.status(500).send(err.message);
  }
});


router.delete('/:id', auth, async (req, res) => {
  try {
    const payment = await Payment.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!payment) return res.status(404).send('Payment not found.');

    // Update the invoice balance
    const invoice = await Invoice.findOne({ _id: payment.invoiceId, userId: req.user._id });
    if (invoice) {
      invoice.balance += payment.amount;
      await invoice.save();
    }

    res.send(payment);
  } catch (err) {
    res.status(400).send('Invalid payment id.');
  }
});


module.exports = router;