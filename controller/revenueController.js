const Guest = require("../model/guest");
const Room = require("../model/room");
const Invoice = require("../model/invoice");

exports.GetAllRevenue = async (req, res) => {
  try {
    const result = await Guest.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRent" },
          totalReservations: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalReservations: 1,
        },
      },
    ]);
    const total = result[0]?.totalRevenue || 0;
    // console.log("result", total);

    res.status(200).json({
      success: true,
      totalrevene: total,
    });
  } catch (err) {
    console.error("Error getting total revenue:", err);
    res.status(500).json({
      success: false,
      message: "Failed to get total revenue",
    });
  }
};

exports.GetMonthlyRevenue = async (req, res) => {
  try {
    const { month, year } = req.query;
    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);
    if (!parsedMonth || !parsedYear) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required in query params.",
      });
    }
    const result = await Guest.aggregate([
      {
        $addFields: {
          month: { $month: "$checkInAt" },
          year: { $year: "$checkInAt" },
        },
      },
      {
        $match: {
          month: parsedMonth,
          year: parsedYear,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRent" },
          totalReservations: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalReservations: 1,
        },
      },
    ]);
    const data = result[0] || { totalRevenue: 0, totalReservations: 0 };
    res.status(200).json({
      success: true,
      month: parsedMonth,
      year: parsedYear,
      monthlyrevenue: data,
    });
  } catch (error) {
    console.error("Error getting monthly revenue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch monthly revenue",
    });
  }
};
exports.GetYearlyRevenue = async (req, res) => {
  try {
    const { year } = req.query;
    const parsedYear = parseInt(year);

    if (!parsedYear) {
      return res.status(400).json({
        success: false,
        message: "Year is required in query params.",
      });
    }
    const result = await Guest.aggregate([
      {
        $addFields: {
          year: { $year: "$checkInAt" },
        },
      },
      {
        $match: {
          year: parsedYear,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRent" },
          totalReservations: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalRevenue: 1,
          totalReservations: 1,
        },
      },
    ]);
    const data = result[0] || { totalRevenue: 0, totalReservations: 0 };
    res.status(200).json({
      success: true,
      year: parsedYear,
      ...data,
    });
  } catch (error) {
    console.error("Error getting yearly revenue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch yearly revenue",
    });
  }
};
exports.GetRevenueRoomCategories = async (req, res) => {
  try {
    const { month, year } = req.query;
    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);
    if (!parsedMonth || !parsedYear) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required in query params.",
      });
    }
    const result = await Guest.aggregate([
      {
        $lookup: {
          from: "rooms",
          localField: "room",
          foreignField: "_id",
          as: "roomData",
        },
      },
      {
        $unwind: "$roomData",
      },
      {
        $addFields: {
          month: { $month: "$checkInAt" },
          year: { $year: "$checkInAt" },
        },
      },
      {
        $match: {
          month: parsedMonth,
          year: parsedYear,
        },
      },
      {
        $group: {
          _id: "$roomData.category",
          totalRevenue: { $sum: "$totalRent" },
          totalGuests: { $sum: 1 },
        },
      },
      {
        $sort: { totalRevenue: -1 },
      },
    ]);
    res.status(200).json({
      success: true,
      month: parsedMonth,
      year: parsedYear,
      categories: result,
    });
  } catch (error) {
    console.error("Error in category-wise revenue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to calculate revenue by category",
    });
  }
};
exports.CheckDiscountedGuest = async (req, res) => {
  try {
    const { month, year } = req.query;

    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);
    if (!parsedMonth || !parsedYear) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required in query params.",
      });
    }

    const guests = await Guest.aggregate([
      // Add month and year fields
      {
        $addFields: {
          month: { $month: "$checkInAt" },
          year: { $year: "$checkInAt" },
        },
      },
      // Filter by given month + year and guests with discount
      {
        $match: {
          month: parsedMonth,
          year: parsedYear,
          applyDiscount: true,
        },
      },
      // Lookup room
      {
        $lookup: {
          from: "rooms",
          localField: "room",
          foreignField: "_id",
          as: "roomDetails",
        },
      },
      {
        $unwind: {
          path: "$roomDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Lookup createdBy (user)
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "creator",
        },
      },
      {
        $unwind: {
          path: "$creator",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Final projection
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
    ]);

    res.status(200).json({
      success: true,
      month: parsedMonth,
      year: parsedYear,
      count: guests.length,
      guests,
    });
  } catch (error) {
    console.error("Error fetching discounted guests:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching discounted guests",
    });
  }
};

// skip id from getweekly revenue. pending
exports.GetWeeklyRevenue = async (req, res) => {
  try {
    const { week, year } = req.query;
    const parsedWeek = parseInt(week);
    const parsedYear = parseInt(year);
    console.log("week", week);
    console.log("year", year);

    if (!parsedWeek || !parsedYear) {
      return res.status(400).json({
        success: false,
        message: "Week and year are required in query params.",
      });
    }

    const result = await Guest.aggregate([
      {
        $addFields: {
          week: { $isoWeek: "$checkInAt" },
          year: { $isoWeekYear: "$checkInAt" },
        },
      },
      {
        $match: {
          week: parsedWeek,
          year: parsedYear,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRent" },
          totalGuests: { $sum: 1 },
        },
      },
    ]);

    const data = result[0] || { totalRevenue: 0, totalGuests: 0 };

    res.status(200).json({
      success: true,
      week: parsedWeek,
      year: parsedYear,
      weeklyrevenue: data,
    });
  } catch (error) {
    console.error("Error getting weekly revenue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch weekly revenue",
    });
  }
};

// skip id from daily revenue. pending
exports.GetDailyRevenue = async (req, res) => {
  try {
    const { day, month, year } = req.query;

    const parsedDay = parseInt(day);
    const parsedMonth = parseInt(month);
    const parsedYear = parseInt(year);

    if (!parsedDay || !parsedMonth || !parsedYear) {
      return res.status(400).json({
        success: false,
        message: "Day, month, and year are required in query params.",
      });
    }

    const result = await Guest.aggregate([
      {
        $addFields: {
          day: { $dayOfMonth: "$checkInAt" },
          month: { $month: "$checkInAt" },
          year: { $year: "$checkInAt" },
        },
      },
      {
        $match: {
          day: parsedDay,
          month: parsedMonth,
          year: parsedYear,
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRent" },
          totalReservations: { $sum: 1 },
        },
      },
    ]);

    const data = result[0] || { totalRevenue: 0, totalReservations: 0 };

    res.status(200).json({
      success: true,
      day: parsedDay,
      month: parsedMonth,
      year: parsedYear,
      ...data,
    });
  } catch (error) {
    console.error("Error getting daily revenue:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch daily revenue",
    });
  }
};
