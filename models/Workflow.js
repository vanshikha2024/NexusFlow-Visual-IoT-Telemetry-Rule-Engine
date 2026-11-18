const mongoose = require("mongoose");

const nodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, required: true }, // sensor, movingAverage, threshold, smsAlert, etc.
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String },
  targetHandle: { type: String },
  label: { type: String }
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  nodes: { type: [nodeSchema], default: [] },
  edges: { type: [edgeSchema], default: [] },
  status: { type: String, enum: ["draft", "active", "paused", "error"], default: "draft" },
  version: { type: Number, default: 1 },
  lastExecutedAt: { type: Date }
}, { timestamps: true });

workflowSchema.index({ owner: 1, updatedAt: -1 });
workflowSchema.index({ status: 1 });

module.exports = mongoose.model("Workflow", workflowSchema);
