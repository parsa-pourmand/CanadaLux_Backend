const { PaymentAllocation } = require('../models/PaymentAllocation');

async function hasInvoicePaymentActivity(invoiceId, userId, session = null) {
  const query = PaymentAllocation.exists({ invoiceId, userId });
  if (session) query.session(session);
  return !!(await query);
}

module.exports = hasInvoicePaymentActivity;