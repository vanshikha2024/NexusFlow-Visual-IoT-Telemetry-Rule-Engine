const mongoose = require("mongoose");

// MongoDB Time-Series collection: append-only sensor measurements.
// `time` is the measurement timestamp; `meta` groups measurements by device.
const telemetrySchema = new mongoose.Schema({
  time: { type: Date, required: true, default: Date.now },
  meta: {
    deviceId: { type: String, required: true },
    deviceType: { type: String, default: "sensor" }
  },
  measurements: {
    temperature: { type: Number },
    humidity: { type: Number },
    pressure: { type: Number },
    vibration: { type: Number }
  },
  // Additional sensor values, e.g. voltage, rpm, current.
  custom: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timeseries: {
    timeField: "time",
    metaField: "meta",
    granularity: "seconds"
  },
  expireAfterSeconds: null
});

telemetrySchema.index({ "meta.deviceId": 1, time: -1 });
module.exports = mongoose.model("Telemetry", telemetrySchema);
