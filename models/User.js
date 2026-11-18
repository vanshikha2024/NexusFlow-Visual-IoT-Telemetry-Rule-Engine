const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  role: { type: String, enum: ["admin", "manager", "viewer"], default: "manager" }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
