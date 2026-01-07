const mongoose = require("mongoose");

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    guest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Guest",
      required: true,
    },
    items: [invoiceItemSchema],
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    additionaldiscount: { type: Number },
    promoDiscount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled"],
      default: "pending",
    },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    pdfPath: { type: String },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    checkInAt: { type: Date, required: true },
    guestDetails: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      cnic: { type: String, required: true },
      adults: { type: Number, default: 1 },
      infants: { type: Number, default: 0 },
    },
    roomDetails: {
      roomNumber: { type: String, required: true },
      category: { type: String, required: true },
    },
    advanceAdjusted: { type: Number, default: 0 },
    balanceDue: { type: Number },
  },
  { timestamps: true }
);

invoiceSchema.pre("save", async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    this.invoiceNumber = `HSQ-${Date.now()}`;
  }
  next();
});

invoiceSchema.statics.fetchRevenueByPeriod = async function ({
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
        $gte: new Date(year, 0, 1),
        $lt: new Date(year + 1, 0, 1),
      };
      break;
    case "monthly":
      if (!month) throw new Error("Month is required for monthly period.");
      matchStage.checkInAt = {
        $gte: new Date(year, month - 1, 1),
        $lt: new Date(year, month, 1),
      };
      break;
    case "daily":
      if (!month || !day)
        throw new Error("Month and day are required for daily period.");
      matchStage.checkInAt = {
        $gte: new Date(year, month - 1, day),
        $lt: new Date(year, month - 1, day + 1),
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
            totalRevenue: { $sum: "$grandTotal" },
            invoiceCount: { $sum: 1 },
          },
        },
        { $project: { _id: 0, totalRevenue: 1, invoiceCount: 1 } },
      ]);
      return weeklyResult[0] || { totalRevenue: 0, invoiceCount: 0 };
    default:
      throw new Error("Invalid period specified.");
  }
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$grandTotal" },
        invoiceCount: { $sum: 1 },
      },
    },
    { $project: { _id: 0, totalRevenue: 1, invoiceCount: 1 } },
  ];
  const result = await this.aggregate(pipeline);
  return result[0] || { totalRevenue: 0, invoiceCount: 0 };
};
// MOVED & UPDATED: This query is now simpler as it doesn't need to look up rooms.
invoiceSchema.statics.fetchRevenueByCategory = async function (year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const pipeline = [
    { $match: { checkInAt: { $gte: startDate, $lt: endDate } } },
    {
      $group: {
        _id: "$roomDetails.category", // Group by the category stored on the invoice
        totalRevenue: { $sum: "$grandTotal" },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    {
      $project: { category: "$_id", totalRevenue: 1, invoiceCount: 1, _id: 0 },
    },
  ];
  return this.aggregate(pipeline);
};
// MOVED & UPDATED: Simplified query using snapshot data.
invoiceSchema.statics.fetchDiscountedGuests = async function (year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);
  const pipeline = [
    {
      $match: {
        checkInAt: { $gte: startDate, $lt: endDate },
        $or: [
          { discountAmount: { $gt: 0 } },
          { additionaldiscount: { $gt: 0 } },
        ],
      },
    },
    {
      $project: {
        _id: 0,
        fullName: "$guestDetails.fullName",
        totalRent: "$grandTotal",
        discountAmount: { $add: ["$discountAmount", "$additionaldiscount"] },
        roomNumber: "$roomDetails.roomNumber",
        roomCategory: "$roomDetails.category",
      },
    },
  ];
  return this.aggregate(pipeline);
};
// MOVED & UPDATED: Simple change to sum grandTotal.
invoiceSchema.statics.fetchAllTimeRevenue = async function () {
  const result = await this.aggregate([
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$grandTotal" },
        invoiceCount: { $sum: 1 },
      },
    },
    { $project: { _id: 0, totalRevenue: 1, invoiceCount: 1 } },
  ]);
  return result[0] || { totalRevenue: 0, invoiceCount: 0 };
};

module.exports = mongoose.model("Invoice", invoiceSchema);
