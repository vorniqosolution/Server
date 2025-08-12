const express = require("express");
const router = express.Router();
const {
  UpdatePassword,
  AdminUpdateUserPassword,
  DeleteRecipient,
  ViewRecipient,
} = require("../controller/adminController.js");
const authenticate = require("../middleware/authMiddleware");

router.post("/updatepassword", authenticate, UpdatePassword);
router.post(
  "/update-receptionist-password/:id",
  authenticate,
  AdminUpdateUserPassword
);
router.delete("/delete-receptionist/:id", authenticate, DeleteRecipient);
router.get("/view-receptionist", authenticate, ViewRecipient);
module.exports = router;
