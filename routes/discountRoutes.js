const express = require("express");
const router = express.Router();
const discountController = require("../controller/discountController");
const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");

router.use(authenticate);

router.post("/create-Discount", discountController.createDiscount);
router.get("/get-Discounts", discountController.getDiscounts);
router.get("/currentdiscount", discountController.GetCurrentDiscount);
router.patch("/update-discount/:id", discountController.UpdateDiscount);

router.use(authorize("admin"));
router.delete("/delete-discount/:id", discountController.deleteDiscount);

module.exports = router;
