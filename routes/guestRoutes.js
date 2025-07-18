const express = require("express");
const router  = express.Router();
const authenticate = require("../middleware/authMiddleware");
const guestController = require("../controller/guestController");

// Protect all guest routes
router.use(authenticate);

// Check-in a new guest
router.post("/create-guest", guestController.createGuest);
// List all guests
router.get("/get-all-guest", guestController.getGuests);
// View a single guest
router.get("/get-Guest-By-Id/:id", guestController.getGuestById);
// Check-out a guest
router.patch("/check-out-Guest/:id/checkout", guestController.checkoutGuest);

module.exports = router;
