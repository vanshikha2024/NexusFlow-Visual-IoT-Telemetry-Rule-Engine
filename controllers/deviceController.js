const Device = require("../models/Device");

exports.createDevice = async (req, res) => {
  try {
    const device = await Device.create(req.body);
    res.status(201).json(device);
  } catch (e) {
    res.status(400).json({ message: "Could not create device", error: e.message });
  }
};

exports.getDevices = async (req, res) => {
  const devices = await Device.find().sort({ createdAt: -1 });
  res.json(devices);
};

exports.getDevice = async (req, res) => {
  const device = await Device.findOne({ deviceId: req.params.deviceId });
  if (!device) return res.status(404).json({ message: "Device not found" });
  res.json(device);
};

exports.updateDevice = async (req, res) => {
  try {
    const device = await Device.findOneAndUpdate(
      { deviceId: req.params.deviceId }, req.body,
      { new: true, runValidators: true }
    );
    if (!device) return res.status(404).json({ message: "Device not found" });
    res.json(device);
  } catch (e) {
    res.status(400).json({ message: "Could not update device", error: e.message });
  }
};

exports.deleteDevice = async (req, res) => {
  const device = await Device.findOneAndDelete({ deviceId: req.params.deviceId });
  if (!device) return res.status(404).json({ message: "Device not found" });
  res.json({ message: "Device deleted" });
};
