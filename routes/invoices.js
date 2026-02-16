const express = require("express");
const { Invoice, validate, validateUpdate } = require("../models/Invoice");
const auth = require("../middleware/auth");

const router = express.Router();

// Get all invoices for the authenticated user
router.get("/", auth, async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user._id }).sort("-dateIssued");
    res.send(invoices);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Create a new invoice
router.post("/", auth, async (req, res) => {

  try {
    const { error } = validate({ ...req.body, userId: req.user._id }); // ensure validation passes
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context.custom);

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
  
    if (err.code === 11000 && err.keyPattern?.invoiceNumber) {
      return res.status(409).send("Invoice number already exists.");
    }
    res.status(500).send(err.message);
  }
});

// Get a specific invoice by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).send("Invoice not found.");
    res.send(invoice);
  } catch (err) {
    res.status(400).send("Invalid invoice id.");
  }
});

// Update an invoice by ID
router.patch("/:id", auth, async (req, res) => {
  try {
    const { error } = validateUpdate(req.body);
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context.custom);

    const invoice = await Invoice.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        $set: {
          ...req.body,
        },
      },
      { new: true, runValidators: true } 
    );

    if (!invoice) return res.status(404).send("Invoice not found.");
    res.send(invoice);
  } catch (err) {
    if (err.code === 11000 && err.keyPattern?.invoiceNumber) {
      return res.status(409).send("Invoice number already exists.");
    }
    // CastError invalid ObjectId, etc.
    res.status(400).send(err.message);
  }
});

// Delete an invoice by ID
router.delete("/:id", auth, async (req, res) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!invoice) return res.status(404).send("Invoice not found.");
    res.send(invoice);
  } catch (err) {
    res.status(400).send("Invalid invoice id.");
  }
});

module.exports = router;
