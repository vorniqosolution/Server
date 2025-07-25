const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");

const {
  getRevenueByCategoryAndPeriod,
  compareRevenueByCategories,
  getDailyRevenueSummary, 
  getOccupancyAnalytics,
  getRevenueByPaymentMethods,
} = require("../controller/revenueController");

router.use(authenticate);

router.get("/revenue-by-category", getRevenueByCategoryAndPeriod);

router.get("/by-category", compareRevenueByCategories);

router.get("/daily", getDailyRevenueSummary);

router.get("/occupancy-rate", getOccupancyAnalytics);

router.get("/payment-methods", getRevenueByPaymentMethods);

module.exports = router;
