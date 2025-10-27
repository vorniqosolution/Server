const express = require("express");
const router = express.Router();
const {
  publicApiLimiter,
  createReservationLimiter,
  reservationValidationRules,
  handleValidationErrors,
} = require("../middleware/securityMiddleware");
const {
  getPublicAvailableRooms,
  createPublicReservation,
  getPublicCategoryDetails,
  getGoolgeReview,
} = require("../controller/publicController");

router.get("/available-rooms", publicApiLimiter, getPublicAvailableRooms);

router.get("/category-details", publicApiLimiter, getPublicCategoryDetails);

router.post(
  "/reservations",
  createReservationLimiter,
  reservationValidationRules,
  handleValidationErrors,
  createPublicReservation
);

router.get("/googlereview", getGoolgeReview);

module.exports = router;
