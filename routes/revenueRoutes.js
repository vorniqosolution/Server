const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");

const {
  GetAllRevenue,
  GetMonthlyRevenue,
  GetYearlyRevenue,
  GetRevenueRoomCategories,
  CheckDiscountedGuest,
  GetWeeklyRevenue,
  GetDailyRevenue,
} = require("../controller/revenueController");

router.use(authenticate);

router.get("/all-revenue", GetAllRevenue);
router.get("/get-monthly-revenue", GetMonthlyRevenue);
router.get("/get-yearly-revenue", GetYearlyRevenue);
router.get("/get-room-categories", GetRevenueRoomCategories);
router.get("/get-discounted-guest", CheckDiscountedGuest);
router.get("/get-weekly-revenue", GetWeeklyRevenue);
router.get("/get-daily-revenue", GetDailyRevenue);

module.exports = router;
