
const Guest = require("../model/guest");
const Room = require("../model/room");
const mongoose = require("mongoose");

exports.getRevenueByCategoryAndPeriod = async (req, res, next) => {
  try {
    const { category, period = 'monthly', year = new Date().getFullYear() } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: "Please provide a room category",
      });
    }

    // First, get all room IDs for the specified category
    const roomsInCategory = await Room.find({ category: category }).select('_id');
    const roomIds = roomsInCategory.map(room => room._id);

    if (roomIds.length === 0) {
      return res.status(200).json({
        success: true,
        category: category,
        message: `No rooms found for category: ${category}`,
        data: []
      });
    }

    // Define date ranges based on period
    let startDate, endDate, groupByFormat, dateFormat;
    
    const currentDate = new Date();
    const yearNum = parseInt(year);

    switch (period) {
      case 'daily':
        // Last 30 days
        startDate = new Date(currentDate);
        startDate.setDate(startDate.getDate() - 30);
        endDate = currentDate;
        groupByFormat = {
          year: { $year: "$checkInAt" },
          month: { $month: "$checkInAt" },
          day: { $dayOfMonth: "$checkInAt" }
        };
        dateFormat = "%Y-%m-%d";
        break;

      case 'weekly':
        // Current year by weeks
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        groupByFormat = {
          year: { $year: "$checkInAt" },
          week: { $week: "$checkInAt" }
        };
        dateFormat = "Week %V of %Y";
        break;

      case 'monthly':
        // Monthly for specified year
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        groupByFormat = {
          year: { $year: "$checkInAt" },
          month: { $month: "$checkInAt" }
        };
        dateFormat = "%B %Y";
        break;

      case 'yearly':
        // Last 5 years
        startDate = new Date(yearNum - 4, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        groupByFormat = {
          year: { $year: "$checkInAt" }
        };
        dateFormat = "%Y";
        break;

      default:
        return res.status(400).json({
          success: false,
          error: "Invalid period. Use: daily, weekly, monthly, or yearly"
        });
    }

    // Aggregate revenue data
    const revenueData = await Guest.aggregate([
      {
        // Match guests in the specified rooms and date range
        $match: {
          room: { $in: roomIds },
          checkInAt: { $gte: startDate, $lte: endDate },
          // Only count guests who have actually paid (you might want to add a 'paid' field)
          totalRent: { $exists: true, $ne: null }
        }
      },
      {
        // Group by time period
        $group: {
          _id: groupByFormat,
          totalRevenue: { $sum: "$totalRent" },
          guestCount: { $sum: 1 },
          averageRent: { $avg: "$totalRent" },
          minRent: { $min: "$totalRent" },
          maxRent: { $max: "$totalRent" }
        }
      },
      {
        // Sort by date
        $sort: { "_id": 1 }
      },
      {
        // Format the output
        $project: {
          _id: 0,
          period: "$_id",
          totalRevenue: 1,
          guestCount: 1,
          averageRent: { $round: ["$averageRent", 2] },
          minRent: 1,
          maxRent: 1
        }
      }
    ]);

    // Calculate summary statistics
    const summary = await Guest.aggregate([
      {
        $match: {
          room: { $in: roomIds },
          checkInAt: { $gte: startDate, $lte: endDate },
          totalRent: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$totalRent" },
          totalGuests: { $sum: 1 },
          averageRevenue: { $avg: "$totalRent" }
        }
      }
    ]);

    // Format period labels for better readability
    const formattedData = revenueData.map(item => {
      let periodLabel;
      switch (period) {
        case 'daily':
          periodLabel = `${item.period.year}-${String(item.period.month).padStart(2, '0')}-${String(item.period.day).padStart(2, '0')}`;
          break;
        case 'weekly':
          periodLabel = `Week ${item.period.week} of ${item.period.year}`;
          break;
        case 'monthly':
          const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
          periodLabel = `${monthNames[item.period.month - 1]} ${item.period.year}`;
          break;
        case 'yearly':
          periodLabel = `${item.period.year}`;
          break;
      }

      return {
        period: periodLabel,
        totalRevenue: item.totalRevenue,
        totalRevenueFormatted: `Rs ${item.totalRevenue.toLocaleString()}`,
        guestCount: item.guestCount,
        averageRent: item.averageRent,
        averageRentFormatted: `Rs ${item.averageRent.toLocaleString()}`,
        minRent: item.minRent,
        maxRent: item.maxRent
      };
    });

    res.status(200).json({
      success: true,
      category: category,
      period: period,
      year: yearNum,
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalRevenue: summary[0]?.totalRevenue || 0,
        totalRevenueFormatted: `Rs ${(summary[0]?.totalRevenue || 0).toLocaleString()}`,
        totalGuests: summary[0]?.totalGuests || 0,
        averageRevenuePerGuest: Math.round(summary[0]?.averageRevenue || 0),
        averageRevenuePerGuestFormatted: `Rs ${Math.round(summary[0]?.averageRevenue || 0).toLocaleString()}`
      },
      data: formattedData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.compareRevenueByCategories = async (req, res, next) => {
  try {
    const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    
    // Get all room categories
    const categories = Room.schema.path('category').enumValues;
    
    const yearNum = parseInt(year);
    let startDate, endDate;
    
    // Set date range based on period
    switch (period) {
      case 'monthly':
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        break;
      case 'yearly':
        startDate = new Date(yearNum - 4, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        break;
      default:
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31);
    }

    // Get revenue for each category
    const categoryRevenues = await Promise.all(
      categories.map(async (category) => {
        // Get rooms for this category
        const roomsInCategory = await Room.find({ category }).select('_id');
        const roomIds = roomsInCategory.map(room => room._id);
        
        if (roomIds.length === 0) {
          return {
            category,
            totalRevenue: 0,
            guestCount: 0,
            roomCount: 0
          };
        }

        // Get revenue data
        const revenueData = await Guest.aggregate([
          {
            $match: {
              room: { $in: roomIds },
              checkInAt: { $gte: startDate, $lte: endDate },
              totalRent: { $exists: true, $ne: null }
            }
          },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: "$totalRent" },
              guestCount: { $sum: 1 },
              averageRent: { $avg: "$totalRent" }
            }
          }
        ]);

        return {
          category,
          totalRevenue: revenueData[0]?.totalRevenue || 0,
          totalRevenueFormatted: `Rs ${(revenueData[0]?.totalRevenue || 0).toLocaleString()}`,
          guestCount: revenueData[0]?.guestCount || 0,
          averageRent: Math.round(revenueData[0]?.averageRent || 0),
          roomCount: roomIds.length
        };
      })
    );

    // Calculate totals
    const totals = categoryRevenues.reduce((acc, curr) => ({
      totalRevenue: acc.totalRevenue + curr.totalRevenue,
      totalGuests: acc.totalGuests + curr.guestCount,
      totalRooms: acc.totalRooms + curr.roomCount
    }), { totalRevenue: 0, totalGuests: 0, totalRooms: 0 });

    // Sort by revenue (highest first)
    categoryRevenues.sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.status(200).json({
      success: true,
      period: period,
      year: yearNum,
      dateRange: {
        from: startDate.toISOString().split('T')[0],
        to: endDate.toISOString().split('T')[0]
      },
      summary: {
        totalRevenue: totals.totalRevenue,
        totalRevenueFormatted: `Rs ${totals.totalRevenue.toLocaleString()}`,
        totalGuests: totals.totalGuests,
        totalRooms: totals.totalRooms
      },
      data: categoryRevenues
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};


exports.getDailyRevenueSummary = async (req, res, next) => {
  try {
    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default: 30 days ago
      endDate = new Date().toISOString().split('T')[0] // Default: today
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // End of day

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: "Start date cannot be after end date"
      });
    }

    // Get daily revenue breakdown
    const dailyRevenue = await Guest.aggregate([
      {
        $match: {
          checkInAt: { $gte: start, $lte: end },
          totalRent: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$checkInAt" },
            month: { $month: "$checkInAt" },
            day: { $dayOfMonth: "$checkInAt" }
          },
          totalRevenue: { $sum: "$totalRent" },
          guestCount: { $sum: 1 },
          averageRevenue: { $avg: "$totalRent" },
          checkIns: { $sum: { $cond: [{ $eq: ["$status", "checked-in"] }, 1, 0] } },
          checkOuts: { $sum: { $cond: [{ $eq: ["$status", "checked-out"] }, 1, 0] } }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      },
      {
        $project: {
          _id: 0,
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day"
            }
          },
          totalRevenue: 1,
          guestCount: 1,
          averageRevenue: { $round: ["$averageRevenue", 2] },
          checkIns: 1,
          checkOuts: 1
        }
      }
    ]);

    // Format the data
    const formattedData = dailyRevenue.map(day => ({
      date: day.date.toISOString().split('T')[0],
      totalRevenue: day.totalRevenue,
      totalRevenueFormatted: `Rs ${day.totalRevenue.toLocaleString()}`,
      guestCount: day.guestCount,
      averageRevenue: day.averageRevenue,
      averageRevenueFormatted: `Rs ${day.averageRevenue.toLocaleString()}`,
      checkIns: day.checkIns,
      checkOuts: day.checkOuts
    }));

    // Calculate summary statistics
    const summary = dailyRevenue.reduce((acc, day) => ({
      totalRevenue: acc.totalRevenue + day.totalRevenue,
      totalGuests: acc.totalGuests + day.guestCount,
      totalCheckIns: acc.totalCheckIns + day.checkIns,
      totalCheckOuts: acc.totalCheckOuts + day.checkOuts
    }), { totalRevenue: 0, totalGuests: 0, totalCheckIns: 0, totalCheckOuts: 0 });

    const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    res.status(200).json({
      success: true,
      dateRange: {
        from: startDate,
        to: endDate,
        days: dayCount
      },
      summary: {
        totalRevenue: summary.totalRevenue,
        totalRevenueFormatted: `Rs ${summary.totalRevenue.toLocaleString()}`,
        totalGuests: summary.totalGuests,
        averageDailyRevenue: Math.round(summary.totalRevenue / dayCount),
        averageDailyRevenueFormatted: `Rs ${Math.round(summary.totalRevenue / dayCount).toLocaleString()}`,
        totalCheckIns: summary.totalCheckIns,
        totalCheckOuts: summary.totalCheckOuts
      },
      data: formattedData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.getOccupancyAnalytics = async (req, res, next) => {
  try {
    const { 
      period = 'monthly', 
      year = new Date().getFullYear(),
      category = 'all'
    } = req.query;

    const yearNum = parseInt(year);
    let startDate, endDate, groupByFormat;

    // Set date range based on period
    switch (period) {
      case 'daily':
        startDate = new Date(yearNum, new Date().getMonth(), 1);
        endDate = new Date(yearNum, new Date().getMonth() + 1, 0);
        groupByFormat = {
          year: { $year: "$checkInAt" },
          month: { $month: "$checkInAt" },
          day: { $dayOfMonth: "$checkInAt" }
        };
        break;
      case 'monthly':
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        groupByFormat = {
          year: { $year: "$checkInAt" },
          month: { $month: "$checkInAt" }
        };
        break;
      case 'yearly':
        startDate = new Date(yearNum - 4, 0, 1);
        endDate = new Date(yearNum, 11, 31);
        groupByFormat = {
          year: { $year: "$checkInAt" }
        };
        break;
      default:
        return res.status(400).json({
          success: false,
          error: "Invalid period. Use: daily, monthly, or yearly"
        });
    }

    // Get total rooms (filtered by category if specified)
    let roomQuery = {};
    if (category !== 'all') {
      roomQuery = { category: category };
    }
    
    const totalRooms = await Room.countDocuments(roomQuery);
    const roomsInCategory = category !== 'all' ? 
      await Room.find(roomQuery).select('_id') : 
      await Room.find({}).select('_id');
    
    const roomIds = roomsInCategory.map(room => room._id);

    if (totalRooms === 0) {
      return res.status(200).json({
        success: true,
        message: "No rooms found for the specified criteria",
        data: []
      });
    }

    // Get occupancy data
    const occupancyData = await Guest.aggregate([
      {
        $match: {
          checkInAt: { $gte: startDate, $lte: endDate },
          ...(category !== 'all' && { room: { $in: roomIds } })
        }
      },
      {
        $group: {
          _id: groupByFormat,
          occupiedRoomDays: { $sum: "$stayDuration" },
          totalGuests: { $sum: 1 },
          totalRevenue: { $sum: "$totalRent" },
          uniqueRooms: { $addToSet: "$room" }
        }
      },
      {
        $addFields: {
          occupiedRooms: { $size: "$uniqueRooms" }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ]);

    // Calculate occupancy rates and RevPAR
    const formattedData = occupancyData.map(item => {
      let periodLabel;
      let daysInPeriod;

      switch (period) {
        case 'daily':
          periodLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
          daysInPeriod = 1;
          break;
        case 'monthly':
          const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
          periodLabel = `${monthNames[item._id.month - 1]} ${item._id.year}`;
          daysInPeriod = new Date(item._id.year, item._id.month, 0).getDate();
          break;
        case 'yearly':
          periodLabel = `${item._id.year}`;
          daysInPeriod = (item._id.year % 4 === 0) ? 366 : 365;
          break;
      }

      const totalRoomDays = totalRooms * daysInPeriod;
      const occupancyRate = (item.occupiedRoomDays / totalRoomDays) * 100;
      const revPAR = item.totalRevenue / totalRooms; // Revenue per Available Room

      return {
        period: periodLabel,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        occupancyRateFormatted: `${Math.round(occupancyRate * 100) / 100}%`,
        occupiedRoomDays: item.occupiedRoomDays,
        totalRoomDays: totalRoomDays,
        uniqueRoomsOccupied: item.occupiedRooms,
        totalRooms: totalRooms,
        totalGuests: item.totalGuests,
        totalRevenue: item.totalRevenue,
        totalRevenueFormatted: `Rs ${item.totalRevenue.toLocaleString()}`,
        revPAR: Math.round(revPAR),
        revPARFormatted: `Rs ${Math.round(revPAR).toLocaleString()}`
      };
    });

    // Calculate overall summary
    const overallSummary = occupancyData.reduce((acc, curr) => ({
      totalOccupiedRoomDays: acc.totalOccupiedRoomDays + curr.occupiedRoomDays,
      totalRevenue: acc.totalRevenue + curr.totalRevenue,
      totalGuests: acc.totalGuests + curr.totalGuests
    }), { totalOccupiedRoomDays: 0, totalRevenue: 0, totalGuests: 0 });

    const periodCount = occupancyData.length;
    const totalPossibleRoomDays = totalRooms * (period === 'daily' ? periodCount : 
      period === 'monthly' ? periodCount * 30 : periodCount * 365);
    
    const averageOccupancyRate = periodCount > 0 ? 
      (overallSummary.totalOccupiedRoomDays / totalPossibleRoomDays) * 100 : 0;

    res.status(200).json({
      success: true,
      period: period,
      year: yearNum,
      category: category,
      summary: {
        averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
        averageOccupancyRateFormatted: `${Math.round(averageOccupancyRate * 100) / 100}%`,
        totalRooms: totalRooms,
        totalRevenue: overallSummary.totalRevenue,
        totalRevenueFormatted: `Rs ${overallSummary.totalRevenue.toLocaleString()}`,
        totalGuests: overallSummary.totalGuests,
        averageRevPAR: Math.round(overallSummary.totalRevenue / totalRooms),
        averageRevPARFormatted: `Rs ${Math.round(overallSummary.totalRevenue / totalRooms).toLocaleString()}`
      },
      data: formattedData
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};


exports.getRevenueByPaymentMethods = async (req, res, next) => {
  try {
    const { 
      startDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0],
      category = 'all'
    } = req.query;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({
        success: false,
        error: "Start date cannot be after end date"
      });
    }

    // Build match query
    let matchQuery = {
      checkInAt: { $gte: start, $lte: end },
      totalRent: { $exists: true, $ne: null }
    };

    // If category is specified, get room IDs for that category
    if (category !== 'all') {
      const roomsInCategory = await Room.find({ category: category }).select('_id');
      const roomIds = roomsInCategory.map(room => room._id);
      
      if (roomIds.length === 0) {
        return res.status(200).json({
          success: true,
          category: category,
          message: `No rooms found for category: ${category}`,
          data: []
        });
      }
      
      matchQuery.room = { $in: roomIds };
    }

    // Get payment method breakdown
    const paymentMethodData = await Guest.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: "$paymentMethod",
          totalRevenue: { $sum: "$totalRent" },
          guestCount: { $sum: 1 },
          averageAmount: { $avg: "$totalRent" },
          minAmount: { $min: "$totalRent" },
          maxAmount: { $max: "$totalRent" }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    // Calculate total revenue for percentages
    const totalRevenue = paymentMethodData.reduce((sum, method) => sum + method.totalRevenue, 0);
    const totalGuests = paymentMethodData.reduce((sum, method) => sum + method.guestCount, 0);

    // Format the data
    const formattedData = paymentMethodData.map(method => {
      const percentage = totalRevenue > 0 ? (method.totalRevenue / totalRevenue) * 100 : 0;
      
      return {
        paymentMethod: method._id,
        totalRevenue: method.totalRevenue,
        totalRevenueFormatted: `Rs ${method.totalRevenue.toLocaleString()}`,
        percentage: Math.round(percentage * 100) / 100,
        percentageFormatted: `${Math.round(percentage * 100) / 100}%`,
        guestCount: method.guestCount,
        averageAmount: Math.round(method.averageAmount),
        averageAmountFormatted: `Rs ${Math.round(method.averageAmount).toLocaleString()}`,
        minAmount: method.minAmount,
        maxAmount: method.maxAmount
      };
    });

    // Get trend data (month-wise breakdown)
    const trendData = await Guest.aggregate([
      {
        $match: matchQuery
      },
      {
        $group: {
          _id: {
            year: { $year: "$checkInAt" },
            month: { $month: "$checkInAt" },
            paymentMethod: "$paymentMethod"
          },
          monthlyRevenue: { $sum: "$totalRent" },
          monthlyCount: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    // Format trend data
    const monthlyTrends = {};
    trendData.forEach(item => {
      const monthKey = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (!monthlyTrends[monthKey]) {
        monthlyTrends[monthKey] = {};
      }
      monthlyTrends[monthKey][item._id.paymentMethod] = {
        revenue: item.monthlyRevenue,
        count: item.monthlyCount
      };
    });

    res.status(200).json({
      success: true,
      dateRange: {
        from: startDate,
        to: endDate
      },
      category: category,
      summary: {
        totalRevenue: totalRevenue,
        totalRevenueFormatted: `Rs ${totalRevenue.toLocaleString()}`,
        totalGuests: totalGuests,
        averageTransactionAmount: Math.round(totalRevenue / totalGuests),
        averageTransactionAmountFormatted: `Rs ${Math.round(totalRevenue / totalGuests).toLocaleString()}`,
        paymentMethodsUsed: paymentMethodData.length
      },
      paymentBreakdown: formattedData,
      monthlyTrends: monthlyTrends
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

