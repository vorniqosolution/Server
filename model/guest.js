const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      // match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please fill a valid email address"] 
    },
    cnic: { type: String, required: true, trim: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    checkInAt: { type: Date, default: Date.now },
    checkInTime: {
      type: String,
      default: function () {
        return this.checkInAt.toTimeString().slice(0, 5);
      }
    },
    checkOutAt: { type: Date },
    checkOutTime: {
      type: String,
      default: function () {
        return this.checkOutAt
          ? this.checkOutAt.toTimeString().slice(0, 5)
          : null;
      }
    },
    status: {
      type: String,
      enum: ["checked-in", "checked-out"],
      default: "checked-in",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "card", "online"],
      default: "cash",
      required: true,
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
