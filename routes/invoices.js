const express = require("express");
const { Invoice, validate, validateUpdate } = require("../models/Invoice");
const auth = require("../middleware/auth");
const { Payment } = require("../models/Payment");
const { Project } = require('../models/Project');
const hasInvoicePaymentActivity = require('../utils/hasInvoicePaymentActivity');

const router = express.Router();

// Get all invoices for the authenticated user
router.get("/", auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id }).sort("-dateIssued");
    res.send(invoices);
  } catch (err) {
    next(err);
  }
});

// Create a new invoice
router.post("/", auth, async (req, res) => {

  try {
    const { error } = validate({ ...req.body, userId: req.user._id }); // ensure validation passes
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context.custom);

    const project = await Project.findOne({
      _id: req.body.project,
      userId: req.user._id
    });

    if (!project) return res.status(404).send('Project not found.');

    const invoice = new Invoice({
      userId: req.user._id,
      project: req.body.project,
      invoiceNumber: req.body.invoiceNumber,
      amount: req.body.amount,
      balance: req.body.balance,
      orderId: req.body.orderId,
      dateIssued: req.body.dateIssued, // optional; model defaults
      dueDate: req.body.dueDate,
    });

    

    await invoice.save(); 
    res.status(201).send(invoice);

  } catch (err) {
    next(err);
  }
});

// Get a specific invoice by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).send("Invoice not found.");
    res.send(invoice);
  } catch (err) {
    next(err);
  }
});


// Update an invoice by ID
router.patch("/:id", auth, async (req, res) => {
  try {
    const { error } = validateUpdate(req.body);
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context?.custom);

    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).send("Invoice not found.");

    // Check if invoice has any payment activity
    const hasPayments = await hasInvoicePaymentActivity(invoice._id, req.user._id);

    // If there are payments, block changing amount
    if (hasPayments) {
      const blockedFields = ["amount"]; 
      const isTryingToEditBlocked = blockedFields.some((f) => req.body[f] !== undefined);

      if (isTryingToEditBlocked) {
        return res
          .status(403)
          .send("This invoice cannot be modified (amount) because it has payment activity. Create an adjustment/refund instead.");
      }
    }

    // Apply allowed updates
    Object.assign(invoice, req.body);

    await invoice.save(); // runs validators
    res.send(invoice);
  } catch (err) {
    next(err);
  }
});

// Delete an invoice by ID
router.delete("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).send("Invoice not found.");

    // Block delete if any payment exists
    const hasPayments = await hasInvoicePaymentActivity(invoice._id, req.user._id);

    if (hasPayments) {
      return res
        .status(403)
        .send("This invoice cannot be deleted because it has payment activity. Void/refund it instead.");
    }

    await invoice.deleteOne();
    res.send(invoice);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
