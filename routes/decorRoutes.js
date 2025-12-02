const express = require("express");
const router = express.Router();
const decorController = require("../controller/decorController");
// Ensure you import your auth middleware correctly
const authenticate = require("../middleware/authMiddleware");

router.use(authenticate);
// --- Admin Routes ---
router.post("/create-package", decorController.createPackage);
router.get("/get-packages", decorController.getPackages);

// --- Receptionist Routes ---
router.post("/create-order", decorController.createOrder);
router.put("/complete-order", decorController.completeAndBillOrder);

module.exports = router;
