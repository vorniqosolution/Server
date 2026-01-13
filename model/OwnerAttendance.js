const mongoose = require("mongoose");

const ownerAttendanceSchema = new mongoose.Schema(
    {
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Owner",
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        month: {
            type: Number, // 0-11
            required: true,
        },
        year: {
            type: Number,
            required: true,
        },
        amountCharged: {
            type: Number,
            default: 0,
            min: 0
        },
        markedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    { timestamps: true }
);

// Compound index to ensure an owner is marked only once per day
ownerAttendanceSchema.index({ owner: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("OwnerAttendance", ownerAttendanceSchema);
