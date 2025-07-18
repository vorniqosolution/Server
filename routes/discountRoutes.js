const express = require("express");
const router = express.Router();
const discountController = require("../controller/discountController");
const  authenticate  = require("../middleware/authMiddleware");



router.use(authenticate);
// Create, view, and delete discount (admin only)
router.post("/create-Discount", discountController.createDiscount);
router.get("/get-Discounts", discountController.getDiscounts);
router.delete("/delete-Discount/:id", discountController.deleteDiscount);

module.exports = router;
