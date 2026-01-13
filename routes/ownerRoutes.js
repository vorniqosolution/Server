const express = require("express");
const router = express.Router();
const { createOwner, getOwnerByCardId, markAttendance, getAllOwners, updateOwner, deleteOwner, getOwnerTimeline } = require("../controller/ownerController");
const authenticate = require("../middleware/authMiddleware");

// All routes protected by Auth Middleware (Receptionist/Admin)
router.use(authenticate);

// Create Owner (Admin or Receptionist depending on policy)
router.post("/create", createOwner);

// Scan/Search Owner
router.get("/scan/:cardId", getOwnerByCardId);

// Get All Owners
router.get("/get-all-owners", getAllOwners);

// Get Owner Timeline
router.get("/timeline/:id", getOwnerTimeline);

// Mark Attendance
router.post("/mark-attendance", markAttendance);

// Update Owner
router.put("/update/:id", updateOwner);

// Delete Owner
router.delete("/delete/:id", deleteOwner);

module.exports = router;
