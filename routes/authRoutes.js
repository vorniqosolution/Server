const express = require("express");
const router = express.Router();
const { login, signup, logout, me } = require("../controller/authController");
const auth = require('../middleware/authMiddleware')

router.post("/login", login);
router.post("/signup", signup); // Receptionist only
router.post("/logout", logout);


router.get("/me", auth,  me);


module.exports = router;
