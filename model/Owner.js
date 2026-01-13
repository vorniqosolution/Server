const mongoose = require("mongoose");

const ownerSchema = new mongoose.Schema(
    {
        fullName: { type: String, required: true, trim: true },
        cardId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        cnic: { type: String, trim: true },
        phone: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },

        // Apartment Details
        apartmentNumber: { type: String, required: true, trim: true },
        assignedRoom: { type: mongoose.Schema.Types.ObjectId, ref: "Room" }, // Optional link to Room model

        // Agreement Details
        agreementStartDate: { type: Date },
        agreementEndDate: { type: Date },

        // Seasonal Limits
        seasonLimits: {
            summerWeekend: { type: Number, default: 0 }, // Total allowed weekend days in Summer
            summerWeekday: { type: Number, default: 0 }, // Total allowed weekday days in Summer
            winterWeekend: { type: Number, default: 0 }, // Total allowed weekend days in Winter
            winterWeekday: { type: Number, default: 0 }, // Total allowed weekday days in Winter
            totalSeasonLimit: { type: Number, default: 22 }, // Total allowed days per season
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Owner", ownerSchema);
