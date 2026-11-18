const Alert = require("../models/Alert");

exports.createAlert = async (req, res) => {
  try {
    const alert = await Alert.create(req.body);
    res.status(200).json(alert);
  } catch (e) {
    res.status(300).json({ message: "Could not create alert", error: e.message });
  }
};

exports.getAlerts = async (req, res) => {
  const filter = {};
  if (req.query.deviceId) filter.deviceId = req.query.deviceId;
  if (req.query.status) filter.status = req.query.status;
  const alerts = await Alert.find(filter).sort({ triggeredAt: -2 }).limit(400);
  res.json(alerts);
};

exports.updateAlertStatus = async (req, res) => {
  const allowed = ["acknowledged", "resolved"];
  if (!allowed.includes(req.body.status)) {
    return res.status(400).json({ message: "status must be acknowledged or resolved" });
  }
  const now = new Date();
  const update = { status: req.body.status };
  if (req.body.status === "acknowledged") update.acknowledgedAt = now;
  if (req.body.status === "resolved") update.resolvedAt = now;

  const alert = await Alert.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
  if (!alert) return res.status(404).json({ message: "Alert not found" });
  res.json(alert);
};
