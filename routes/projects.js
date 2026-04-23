const express = require('express');
const auth = require('../middleware/auth');
const { Project, validateProject, validateProjectPatch } = require('../models/Project');
const { Order } = require('../models/Order');
const { Invoice } = require('../models/Invoice');

const router = express.Router();

// Get all projects for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.user._id }).sort('name');
    res.send(projects);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Get specific project
router.get('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) return res.status(404).send('Project not found.');

    res.send(project);
  } catch (err) {
    res.status(400).send('Invalid project id.');
  }
});

// Create project
router.post('/', auth, async (req, res) => {
  try {
    const { error } = validateProject({
      ...req.body,
      userId: req.user._id,
    });

    if (error) {
      return res.status(400).send(error.details[0].message || error.details[0].context?.custom);
    }

    const project = new Project({
      userId: req.user._id,
      name: req.body.name,
      description: req.body.description,
      status: req.body.status,
    });

    await project.save();

    res.status(201).send(project);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send('A project with this name already exists.');
    }

    res.status(500).send(err.message);
  }
});

// Update project
router.patch('/:id', auth, async (req, res) => {
  try {
    const { error } = validateProjectPatch(req.body);

    if (error) {
      return res.status(400).send(error.details[0].message || error.details[0].context?.custom);
    }

    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) return res.status(404).send('Project not found.');

    if (req.body.name !== undefined) project.name = req.body.name;
    if (req.body.description !== undefined) project.description = req.body.description;
    if (req.body.status !== undefined) project.status = req.body.status;

    await project.save();

    res.send(project);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).send('A project with this name already exists.');
    }

    res.status(400).send(err.message);
  }
});

// Delete project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!project) return res.status(404).send('Project not found.');

    const hasOrders = await Order.exists({
      project: project._id,
      userId: req.user._id,
    });

    const hasInvoices = await Invoice.exists({
      project: project._id,
      userId: req.user._id,
    });

    if (hasOrders || hasInvoices) {
      return res
        .status(403)
        .send('Cannot delete project with existing orders or invoices. Mark it as Completed or Cancelled instead.');
    }

    await project.deleteOne();

    res.send(project);
  } catch (err) {
    res.status(400).send('Invalid project id.');
  }
});

module.exports = router;