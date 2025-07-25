// routes/inventoryRoutes.js
const express = require("express");
const router = express.Router();
const invCtrl = require("../controller/inventoryController");
const auth = require("../middleware/authMiddleware");

// Categories
router.post("/create-category", auth, invCtrl.createCategory);
router.get("/get-categories", auth, invCtrl.getCategories);
router.put("/update-category/:id", auth, invCtrl.updateCategory);
router.delete("/delete-category/:id", auth, invCtrl.deleteCategory);

// Items
router.post("/create-item", auth, invCtrl.createItem);
router.get("/get-items", auth, invCtrl.getItems);
router.put("/update-item/:id", auth, invCtrl.updateItem);
router.delete("/delete-item/:id", auth, invCtrl.deleteItem);

// Transactions
router.post("/create-transaction", auth, invCtrl.createTransaction);
router.get("/get-transactions", auth, invCtrl.getTransactions);

// Integrations
router.post("/checkin", auth, invCtrl.handleRoomCheckin);
router.post("/checkout", auth, invCtrl.handleRoomCheckout);

module.exports = router;
