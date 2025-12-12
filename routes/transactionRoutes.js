const express = require("express");
const router = express.Router();
const {
  addTransaction,
  getTransactions,
  getDailyCashSummary,
} = require("../controller/transactionController");

const authenticate = require("../middleware/authMiddleware");

router.use(authenticate);

// ROUTE: POST /api/transactions/add
// Desc:  Record a new advance, payment, or refund
router.post("/add", addTransaction);

// ROUTE: GET /api/transactions
// Desc:  Get history. Usage: /api/transactions?reservationId=123
// router.get("/get-transactions", getTransactionsBySource);
router.get("/get-transactions", getTransactions);
router.get("/get-daily-cash-summary", getDailyCashSummary);

module.exports = router;
