// model/room.js
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    bedType: {
      type: String,
      required: true,
      enum: ["Studio", "One Bed", "Two Bed"]
    },

    category: {
      type: String,
      required: true,
      enum: ["Standard", "Dulux plus", "Deluxe", "Executive", "Presidential"]
    },

    view: {
      type: String,
      required: true,
      enum: ["Lobby Facing", "Terrace View", "Valley View", "Corner"]
    },

    rate: {
      type: Number,
      required: true
    },

    status: {
      type: String,
      required: true,
      enum: ["available", "booked", "occupied", "maintenance"],
      default: "available"
    },

    owner: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

// Human-readable label for dropdowns: "411 — Two Bed Dulux Lobby Facing — $28,000"
roomSchema.virtual("dropdownLabel").get(function() {
  return `${this.roomNumber} — ${this.bedType} ${this.category} ${this.view} — Rs${this.rate.toLocaleString()}`;
});

module.exports = mongoose.model("Room", roomSchema);