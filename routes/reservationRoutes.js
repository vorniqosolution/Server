const express = require("express");
const router = express.Router();
const {
  createReservation,
  getReservations,
  getReservationById,
  cancelReservation,
  GetAllReservedRoomWithDate,
  GetAllOccupiedRoomsWithDate,
} = require("../controller/reservationcontroller");
const authenticate = require("../middleware/authMiddleware");

// Protect all guest routes
router.use(authenticate);

router.post("/create-reservation", createReservation);
router.get("/get-reservations", getReservations);
router.get("/get-reservation/:id", getReservationById);
router.delete("/cancel-reservation/:id/cancel", cancelReservation);
router.get("/Get-All-ReservedRoom-With-Date", GetAllReservedRoomWithDate);
router.get("/Get-All-OccupiedRoom-With-Date", GetAllOccupiedRoomsWithDate);

module.exports = router;
