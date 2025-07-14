// model/room.js
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, unique: true, trim: true },

    type: {
      type: String,
      required: true,
      enum: ["Standard", "Deluxe plus", "Deluxe", "Apartment", "Executive"],
    },

    status: {
      type: String,
      required: true,
      enum: ["available", "booked", "occupied", "maintenance"],
      default: "available",
    },

    rate: {
      type: Number,
      required: true,
      enum: [14000, 25000, 28000, 30000, 18000],
    },

    notes: {
      type: String,
      trim: true,
      enum: ["Lobby Facing", "Terrace View"],
    },

    // New field
    description: {
      type: String,
      trim: true,
      enum: ["One Bed", "Two Bed"],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Room", roomSchema);
