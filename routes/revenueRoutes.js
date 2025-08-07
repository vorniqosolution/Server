const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");

const {
  getRevenueByCategoryAndPeriod,
  compareRevenueByCategories,
  getDailyRevenueSummary, 
  getOccupancyAnalytics,
  getRevenueByPaymentMethods,
  debugRevenueQuery
} = require("../controller/revenueController");

router.use(authenticate);

router.get("/revenue-by-category", getRevenueByCategoryAndPeriod);

router.get("/compare-by-category", compareRevenueByCategories);

router.get("/daily", getDailyRevenueSummary);

router.get("/occupancy-rate", getOccupancyAnalytics);

router.get("/payment-methods", getRevenueByPaymentMethods);

// router.get('/debug', debugRevenueQuery);

module.exports = router;
