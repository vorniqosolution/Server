const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");
const settingsController = require("../controller/settingcontroller");

router.use(authenticate);

router.get("/get-all-gst", settingsController.getSettings);

router.put(
  "/update-setting",
  authorize("admin"),
  settingsController.updateSettings
);

module.exports = router;
