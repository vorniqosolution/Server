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
      },
    },
    checkOutAt: { type: Date },
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
    stayDuration: { type: Number, required: true }, // in days
    applyDiscount: { type: Boolean, default: false },
    discountTitle: { type: String }, // Optional for reference
    totalRent: { type: Number }, // calculated final rent
    gst: { type: Number }, //change
    additionaldiscount: { type: Number },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },

  { timestamps: true }
);

module.exports = mongoose.model("Guest", guestSchema);

// guestSchema.statics.fetchRevenueByPeriod = async function({ period, year, month, week, day }) {
//   const matchStage = {};
//   switch (period) {
//     case 'yearly':
//       matchStage.checkInAt = { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) };
//       break;
//     case 'monthly':
//       if (!month) throw new Error("Month is required for monthly period.");
//       matchStage.checkInAt = { $gte: new Date(year, month - 1, 1), $lt: new Date(year, month, 1) };
//       break;
//     case 'daily':
//       if (!month || !day) throw new Error("Month and day are required for daily period.");
//       matchStage.checkInAt = { $gte: new Date(year, month - 1, day), $lt: new Date(year, month - 1, day + 1) };
//       break;
//     case 'weekly':
//        if (!week) throw new Error("Week is required for weekly period.");
//        const weeklyResult = await this.aggregate([
//          { $addFields: { week: { $isoWeek: "$checkInAt" }, year: { $isoWeekYear: "$checkInAt" } } },
//          { $match: { week, year } },
//          { $group: { _id: null, totalRevenue: { $sum: "$totalRent" }, totalReservations: { $sum: 1 } } },
//          { $project: { _id: 0, totalRevenue: 1, totalReservations: 1 } },
//        ]);
//        return weeklyResult[0] || { totalRevenue: 0, totalReservations: 0 };
//     default:
//       throw new Error("Invalid period specified.");
//   }
//   const pipeline = [
//     { $match: matchStage },
//     { $group: { _id: null, totalRevenue: { $sum: "$totalRent" }, totalReservations: { $sum: 1 } } },
//     { $project: { _id: 0, totalRevenue: 1, totalReservations: 1 } },
//   ];
//   const result = await this.aggregate(pipeline);
//   return result[0] || { totalRevenue: 0, totalReservations: 0 };
// };

// guestSchema.statics.fetchRevenueByCategory = async function(year, month) {
//   const startDate = new Date(year, month - 1, 1);
//   const endDate = new Date(year, month, 1);
//   const pipeline = [
//     { $match: { checkInAt: { $gte: startDate, $lt: endDate } } },
//     { $lookup: { from: "rooms", localField: "room", foreignField: "_id", as: "roomData" } },
//     { $unwind: "$roomData" },
//     { $group: { _id: "$roomData.category", totalRevenue: { $sum: "$totalRent" }, totalReservations: { $sum: 1 } } },
//     { $sort: { totalRevenue: -1 } },
//     { $project: { category: "$_id", totalRevenue: 1, totalReservations: 1, _id: 0 } }
//   ];
//   return this.aggregate(pipeline);
// };

// guestSchema.statics.fetchDiscountedGuests = async function(year, month) {
//   const startDate = new Date(year, month - 1, 1);
//   const endDate = new Date(year, month, 1);
//   const pipeline = [
//     { $match: { applyDiscount: true, checkInAt: { $gte: startDate, $lt: endDate } } },
//     { $lookup: { from: "rooms", localField: "room", foreignField: "_id", as: "roomDetails" } },
//     { $unwind: { path: "$roomDetails", preserveNullAndEmptyArrays: true } },
//     { $lookup: { from: "users", localField: "createdBy", foreignField: "_id", as: "creator" } },
//     { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
//     {
//       $project: {
//         _id: 0, fullName: 1, email: 1, totalRent: 1, applyDiscount: 1, additionaldiscount: 1,
//         discountTitle: 1, roomNumber: "$roomDetails.roomNumber", roomCategory: "$roomDetails.category",
//         createdByEmail: "$creator.email",
//       },
//     },
//   ];
//   return this.aggregate(pipeline);
// };

// guestSchema.statics.fetchAllTimeRevenue = async function() {
//     const result = await this.aggregate([
//         { $group: { _id: null, totalRevenue: { $sum: "$totalRent" }, totalReservations: { $sum: 1 } } },
//         { $project: { _id: 0, totalRevenue: 1, totalReservations: 1 } },
//     ]);
//     return result[0] || { totalRevenue: 0, totalReservations: 0 };
// };
// const mongoose = require("mongoose");
// const guestSchema = new mongoose.Schema(
//   {
//     fullName: { type: String, required: true, trim: true },
//     address: { type: String, required: true, trim: true },
//     phone: { type: String, required: true, trim: true },
//     email: {
//       type: String,
//       trim: true,
//       lowercase: true,
//       // match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please fill a valid email address"]
//     },
//     cnic: { type: String, required: true, trim: true },
//     room: { type: mongoose.Schema.Types.ObjectId, ref: "Room", required: true },
//     checkInAt: { type: Date, default: Date.now },
//     checkInTime: {
//       type: String,
//       default: function () {
//         return this.checkInAt.toTimeString().slice(0, 5);
//       },
//     },
//     checkOutAt: { type: Date },
//     checkOutTime: {
//       type: String,
//       default: function () {
//         return this.checkOutAt
//           ? this.checkOutAt.toTimeString().slice(0, 5)
//           : null;
//       },
//     },
//     status: {
//       type: String,
//       enum: ["checked-in", "checked-out"],
//       default: "checked-in",
//     },
//     paymentMethod: {
//       type: String,
//       enum: ["cash", "card", "online"],
//       default: "cash",
//       required: true,
//     },
//     stayDuration: { type: Number, required: true }, // in days
//     applyDiscount: { type: Boolean, default: false },
//     discountTitle: { type: String }, // Optional for reference
//     totalRent: { type: Number }, // calculated final rent
//     gst: { type: Number }, //change
//     additionaldiscount: { type: Number },
//     createdBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//   },

//   { timestamps: true }
// );

// module.exports = mongoose.model("Guest", guestSchema);
