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
    // You can add more settings here in the future
    // hotelAddress: { type: String, default: "123 Hotel St, City" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Gst", settingsSchema);
