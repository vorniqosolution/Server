const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const invoiceController = require("../controller/invoiceController");
const authorize = require("../middleware/adminMiddleware"); // Assuming you have this for roles

// Protect all invoice routes
router.use(authenticate);

router.get("/search/:id", invoiceController.searchInvoices);

router.get("/:id", invoiceController.getInvoiceById);

router.post(
  "/:id/send-email",
  authorize("receptionist", "admin"), 
  invoiceController.sendInvoiceByEmail
);

module.exports = router;
