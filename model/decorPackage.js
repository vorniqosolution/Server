const mongoose = require("mongoose");

const decorPackageSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true, 
    trim: true, 
    unique: true 
  },
  description: { type: String, trim: true },
  price: { type: Number, required: true, min: 0 },
  images: [String], 
  isActive: { type: Boolean, default: true },

  // The Recipe: What items are consumed?
  inventoryRequirements: [
    {
      item: { type: mongoose.Schema.Types.ObjectId, ref: "InventoryItem" },
      quantity: { type: Number, required: true, min: 1 }
    }
  ],

  // Operations: How much notice do we need?
  preparationTimeHours: { type: Number, default: 0 },
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
}, { timestamps: true });

module.exports = mongoose.model("DecorPackage", decorPackageSchema);