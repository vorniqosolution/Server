const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const guestController = require("../controller/guestController");

// Protect all guest routes
router.use(authenticate);


router.post("/create-guest", guestController.createGuest);

router.get("/get-all-guest", guestController.getGuests);

router.get("/get-guest-by-category", guestController.getCheckedInGuestsByRoomCategory);

router.get("/get-Guest-By-Id/:id", guestController.getGuestById);

router.patch("/check-out-Guest/:id/checkout", guestController.checkoutGuest);

router.delete("/guests/:id", guestController.deleteGuest);


module.exports = router;
