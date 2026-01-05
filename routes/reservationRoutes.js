const express = require("express");
const router = express.Router();
const {
  createReservation,
  getReservations,
  getReservationById,
  cancelReservation,
  deleteReservation,
  getDailyActivityReport,
  changeReservationRoom,
} = require("../controller/reservationcontroller");

// ======================== MIDDLEWARES =============================
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");

router.use(authenticate);

// ======================== ROUTES =============================
router.post("/create-reservation", createReservation);
router.get("/get-reservations", getReservations);
router.get("/reports/daily-activity", getDailyActivityReport);
router.get("/get-reservation/:id", getReservationById);
router.put("/:id/change-room", changeReservationRoom);
router.delete("/cancel-reservation/:id/cancel", cancelReservation);

// ======================== ADMIN ONLY ROUTES =============================
router.delete("/:id", authorize("admin"), deleteReservation);
// router.delete(
//   "/delete-reservation/:id/delete",
//   authorize("admin"),
//   deleteReservation
// );

module.exports = router;
