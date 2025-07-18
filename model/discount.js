const mongoose = require("mongoose");

const discountSchema = new mongoose.Schema({
  title: { type: String, required: true },
  percentage: { type: Number, required: true }, // e.g. 25 for 25%
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model("Discount", discountSchema);
