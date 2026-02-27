const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { Order, validateOrder, validateOrderPatch } = require('../models/Order');
const { Invoice } = require('../models/Invoice');
const { Payment } = require('../models/Payment');
const generateDocumentNumber = require('../utils/generator');


const router = express.Router();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Get all orders for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort('-orderedDate');
    res.send(orders);
  } catch (err) {
    res.status(500).send(err.message);
  }
});
// Get a specific order by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).send('Order not found.');
    res.send(order);
  } catch (err) {
    res.status(400).send('Invalid order id.');
  }
});

// Create a new order AND generate an invoice
router.post('/', auth, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { error } = validateOrder({ ...req.body, userId: req.user._id });
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context?.custom);

    let createdOrder;
    let createdInvoice;

    await session.withTransaction(async () => {
      // 1) Create order (amount is auto-computed by pre('validate') in your model)

      const orderNumber = await generateDocumentNumber({
                            type: 'order',
                            prefix: 'ORD',
                            session,
                        });
                    
    const invoiceNumber = await generateDocumentNumber({
                            type: 'invoice',
                            prefix: 'INV',
                            session,
                        });

      const order = new Order({
        userId: req.user._id,
        project: req.body.project,
        orderNumber: orderNumber,
        lineItems: req.body.lineItems,
        orderedDate: req.body.orderedDate,
        shipmentDate: req.body.shipmentDate,
        status: req.body.status,
        discount: req.body.discount,
      });

      await order.save({ session });

      // 2) Create invoice linked to this order
      const now = new Date();
      const invoice = new Invoice({
        userId: req.user._id,
        project: order.project,
        invoiceNumber: invoiceNumber,
        amount: order.amount,
        balance: order.amount,
        orderId: order._id,
        dateIssued: now,
        dueDate: addDays(now, 30), // Net 30 example
        // status is handled by your invoice logic
      });

      await invoice.save({ session });

      createdOrder = order;
      createdInvoice = invoice;
    });

    res.status(201).send({ order: createdOrder, invoice: createdInvoice });
  } catch (err) {
    // Order has compound unique index { userId, orderNumber }, so this is enough:
    if (err.code === 11000) {
      return res.status(409).send('Duplicate order number or invoice number.');
    }
    res.status(500).send(err.message);
  } finally {
    session.endSession();
  }
});

// Update an order by ID (PATCH)
router.patch('/:id', auth, async (req, res) => {
  try {
    const { error } = validateOrderPatch(req.body);
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context?.custom);

    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).send('Order not found.');

    // Determine if request includes "financial" edits
    const financialFields = ['lineItems', 'discount', 'orderNumber', 'project', 'orderedDate'];
    const isTryingToEditFinancials = financialFields.some((f) => req.body[f] !== undefined);

    if (isTryingToEditFinancials) {
      // Find the invoice tied to this order (must belong to user)
      const invoice = await Invoice.findOne({ orderId: order._id, userId: req.user._id });
      if (invoice) {
        // Strict lock: if ANY payment exists, lock financial edits
        const hasPayments = await Payment.exists({ invoiceId: invoice._id, userId: req.user._id });


        if (hasPayments) {
          return res.status(403).send(
            'This order cannot be modified (line items/discount/etc.) because its invoice has payment activity. ' +
            'Create an adjustment or a new invoice instead.'
          );
        }
      }
    }

    // Non-financial fields (always allowed)
    if (req.body.shipmentDate !== undefined) order.shipmentDate = req.body.shipmentDate;
    if (req.body.status !== undefined) order.status = req.body.status;

    // Financial fields (allowed only if not locked by logic above)
    if (req.body.project !== undefined) order.project = req.body.project;
    if (req.body.orderNumber !== undefined) order.orderNumber = req.body.orderNumber;
    if (req.body.lineItems !== undefined) order.lineItems = req.body.lineItems;
    if (req.body.orderedDate !== undefined) order.orderedDate = req.body.orderedDate;
    if (req.body.discount !== undefined) order.discount = req.body.discount;

    await order.save(); // recomputes amount via pre('validate')
    // after await order.save()
    if (isTryingToEditFinancials) {
        const invoice = await Invoice.findOne({ orderId: order._id, userId: req.user._id });

        if (invoice) {
            // Since we already blocked if payments/partial paid, we can safely sync totals
            invoice.amount = order.amount;     // <-- make sure this matches your Order total field name
            invoice.balance = order.amount;    // reset balance because no payment activity
            if (req.body.project !== undefined){
                invoice.project = req.body.project;
            }
            await invoice.save();
        }
    }
    res.send(order);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send('Order number already exists for this user.');
    }
    res.status(500).send(err.message);
  }
});


// Delete an order by ID
// Rule: if invoice has ANY payment activity -> block delete
// If no payment activity -> delete BOTH invoice + order in a transaction
router.delete('/:id', auth, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    let deletedOrder;
    let deletedInvoice;

    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.id, userId: req.user._id }).session(session);
      if (!order) {
        // throw to exit transaction cleanly
        const e = new Error('Order not found.');
        e.statusCode = 404;
        throw e;
      }

      // Find invoice tied to this order (owned by user)
      const invoice = await Invoice.findOne({ orderId: order._id, userId: req.user._id }).session(session);

      // If invoice exists, block delete if any payment exists OR partially paid
      if (invoice) {
        const hasPayments = await Payment.exists({ invoiceId: invoice._id, userId: req.user._id }).session(session);

        if (hasPayments) {
          const e = new Error(
            'Cannot delete this order because its invoice has payment activity. Deletion is disabled.'
          );
          e.statusCode = 403;
          throw e;
        }

        deletedInvoice = await Invoice.findOneAndDelete({ _id: invoice._id, userId: req.user._id }).session(session);
      }

      deletedOrder = await Order.findOneAndDelete({ _id: order._id, userId: req.user._id }).session(session);
    });

    res.send({ order: deletedOrder, invoice: deletedInvoice || null });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).send(err.message);
    res.status(500).send(err.message);
  } finally {
    session.endSession();
  }
});

module.exports = router;