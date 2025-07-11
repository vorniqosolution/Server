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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Guest", guestSchema);
