const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  deviceId: { type: String, required: true, unique: true, trim: true },
  deviceType: { type: String, default: "sensor" },
  location: { type: String, default: "" },
  description: { type: String, default: "" },
  status: { type: String, enum: ["online", "offline", "maintenance"], default: "offline" },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

deviceSchema.index({ status: 1, deviceType: 1 });
module.exports = mongoose.model("Device", deviceSchema);
