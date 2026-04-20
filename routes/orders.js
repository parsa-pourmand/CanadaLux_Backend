const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { Order, validateOrder, validateOrderPatch } = require('../models/Order');
const { Invoice } = require('../models/Invoice');
const { Payment } = require('../models/Payment');
const generateDocumentNumber = require('../utils/generator');
const { Item } = require('../models/Item');
const { User } = require('../models/User');


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

router.post('/', auth, async (req, res) => {
  const session = await mongoose.startSession();

  const user = await User.findById(req.user._id).session(session);
  if (!user) {
    const e = new Error('User not found.');
    e.statusCode = 404;
    throw e;
  }

  let redeemedPoints = 0;

  if (req.body.redeemAllPoints) {
    if (user.points >= 100) {
      redeemedPoints = Math.floor(user.points / 100) * 100;
    }
  }

  try {
    const { error } = validateOrder({ ...req.body, userId: req.user._id });
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context?.custom);

    let createdOrder;
    let createdInvoice;

    await session.withTransaction(async () => {
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

      // 1) Check stock first
      for (const lineItem of req.body.lineItems) {
        const item = await Item.findById(lineItem.itemId).session(session);

        if (!item) {
          const e = new Error('One or more items were not found.');
          e.statusCode = 404;
          throw e;
        }

        if (item.stockQuantity < lineItem.quantity) {
          const e = new Error(`Not enough stock for item "${item.name}". Available: ${item.stockQuantity}, requested: ${lineItem.quantity}.`);
          e.statusCode = 400;
          throw e;
        }
      }

      // 2) Create order
      const order = new Order({
        userId: req.user._id,
        project: req.body.project,
        orderNumber,
        lineItems: req.body.lineItems,
        redeemedPoints,
        orderedDate: req.body.orderedDate,
        shipmentDate: req.body.shipmentDate,
        status: req.body.status,
      });

      await order.save({ session });

      // 3) Reduce stock
      for (const lineItem of order.lineItems) {
        await Item.findByIdAndUpdate(
          lineItem.itemId,
          { $inc: { stockQuantity: -lineItem.quantity } },
          { session }
        );
      }

      // 4) Add user points
      await User.findByIdAndUpdate(
        req.user._id,
        { $inc: { points: order.pointsEarned - redeemedPoints } },
        { session }
      );

      // 5) Create invoice
      const now = new Date();
      const invoice = new Invoice({
        userId: req.user._id,
        project: order.project,
        invoiceNumber,
        amount: order.amount,
        balance: order.amount,
        orderId: order._id,
        dateIssued: now,
        dueDate: addDays(now, 30),
      });

      await invoice.save({ session });

      createdOrder = order;
      createdInvoice = invoice;
    });

    res.status(201).send({ order: createdOrder, invoice: createdInvoice });
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).send(err.message);
    if (err.code === 11000) {
      return res.status(409).send('Duplicate order number or invoice number.');
    }
    res.status(500).send(err.message);
  } finally {
    session.endSession();
  }
});

