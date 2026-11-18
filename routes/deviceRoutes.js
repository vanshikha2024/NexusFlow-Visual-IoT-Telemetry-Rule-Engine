const router = require("express").Router();
const c = require("../controllers/deviceController");
router.post("/", c.createDevice);
router.get("/", c.getDevices);
router.get("/:deviceId", c.getDevice);
router.put("/:deviceId", c.updateDevice);
router.delete("/:deviceId", c.deleteDevice);
module.exports = router;
