const express = require("express");
const router = express.Router();
const {
  createReservation,
  getReservations,
  getReservationById,
  cancelReservation,
  checkInReservation,
} = require("../controller/reservationcontroller");
const authenticate = require("../middleware/authMiddleware");

// Protect all guest routes
router.use(authenticate);

router.route("/reservation").post(createReservation).get(getReservations);

router.route("/:id").get(getReservationById);

router.route("/reservation/:id/cancel").delete(cancelReservation);

// router.route("/:id/checkin").post(checkInReservation);

module.exports = router;
