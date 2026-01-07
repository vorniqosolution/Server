const express = require("express");
const router = express.Router();
const {
    createPromoCode,
    getAllPromoCodes,
    updatePromoStatus,
    validatePromoCode,
} = require("../controller/promoCodeController");
const verifyToken = require("../middleware/authMiddleware");

// Protected Admin Routes
router.post("/create", verifyToken, createPromoCode);
router.get("/all", verifyToken, getAllPromoCodes);
router.put("/status/:id", verifyToken, updatePromoStatus);

// Public/Check-in Route
router.get("/validate/:code", verifyToken, validatePromoCode);

module.exports = router;
