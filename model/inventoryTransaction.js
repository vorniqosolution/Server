// models/inventoryTransaction.js
const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem", required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room" },
    guest: { type: mongoose.Schema.Types.ObjectId, ref: "Guest" },
    transactionType: {
      type: String,
      required: true,
      enum: ["issue", "return", "adjustment", "usage"]
    },
    quantity: { type: Number, required: true },
    reason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryTransaction", inventoryTransactionSchema);