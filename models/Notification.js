const mongoose = require('mongoose');
const Joi = require('joi');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    type: {
      type: String,
      enum: ['quote', 'admin_quote', 'system'],
      default: 'system',
    },
    relatedQuoteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Quote',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Notification = mongoose.model(
  'Notification',
  notificationSchema
);

module.exports.Notification = Notification;