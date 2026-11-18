const router = require("express").Router();
const c = require("../controllers/alertController");
router.post("/", c.createAlert);
router.get("/", c.getAlerts);
router.patch("/:id/status", c.updateAlertStatus);
module.exports = router;
