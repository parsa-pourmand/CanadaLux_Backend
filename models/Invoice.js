const mongoose = require("mongoose");
const Joi = require("joi");

// Keep status consistent based on balance + dueDate
function calculateStatus({ balance, dueDate }) {
  if (balance === 0) return "Paid";
  if (dueDate && new Date(dueDate) < new Date()) return "Overdue";
  return "Pending";
}

const invoiceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balance: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (v) {
          if (this && typeof this.getUpdate === "function") return true;
          // balance should never exceed amount
          return v <= this.amount;
        },
        message: "Balance cannot exceed amount.",
      },
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    dateIssued: {
      type: Date,
      default: Date.now,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Overdue"],
      default: "Pending",
    },
  },
  { timestamps: true }
);

// Explicit unique index (more explicit/reliable than only `unique: true`)
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });

// Auto-sync status on save()
invoiceSchema.pre("save", function () {
  this.status = calculateStatus({ balance: this.balance, dueDate: this.dueDate });
  
});

// Auto-sync status on update queries (findOneAndUpdate/updateOne/updateMany)
invoiceSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], async function () {
  const update = this.getUpdate() || {};
  const $set = update.$set || update;

  // Only recalc if relevant fields change
  const touching =
    $set.balance !== undefined ||
    $set.dueDate !== undefined ||
    $set.amount !== undefined;

  if (!touching) return;

  const doc = await this.model.findOne(this.getQuery()).select("balance dueDate amount");
  if (!doc) return;

  const balance = $set.balance !== undefined ? $set.balance : doc.balance;
  const dueDate = $set.dueDate !== undefined ? $set.dueDate : doc.dueDate;
  const amount = $set.amount !== undefined ? $set.amount : doc.amount;

  // If amount changes, balance still must be <= amount
  if (balance > amount) {
    throw new Error("Balance cannot exceed amount.");
  }

  const status = calculateStatus({ balance, dueDate });

  this.setUpdate({
    ...update,
    $set: { ...(update.$set || {}), status },
  });
});

function validateInvoice(invoice) {
  const objectId = Joi.string().length(24).hex();

  const schema = Joi.object({
    userId: objectId.required(),
    project: objectId.required(),
    invoiceNumber: Joi.string().trim().required(),
    amount: Joi.number().min(0).required(),
    balance: Joi.number().min(0).required(),
    orderId: objectId.optional().allow(null, ""),
    status: Joi.string().valid("Pending", "Paid", "Overdue").optional(),
    dateIssued: Joi.date().optional(),
    dueDate: Joi.date().required(),
  }).custom((value, helpers) => {
    if (value.balance > value.amount) {
      return helpers.error("any.invalid", {
        custom: "Balance cannot exceed amount.",
      });
    }
    if (value.status === "Paid" && value.balance !== 0) {
      return helpers.error("any.invalid", {
        custom: "Paid invoices must have balance 0.",
      });
    }
    return value;
  });

  return schema.validate(invoice);
}

function validateInvoiceUpdate(invoice) {
  const objectId = Joi.string().length(24).hex();

  const schema = Joi.object({
    project: objectId.optional(),
    invoiceNumber: Joi.string().trim().optional(),
    amount: Joi.number().min(0).optional(),
    balance: Joi.number().min(0).optional(),
    orderId: objectId.optional().allow(null, ""),
    dateIssued: Joi.date().optional(),
    dueDate: Joi.date().optional(),
    status: Joi.string().valid("Pending", "Paid", "Overdue").optional(),
  }).min(1); // must include at least one field

  return schema.validate(invoice);
}


const Invoice = mongoose.model("Invoice", invoiceSchema);

module.exports.Invoice = Invoice;
module.exports.validate = validateInvoice;
module.exports.validateUpdate = validateInvoiceUpdate;
