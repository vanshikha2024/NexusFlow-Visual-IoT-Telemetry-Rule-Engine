const Telemetry = require("../models/Telemetry");
const Device = require("../models/Device");

exports.ingestTelemetry = async (req, res) => {
  try {
    const { deviceId, time, measurements = {}, custom = {} } = req.body;
    if (!deviceId) return res.status(400).json({ message: "deviceId is required" });

    const device = await Device.findOne({ deviceId });
    if (!device) return res.status(404).json({ message: "Unknown deviceId" });

    const record = await Telemetry.create({
      time: time ? new Date(time) : new Date(),
      meta: { deviceId: device.deviceId, deviceType: device.deviceType },
      measurements, custom
    });

    if (device.status !== "online") {
      device.status = "online";
      await device.save();
    }
    res.status(201).json({ message: "Telemetry stored", data: record });
  } catch (e) {
    res.status(400).json({ message: "Telemetry ingestion failed", error: e.message });
  }
};

// Insert an array in one operation for higher ingestion throughput.
exports.ingestBatch = async (req, res) => {
  try {
    const records = req.body.records;
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ message: "records must be a non-empty array" });
    }
    const maxBatch = Number(process.env.TELEMETRY_BATCH_SIZE || 1000);
    if (records.length > maxBatch) {
      return res.status(413).json({ message: `Maximum batch size is ${maxBatch}` });
    }

    const ids = [...new Set(records.map(r => r.deviceId).filter(Boolean))];
    const devices = await Device.find({ deviceId: { $in: ids } }).select("deviceId deviceType");
    const deviceMap = new Map(devices.map(d => [d.deviceId, d]));
    const unknown = ids.filter(id => !deviceMap.has(id));
    if (unknown.length) return res.status(400).json({ message: "Unknown devices", deviceIds: unknown });

    const docs = records.map(r => ({
      time: r.time ? new Date(r.time) : new Date(),
      meta: { deviceId: r.deviceId, deviceType: deviceMap.get(r.deviceId).deviceType },
      measurements: r.measurements || {},
      custom: r.custom || {}
    }));

    const result = await Telemetry.insertMany(docs, { ordered: false });
    res.status(201).json({ message: "Telemetry batch stored", insertedCount: result.length });
  } catch (e) {
    res.status(400).json({ message: "Batch ingestion failed", error: e.message });
  }
};

exports.getDeviceTelemetry = async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 1000);
  const filter = { "meta.deviceId": req.params.deviceId };
  if (req.query.from || req.query.to) {
    filter.time = {};
    if (req.query.from) filter.time.$gte = new Date(req.query.from);
    if (req.query.to) filter.time.$lte = new Date(req.query.to);
  }
  const records = await Telemetry.find(filter).sort({ time: -1 }).limit(limit);
  res.json(records);
};
