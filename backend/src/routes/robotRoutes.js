const express = require("express");
const router = express.Router();
const { getAllRobots, getRobot, ingestEvent } = require("../controllers/robotController");

router.get("/", getAllRobots);
router.get("/:robotId", getRobot);
router.post("/events", ingestEvent);

module.exports = router;
