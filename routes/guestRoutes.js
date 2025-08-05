const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorie = require("../middleware/adminMiddleware");

const guestController = require("../controller/guestController");

// Protect all guest routes
router.use(authenticate);

router.post("/create-guest", guestController.createGuest);

router.get("/get-all-guest", guestController.getGuests);

router.get(
  "/get-guest-by-category",
  guestController.getCheckedInGuestsByRoomCategory
);

router.get("/get-Guest-By-Id/:id", guestController.getGuestById);

router.patch("/check-out-Guest/:id/checkout", guestController.checkoutGuest);
router.patch("/update-guest/:id", guestController.UpdateGuestById);
router.delete("/guests/:id", authorie("admin"), guestController.deleteGuest);
module.exports = router;
