const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");
const settingsController = require("../controller/settingcontroller");

// --- Apply authentication to ALL routes ---
router.use(authenticate);

// --- GET Route: Accessible by authenticated users (e.g., receptionists) ---
// Gets the current settings (like tax rate) to apply to new invoices
router.get("/setting", settingsController.getSettings);

// --- PUT Route: Restricted to Admins only ---
// Updates the global settings for the entire application
router.put(
  "/update-setting",
  authorize("admin"), // Only an admin can change the tax rate
  settingsController.updateSettings
);

module.exports = router;
