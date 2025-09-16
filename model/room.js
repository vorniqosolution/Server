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

    owner: {
      type: String,
      required: true,
      trim: true,
    },
    images: [{
      filename: {
        type: String,
        required: true
      },
      path: {
        type: String,
        required: true
      },
      mimetype: {
        type: String,
        required: true
      },
      size: {
        type: Number,
        required: true
      }
    }],
    amenities: {
      type: [String],
      default: [],
      enum: ["Air Conditioning", "TV", "WiFi", "Mini Bar", "Room Safety", "Telephone", "Laundry"],
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
