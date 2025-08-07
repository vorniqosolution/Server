const express = require("express");
const router = express.Router();
const {
  createReservation,
  getReservations,
  getReservationById,
  cancelReservation,
} = require("../controller/reservationcontroller");
const authenticate = require("../middleware/authMiddleware");

// Protect all guest routes
router.use(authenticate);

router.post("/create-reservation", createReservation);
router.get("/get-reservations", getReservations);
router.get("/get-reservation/:id", getReservationById);
router.delete("/cancel-reservation/:id/cancel", cancelReservation);

module.exports = router;
