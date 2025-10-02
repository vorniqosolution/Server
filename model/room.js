const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    bedType: {
      type: String,
      required: true,
      enum: ["Studio", "One Bed", "Two Bed"],
    },

    category: {
      type: String,
      required: true,
      enum: ["Standard", "Duluxe-Plus", "Deluxe", "Executive", "Presidential"],
    },

    view: {
      type: String,
      required: true,
      enum: ["Lobby Facing", "Terrace View", "Valley View", "Corner"],
    },

    rate: {
      type: Number,
      required: true,
    },

    status: {
      type: String,
      required: true,
      enum: ["available", "reserved", "occupied", "maintenance"],
      default: "available",
    },

    adults: {
      type: Number,
      required: true,
      min: 1,
      default: 2,
    },

    cleaniness: {
      type: String,
      trim: true,
      default: "Redefining standard living our rooms.",
    },

    owner: {
      type: String,
      required: true,
      trim: true,
    },

    images: {
      type: [String],
      default: [],
    },

    amenities: {
      type: [String],
      default: [],
      enum: [
        "Air Conditioning",
        "TV",
        "WiFi",
        "Mini Bar",
        "Room Safety",
        "Telephone",
        "Laundry",
      ],
    },
    isPubliclyVisible: {
      type: Boolean,
      default: false,
      index: true,
    },
    publicName: {
      type: String,
      trim: true,
      default: function () {
        return `${this.bedType} - ${this.category}`;
      },
    },
    publicDescription: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

roomSchema.virtual("dropdownLabel").get(function () {
  return `${
    this.roomNumber
  } — ${this.bedType} ${this.category} ${this.view} — Rs${this.rate.toLocaleString()}`;
});

module.exports = mongoose.model("Room", roomSchema);
