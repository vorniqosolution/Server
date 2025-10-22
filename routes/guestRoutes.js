const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");
const guestController = require("../controller/guestController");

router.use(authenticate);

router.post("/create-guest", guestController.createGuest);
router.get("/get-all-guest", guestController.getGuests);
router.get("/get-Guest-By-Id/:id", guestController.getGuestById);
router.patch("/check-out-Guest/:id/checkout", guestController.checkoutGuest);
router.patch("/update-guest/:id", guestController.UpdateGuestById);
router.get('/activity-by-date', guestController.getGuestActivityByDate);
router.get(
  "/get-guest-by-category",
  guestController.getCheckedInGuestsByRoomCategory
);

// admin routes
router.use(authorize('admin'));
router.delete("/guests/:id", guestController.deleteGuest);
module.exports = router;



