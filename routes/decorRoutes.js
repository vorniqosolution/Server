const express = require("express");
const router = express.Router();
const decorController = require("../controller/decorController");
const authenticate = require("../middleware/authMiddleware");
const upload = require("../config/multer");

router.use(authenticate);
// --- Admin Routes ---
router.post(
  "/create-package",
  upload.array("images", 3),
  decorController.createPackage
);

router.put(
  "/edit-packages/:id",
  upload.array("images", 3),
  decorController.updatePackage
);
router.get("/get-packages", decorController.getPackages);
router.get("/active-orders", decorController.getActiveDecorOrders);
router.delete("/delete-packages/:id", decorController.deletePackage);

// --- Receptionist Routes ---
router.post("/create-order", decorController.createOrder);
router.put("/complete-order", decorController.completeAndBillOrder);

module.exports = router;
