const express = require("express");
const router = express.Router();
const { getConfig, updateConfig } = require("../controllers/simulatorController");
const { requireAdminKey } = require("../middleware/auth");

router.get("/config", getConfig);
router.put("/config", requireAdminKey, updateConfig);

module.exports = router;
