const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    // The "Context"
    reservation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "reservation", // Make sure this matches your Reservation model export name string
      default: null,
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      default: null,
    },

    // The Money Details
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    
    // Type of money movement
    type: {
      type: String,
      enum: ["advance", "refund", "payment", "security_deposit"],
      required: true,
    },

    // EXACT MATCH with Reservation Model
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "Online", "PayAtHotel"], 
      required: true,
    },

    // Optional details
    referenceId: {
      type: String, 
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Audit Trail
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transaction", transactionSchema);