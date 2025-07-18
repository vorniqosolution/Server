const express = require("express");
const router = express.Router();
const { login, signup, logout, me } = require("../controller/authController");
const authController = require('../middleware/authMiddleware')

router.post("/login", login);
router.post("/signup", signup); // Receptionist only
router.post("/logout", logout);


router.get("/me", authController,  me);


module.exports = router;
