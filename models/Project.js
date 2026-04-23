const mongoose = require('mongoose');
const Joi = require('joi');

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 255,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1024,
      default: '',
    },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Cancelled'],
      default: 'Active',
    },
  },
  { timestamps: true }
);

projectSchema.index({ userId: 1, name: 1 }, { unique: true });

const Project = mongoose.model('Project', projectSchema);

function validateProject(project) {
  const schema = Joi.object({
    userId: Joi.string().length(24).hex().required(),
    name: Joi.string().trim().min(2).max(255).required(),
    description: Joi.string().allow('').trim().max(1024).optional(),
    status: Joi.string().valid('Active', 'Completed', 'Cancelled').optional(),
  }).unknown(false);

  return schema.validate(project);
}

function validateProjectPatch(project) {
  const schema = Joi.object({
    name: Joi.string().trim().min(2).max(255).optional(),
    description: Joi.string().allow('').trim().max(1024).optional(),
    status: Joi.string().valid('Active', 'Completed', 'Cancelled').optional(),
  })
    .min(1)
    .unknown(false);

  return schema.validate(project);
}

module.exports = {
  Project,
  validateProject,
  validateProjectPatch,
};