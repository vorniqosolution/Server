const Guest = require("../model/guest");
const Room = require("../model/room");
const Invoice = require("../model/invoice");


const handleError = (res, error, functionName) => {
  console.error(`Error in ${functionName}:`, error);
  res.status(500).json({
    success: false,
    message: `Failed to fetch data in ${functionName}.`,
  });
};

exports.GetMonthlyRevenue = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required." });
    }

    const data = await Guest.fetchRevenueByPeriod({
      period: 'monthly',
      year: parseInt(year),
      month: parseInt(month),
    });

    res.status(200).json({
      success: true,
      month: parseInt(month),
      year: parseInt(year),
      monthlyrevenue: data,
    });
  } catch (error) {
    handleError(res, error, "GetMonthlyRevenue");
  }
};

exports.GetYearlyRevenue = async (req, res) => {
  try {
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ success: false, message: "Year is required." });
    }

    const data = await Guest.fetchRevenueByPeriod({
      period: 'yearly',
      year: parseInt(year),
    });

    res.status(200).json({
      success: true,
      year: parseInt(year),
      ...data,
    });
  } catch (error) {
    handleError(res, error, "GetYearlyRevenue");
  }
};

exports.GetWeeklyRevenue = async (req, res) => {
  try {
    const { week, year } = req.query;
    if (!week || !year) {
      return res.status(400).json({ success: false, message: "Week and year are required." });
    }

    const data = await Guest.fetchRevenueByPeriod({
      period: 'weekly',
      year: parseInt(year),
      week: parseInt(week),
    });
    
    res.status(200).json({
      success: true,
      week: parseInt(week),
      year: parseInt(year),
      weeklyrevenue: data,
    });
  } catch (error) {
    handleError(res, error, "GetWeeklyRevenue");
  }
};

exports.GetDailyRevenue = async (req, res) => {
  try {
    const { day, month, year } = req.query;
    if (!day || !month || !year) {
      return res.status(400).json({ success: false, message: "Day, month, and year are required." });
    }

    const data = await Guest.fetchRevenueByPeriod({
      period: 'daily',
      year: parseInt(year),
      month: parseInt(month),
      day: parseInt(day),
    });

    res.status(200).json({
      success: true,
      day: parseInt(day),
      month: parseInt(month),
      year: parseInt(year),
      ...data,
    });
  } catch (error) {
    handleError(res, error, "GetDailyRevenue");
  }
};

exports.GetRevenueRoomCategories = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required." });
    }

    const categories = await Guest.fetchRevenueByCategory(parseInt(year), parseInt(month));

    res.status(200).json({
      success: true,
      month: parseInt(month),
      year: parseInt(year),
      categories: categories,
    });
  } catch (error) {
    handleError(res, error, "GetRevenueRoomCategories");
  }
};

exports.CheckDiscountedGuest = async (req, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({ success: false, message: "Month and year are required." });
    }

    const guests = await Guest.fetchDiscountedGuests(parseInt(year), parseInt(month));

    res.status(200).json({
      success: true,
      month: parseInt(month),
      year: parseInt(year),
      count: guests.length,
      guests,
    });
  } catch (error) {
    handleError(res, error, "CheckDiscountedGuest");
  }
};

exports.GetAllRevenue = async (req, res) => {
  try {
    const data = await Guest.fetchAllTimeRevenue();
    res.status(200).json({
      success: true,
      ...data,
    });
  } catch (error) {
    handleError(res, error, "GetAllRevenue");
  }
};
