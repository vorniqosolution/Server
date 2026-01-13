const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    // We use a fixed key to always find the one settings document
    _id: {
      type: String,
      default: "global_settings",
    },
    taxRate: {
      type: Number,
      required: true,
      default: 0, // Default tax rate is 0%
      min: 0,
      max: 100,
    },
    currencySymbol: {
      type: String,
      required: true,
      default: "Rs",
    },
    hotelName: {
      type: String,
      default: "HSQ Towers",
    },
    systemAlert: {
      message: {
        type: String,
        default: "",
      },
      isActive: {
        type: Boolean,
        default: false,
      },
      type: {
        type: String,
        enum: ["info", "warning", "error"],
        default: "info",
      },
    },
    mattressRate: {
      type: Number,
      default: 1500,
      min: 0,
    },
    seasonConfig: {
      summer: {
        startMonth: { type: Number, default: 5 }, // June
        endMonth: { type: Number, default: 7 },   // August
      },
      winter: {
        startMonth: { type: Number, default: 11 }, // December
        endMonth: { type: Number, default: 1 },    // February
      }
    },
    // You can add more settings here in the future
    // hotelAddress: { type: String, default: "123 Hotel St, City" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Gst", settingsSchema);
