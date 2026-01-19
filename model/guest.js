const mongoose = require("mongoose");
const { getStartOfDay, getEndOfDay } = require("../utils/dateUtils");

const guestSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    cnic: { type: String, required: true, trim: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
    // --- NEW FIELDS ADDED ---
    adults: {
      type: Number,
      required: true,
      default: 1,
      min: 1
    },
    infants: {
      type: Number,
      default: 0,
      min: 0
    },
    extraMattresses: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },
    // ------------------------
    checkInAt: { type: Date, required: true },
    checkInTime: {
      type: String,
      default: function () {
        return this.checkInAt.toTimeString().slice(0, 5);
      },
    },
    checkOutAt: { type: Date, required: true },
    checkOutTime: {
      type: String,
      default: function () {
        return this.checkOutAt
          ? this.checkOutAt.toTimeString().slice(0, 5)
          : null;
      },
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
    stayDuration: { type: Number, required: true },
    applyDiscount: { type: Boolean, default: false },
    discountTitle: { type: String },
    totalRent: { type: Number },
    gst: { type: Number },
    additionaldiscount: { type: Number },
    // --- PROMO CODE ---
    promoCode: { type: String, default: null },
    promoDiscount: { type: Number, default: 0 },
    // ------------------
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // 👇 MAKE SURE THIS IS HERE 👇
    advancePayment: { type: Number, default: 0 },
    // 👆 --------------------- 👆
  },

  { timestamps: true }
);

// These functions are written for the revenue anlytics purpose do not delete these functions:
guestSchema.statics.fetchRevenueByPeriod = async function ({
  period,
  year,
  month,
  week,
  day,
}) {
  const matchStage = {};
  switch (period) {
    case "yearly":
      matchStage.checkInAt = {
        $gte: getStartOfDay(`${year}-01-01`),
        $lt: getStartOfDay(`${year + 1}-01-01`),
      };
      break;
    case "monthly":
      if (!month) throw new Error("Month is required for monthly period.");
      const startM = month < 10 ? `0${month}` : month;
      let nextM = month + 1;
      let nextY = year;
      if (nextM > 12) {
        nextM = 1;
        nextY = year + 1;
      }
      const endM = nextM < 10 ? `0${nextM}` : nextM;

      matchStage.checkInAt = {
        $gte: getStartOfDay(`${year}-${startM}-01`),
        $lt: getStartOfDay(`${nextY}-${endM}-01`),
      };
      break;
    case "daily":
      if (!month || !day)
        throw new Error("Month and day are required for daily period.");
      const dM = month < 10 ? `0${month}` : month;
      const dD = day < 10 ? `0${day}` : day;
      const dateStr = `${year}-${dM}-${dD}`;

      matchStage.checkInAt = {
        $gte: getStartOfDay(dateStr),
        $lte: getEndOfDay(dateStr),
      };
      break;
    case "weekly":
      if (!week) throw new Error("Week is required for weekly period.");
      const weeklyResult = await this.aggregate([
        {
          $addFields: {
            week: { $isoWeek: "$checkInAt" },
            year: { $isoWeekYear: "$checkInAt" },
          },
        },
        { $match: { week, year } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalRent" },
            totalReservations: { $sum: 1 },
          },
        },
        { $project: { _id: 0, totalRevenue: 1, totalReservations: 1 } },
      ]);
      return weeklyResult[0] || { totalRevenue: 0, totalReservations: 0 };
    default:
      throw new Error("Invalid period specified.");
  }
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalRent" },
        totalReservations: { $sum: 1 },
      },
    },
    { $project: { _id: 0, totalRevenue: 1, totalReservations: 1 } },
  ];
  const result = await this.aggregate(pipeline);
  return result[0] || { totalRevenue: 0, totalReservations: 0 };
};

guestSchema.statics.fetchRevenueByCategory = async function (year, month) {
  const startM = month < 10 ? `0${month}` : month;
  let nextM = month + 1;
  let nextY = year;
  if (nextM > 12) {
    nextM = 1;
    nextY = year + 1;
  }
  const endM = nextM < 10 ? `0${nextM}` : nextM;

  const startDate = getStartOfDay(`${year}-${startM}-01`);
  const endDate = getStartOfDay(`${nextY}-${endM}-01`);

  const pipeline = [
    { $match: { checkInAt: { $gte: startDate, $lt: endDate } } },
    {
      $lookup: {
        from: "rooms",
        localField: "room",
        foreignField: "_id",
        as: "roomData",
      },
    },
    { $unwind: "$roomData" },
    {
      $group: {
        _id: "$roomData.category",
        totalRevenue: { $sum: "$totalRent" },
        totalReservations: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    {
      $project: {
        category: "$_id",
        totalRevenue: 1,
        totalReservations: 1,
        _id: 0,
      },
    },
  ];
  return this.aggregate(pipeline);
};

guestSchema.statics.fetchDiscountedGuests = async function (year, month) {
  const startM = month < 10 ? `0${month}` : month;
  let nextM = month + 1;
  let nextY = year;
  if (nextM > 12) {
    nextM = 1;
    nextY = year + 1;
  }
  const endM = nextM < 10 ? `0${nextM}` : nextM;

  const startDate = getStartOfDay(`${year}-${startM}-01`);
  const endDate = getStartOfDay(`${nextY}-${endM}-01`);

  const pipeline = [
    {
      $match: {
        applyDiscount: true,
        checkInAt: { $gte: startDate, $lt: endDate },
      },
    },
    {
      $lookup: {
        from: "rooms",
        localField: "room",
        foreignField: "_id",
        as: "roomDetails",
      },
    },
    { $unwind: { path: "$roomDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "users",
        localField: "createdBy",
        foreignField: "_id",
        as: "creator",
      },
    },
    { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        fullName: 1,
        email: 1,
        totalRent: 1,
        applyDiscount: 1,
        additionaldiscount: 1,
        discountTitle: 1,
        roomNumber: "$roomDetails.roomNumber",
        roomCategory: "$roomDetails.category",
        createdByEmail: "$creator.email",
      },
    },
  ];
  return this.aggregate(pipeline);
};

guestSchema.statics.fetchAllTimeRevenue = async function () {
  const result = await this.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalRent" },
        totalReservations: { $sum: 1 },
      },
    },
    { $project: { _id: 0, totalRevenue: 1, totalReservations: 1 } },
  ]);
  return result[0] || { totalRevenue: 0, totalReservations: 0 };
};

module.exports = mongoose.model("Guest", guestSchema);
