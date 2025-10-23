const express = require("express");
const router = express.Router();
const {
  createReservation,
  getReservations,
  getReservationById,
  cancelReservation,
  getReservationsCreatedOnDate,
  deleteReservation,
} = require("../controller/reservationcontroller");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");

// Protect all guest routes
router.use(authenticate);

router.post("/create-reservation", createReservation);
router.get("/get-reservations", getReservations);
router.get("/get-reservation/:id", getReservationById);
router.delete("/cancel-reservation/:id/cancel", cancelReservation);
router.delete(
  "/delete-reservation/:id/delete",
  authorize("admin"),
  deleteReservation
);
router.get("/created-on", getReservationsCreatedOnDate);

module.exports = router;
