const express = require("express");
const router = express.Router();
const dashboardController = require("../controller/dashboardController");
const protect = require("../middleware/authMiddleware");

// GET /api/dashboard/stats
router.get("/stats", protect, dashboardController.getRoomStats);

// GET /api/dashboard/arrivals
router.get("/arrivals", protect, dashboardController.getTodayArrivals);

// GET /api/dashboard/room-statuses (Quick View Grid)
router.get("/room-statuses", protect, dashboardController.getRoomStatuses);

module.exports = router;
