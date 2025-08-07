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

router.get("/allrevenue", GetAllRevenue);
router.get("/getmonthlyrevenue", GetMonthlyRevenue);
router.get("/getyearlyrevenue", GetYearlyRevenue);
router.get("/getroomcategories", GetRevenueRoomCategories);
router.get("/getdiscountedguest", CheckDiscountedGuest);
router.get("/getweeklyrevenue", GetWeeklyRevenue);
router.get("/getdailyrevenue", GetDailyRevenue);

module.exports = router;
