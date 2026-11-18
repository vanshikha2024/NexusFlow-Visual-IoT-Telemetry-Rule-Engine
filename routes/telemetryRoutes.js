const router = require("express").Router();
const c = require("../controllers/telemetryController");
router.post("/", c.ingestTelemetry);
router.post("/batch", c.ingestBatch);
router.get("/:deviceId", c.getDeviceTelemetry);
module.exports = router;
