const mongoose = require("mongoose");

const webhookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  url: { type: String, required: true },
  events: [{ type: String, enum: ["alert.triggered", "alert.resolved", "workflow.failed"] }],
  isEnabled: { type: Boolean, default: true },
  secret: { type: String, select: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("Webhook", webhookSchema);
