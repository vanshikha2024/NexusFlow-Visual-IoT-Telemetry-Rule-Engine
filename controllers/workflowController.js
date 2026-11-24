const Workflow = require("../models/Workflow");

exports.createWorkflow = async (req, res) => {
  try {
    const { name, description, nodes = [], edges = [] } = req.body;
    if (!name) return res.status(400).json({ message: "Workflow name is required" });
    const workflow = await Workflow.create({
      name, description, nodes, edges, owner: req.body.owner
    });
    res.status(201).json(workflow);
  } catch (e) {
    res.status(400).json({ message: "Could not save workflow", error: e.message });
  }
};

exports.getWorkflows = async (req, res) => {
  const workflows = await Workflow.find().sort({ updatedAt: -1 });
  res.json(workflows);
};

exports.getWorkflow = async (req, res) => {
  const workflow = await Workflow.findById(req.params.id);
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });
  res.json(workflow);
};

exports.updateWorkflow = async (req, res) => {
  try {
    const allowed = ["name", "description", "nodes", "edges", "status"];
    const update = {};
    for (const key of allowed) if (req.body[key] !== undefined) update[key] = req.body[key];
    if (req.body.nodes || req.body.edges) update.$inc = { version: 1 };

    const workflow = await Workflow.findByIdAndUpdate(req.params.id, update, {
      new: true, runValidators: true
    });
    if (!workflow) return res.status(404).json({ message: "Workflow not found" });
    res.json(workflow);
  } catch (e) {
    res.status(400).json({ message: "Could not update workflow", error: e.message });
  }
};

exports.deleteWorkflow = async (req, res) => {
  const workflow = await Workflow.findByIdAndDelete(req.params.id);
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });
  res.json({ message: "Workflow deleted" });
};


exports.deleteWorkflow = async (req, res) => {
  const workflow = await Workflow.findByIdAndDelete(req.params.id);
  if (!workflow) return res.status(404).json({ message: "Workflow not found" });
  res.json({ message: "Workflow deleted" });
};
