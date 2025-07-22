const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryCategory", required: true },
    unitPrice: { type: Number, required: true },
    quantityOnHand: { type: Number, required: true, default: 0 },
    reorderLevel: { type: Number, required: true, default: 0 },
    location: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);