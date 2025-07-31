const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const invoiceController = require("../controller/invoiceController");
const authorize = require("../middleware/adminMiddleware"); // Assuming you have this for roles

router.use(authenticate);

router.get(
  "/get-all-invoices",
  authorize("admin"),
  invoiceController.getAllInvoices
);

router.get(
  "/search-Invoices",
  authorize("admin"),
  invoiceController.searchInvoices
);

router.get(
  "/get-Invoice-By-Id/:id",
  authorize("admin"),
  invoiceController.getInvoiceById
);

router.get(
  "/:id/download",
  authorize("receptionist", "admin"),
  invoiceController.downloadInvoicePdf
);

router.post(
  "/:id/send-email",
  authorize("receptionist", "admin"),
  invoiceController.sendInvoiceByEmail
);

router.patch(
  "/:id/status",
  authorize("receptionist", "admin"),
  invoiceController.updateInvoiceStatus
);

router.delete(
  "/delete-Invoice/:id",
  authorize("admin"),
  invoiceController.deleteInvoice
);

module.exports = router;
