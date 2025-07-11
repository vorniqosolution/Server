const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomNumber: { type: String, required: true, unique: true, trim: true },
  type:       { type: String, required: true, enum: ["single", "double", "suite", "apartment"] },
  status:     { type: String, required: true, enum: ["available", "booked", "occupied", "maintenance"], default: "available" },
  rate:       { type: Number, required: true },
  notes:      { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model("Room", roomSchema);
