const router = require("express").Router();
const c = require("../controllers/workflowController");
router.post("/", c.createWorkflow);
router.get("/", c.getWorkflows);
router.get("/:id", c.getWorkflow);
router.put("/:id", c.updateWorkflow);
router.delete("/:id", c.deleteWorkflow);
module.exports = router;
