const express = require("express");
const router = express.Router();
const { login, signup } = require("../controller/authController");

router.post("/login", login);
router.post("/signup", signup); // Receptionist only

module.exports = router;
