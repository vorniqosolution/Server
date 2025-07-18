const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    cnic: { type: String, required: true, trim: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    checkInAt: { type: Date, default: Date.now },
    checkOutAt: { type: Date },
    status: {
      type: String,
      enum: ["checked-in", "checked-out"],
      default: "checked-in",
    },
    stayDuration: { type: Number, required: true }, // in days
    applyDiscount: { type: Boolean, default: false },
    discountTitle: { type: String }, // Optional for reference
    totalRent: { type: Number }, // calculated final rent
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Guest", guestSchema);
