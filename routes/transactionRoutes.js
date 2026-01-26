const express = require("express");
const router = express.Router();
const {
  addTransaction,
  getTransactions,
  getDailyCashSummary,
  deleteTransaction,
} = require("../controller/transactionController");

const authenticate = require("../middleware/authMiddleware");
const authorize = require("../middleware/adminMiddleware");

router.use(authenticate);

// ROUTE: POST /api/transactions/add
// Desc:  Record a new advance, payment, or refund
router.post("/add", addTransaction);

// ROUTE: GET /api/transactions
// Desc:  Get history. Usage: /api/transactions?reservationId=123
// router.get("/get-transactions", getTransactionsBySource);
router.get("/get-transactions", getTransactions);
router.get("/get-daily-cash-summary", getDailyCashSummary);

// ROUTE: DELETE /api/transactions/:id
// Desc:  Delete a transaction (admin only)
router.delete("/:id", authorize("admin"), deleteTransaction);

module.exports = router;
