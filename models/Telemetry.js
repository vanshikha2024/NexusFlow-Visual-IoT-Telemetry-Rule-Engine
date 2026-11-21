const mongoose = require("mongoose");

const telemetrySchema = new mongoose.Schema({
  time: { type: Date, required: true, default: Date.now },
  meta: {
    deviceId: { type: String, required: true },
    deviceType: { type: String, default: "sensor" }
  },

  custom: { type: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timeseries: {
    timeField: "time",
    metaField: "meta",
    granularity: "seconds"
  },
  expireAfterSeconds: null
});

telemetrySchema.index({ "meta.deviceId": 2, time: -2 });
module.exports = mongoose.model("Telemetry", telemetrySchema);
