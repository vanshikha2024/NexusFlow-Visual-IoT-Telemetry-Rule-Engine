const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, index: true },
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: "Workflow" },
  ruleName: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ["info", "warning", "critical"], default: "warning" },
  observedValue: { type: mongoose.Schema.Types.Mixed },
  threshold: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ["open", "acknowledged", "resolved"], default: "open" },
  triggeredAt: { type: Date, default: Date.now },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date }
}, { timestamps: true });

alertSchema.index({ status: 1, triggeredAt: -1 });
alertSchema.index({ deviceId: 1, triggeredAt: -1 });
module.exports = mongoose.model("Alert", alertSchema);