router.patch('/:id', auth, async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { error } = validateOrderPatch(req.body);
    if (error) return res.status(400).send(error.details[0].message || error.details[0].context?.custom);

    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findOne({ _id: req.params.id, userId: req.user._id }).session(session);
      if (!order) {
        const e = new Error('Order not found.');
        e.statusCode = 404;
        throw e;
      }

      const oldPoints = order.pointsEarned || 0;
      const oldLineItems = order.lineItems.map(li => ({
        itemId: li.itemId.toString(),
        quantity: li.quantity,
      }));

      const financialFields = ['lineItems', 'orderNumber', 'project', 'orderedDate'];
      const isTryingToEditFinancials = financialFields.some((f) => req.body[f] !== undefined);

      if (isTryingToEditFinancials) {
        const invoice = await Invoice.findOne({ orderId: order._id, userId: req.user._id }).session(session);

        if (invoice) {
          const hasPayments = await Payment.exists({ invoiceId: invoice._id, userId: req.user._id }).session(session);
          if (hasPayments) {
            const e = new Error(
              'This order cannot be modified (line items/order/project/etc.) because its invoice has payment activity. Create an adjustment or a new invoice instead.'
            );
            e.statusCode = 403;
            throw e;
          }
        }

        // Restore old stock first
        for (const oldItem of oldLineItems) {
          await Item.findByIdAndUpdate(
            oldItem.itemId,
            { $inc: { stockQuantity: oldItem.quantity } },
            { session }
          );
        }

        // Check new stock before applying
        const newLineItems = req.body.lineItems !== undefined ? req.body.lineItems : order.lineItems;

        for (const lineItem of newLineItems) {
          const item = await Item.findById(lineItem.itemId).session(session);

          if (!item) {
            const e = new Error('One or more items were not found.');
            e.statusCode = 404;
            throw e;
          }

          if (item.stockQuantity < lineItem.quantity) {
            const e = new Error(`Not enough stock for item "${item.name}". Available: ${item.stockQuantity}, requested: ${lineItem.quantity}.`);
            e.statusCode = 400;
            throw e;
          }
        }

        // Apply financial changes
        if (req.body.project !== undefined) order.project = req.body.project;
        if (req.body.orderNumber !== undefined) order.orderNumber = req.body.orderNumber;
        if (req.body.lineItems !== undefined) order.lineItems = req.body.lineItems;
        if (req.body.orderedDate !== undefined) order.orderedDate = req.body.orderedDate;

        await order.save({ session });

        // Deduct new stock
        for (const newItem of order.lineItems) {
          await Item.findByIdAndUpdate(
            newItem.itemId,
            { $inc: { stockQuantity: -newItem.quantity } },
            { session }
          );
        }

        // Sync invoice
        const invoice = await Invoice.findOne({ orderId: order._id, userId: req.user._id }).session(session);
        if (invoice) {
          invoice.amount = order.amount;
          invoice.balance = order.amount;
          if (req.body.project !== undefined) invoice.project = req.body.project;
          await invoice.save({ session });
        }

        // Adjust points difference
        const newPoints = order.pointsEarned || 0;
        const pointsDiff = newPoints - oldPoints;

        if (pointsDiff !== 0) {
          await User.findByIdAndUpdate(
            req.user._id,
            { $inc: { points: pointsDiff } },
            { session }
          );
        }
      } else {
        if (req.body.shipmentDate !== undefined) order.shipmentDate = req.body.shipmentDate;
        if (req.body.status !== undefined) order.status = req.body.status;

        await order.save({ session });
      }

      updatedOrder = order;
    });

    res.send(updatedOrder);
  } catch (err) {
    if (err.statusCode) return res.status(err.statusCode).send(err.message);
    if (err.code === 11000) {
      return res.status(409).send('Order number already exists for this user.');
    }
    res.status(500).send(err.message);
  } finally {
    session.endSession();
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
        const e = new Error('Order not found.');
        e.statusCode = 404;
        throw e;
      }

      const invoice = await Invoice.findOne({ orderId: order._id, userId: req.user._id }).session(session);

      if (invoice) {
        const hasPayments = await Payment.exists({ invoiceId: invoice._id, userId: req.user._id }).session(session);
        if (hasPayments) {
          const e = new Error('Cannot delete this order because its invoice has payment activity. Deletion is disabled.');
          e.statusCode = 403;
          throw e;
        }

        deletedInvoice = await Invoice.findOneAndDelete({ _id: invoice._id, userId: req.user._id }).session(session);
      }

      // Restore stock
      for (const lineItem of order.lineItems) {
        await Item.findByIdAndUpdate(
          lineItem.itemId,
          { $inc: { stockQuantity: lineItem.quantity } },
          { session }
        );
      }

      // Remove points earned by this order
      const netPoints = (order.pointsEarned || 0) - (order.redeemedPoints || 0);

      if (netPoints !== 0) {
        await User.findByIdAndUpdate(
          req.user._id,
          { $inc: { points: -netPoints } },
          { session }
        );
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