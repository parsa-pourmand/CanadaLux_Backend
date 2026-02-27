const Counter = require('../models/Counter');

async function generateDocumentNumber({ type, prefix, session }) {
  const counter = await Counter.findOneAndUpdate(
    { name: type },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, session }
  );

  const padded = String(counter.seq).padStart(6, '0');

  return `${prefix}-${padded}`;
}

module.exports = generateDocumentNumber;