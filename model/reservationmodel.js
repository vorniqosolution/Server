const mongoose = require("mongoose");

const reservationSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    cnic: { type: String, required: true, trim: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["reserved", "checked-in", "cancelled"],
      default: "reserved",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("reservation", reservationSchema);
