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
router.post("/updaterecepcientpassword", authenticate, AdminUpdateUserPassword);
router.post("/deleterecepcient", authenticate, DeleteRecipient);
router.get("/viewrecepcient", authenticate, ViewRecipient);
module.exports = router;
