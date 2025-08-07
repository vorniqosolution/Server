
const Guest = require("../model/guest");
const Room = require("../model/room");
const Invoice = require("../model/invoice");
const mongoose = require("mongoose");



const createBasePipeline = (startDate, endDate, category = 'all') => {
  const pipeline = [
    // 1. Start with PAID Invoices
    { $match: { status: 'paid' } },
    // 2. Join with Guests
    { $lookup: { from: 'guests', localField: 'createdBy', foreignField: 'createdBy', as: 'guestInfo' } },
    { $unwind: '$guestInfo' },
    // 3. Join with Rooms (CORRECTED foreignField)
    {
      $lookup: {
        from: 'rooms',
        localField: 'guestInfo.room',
        foreignField: 'createdBy', // <-- THE FIX IS HERE
        as: 'roomInfo'
      }
    },
    { $unwind: '$roomInfo' },
    // 4. Filter by date range (using checkOutDate)
    {
      $match: {
        'guestInfo.checkOutDate': {
          $gte: new Date(startDate),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)) // Ensure end of day
        }
      }
    }
  ];

  // Add category filter if not 'all'
  if (category !== 'all') {
    pipeline.push({ $match: { 'roomInfo.category': category } });
  }

  return pipeline;
};

exports.getRevenueByCategoryAndPeriod = async (req, res, next) => {
  try {
    const { category, period = 'monthly', year = new Date().getFullYear() } = req.query;

    if (!category) {
      return res.status(400).json({ success: false, error: "Please provide a room category" });
    }

    let startDate, endDate, groupByFormat;
    const yearNum = parseInt(year);

    // Define date ranges and grouping formats based on checkout date
    switch (period) {
      case 'daily':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        endDate = new Date();
        groupByFormat = { year: { $year: "$guestInfo.checkOutDate" }, month: { $month: "$guestInfo.checkOutDate" }, day: { $dayOfMonth: "$guestInfo.checkOutDate" } };
        break;
      case 'weekly':
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        groupByFormat = { year: { $year: "$guestInfo.checkOutDate" }, week: { $week: "$guestInfo.checkOutDate" } };
        break;
      case 'monthly':
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        groupByFormat = { year: { $year: "$guestInfo.checkOutDate" }, month: { $month: "$guestInfo.checkOutDate" } };
        break;
      case 'yearly':
        startDate = new Date(yearNum - 4, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        groupByFormat = { year: { $year: "$guestInfo.checkOutDate" } };
        break;
      default:
        return res.status(400).json({ success: false, error: "Invalid period. Use: daily, weekly, monthly, or yearly" });
    }

    // Use the helper to create a consistent base query
    const basePipeline = createBasePipeline(startDate, endDate, category);

    // Get the detailed data broken down by period
    const revenueData = await Invoice.aggregate([
      ...basePipeline,
      {
        $group: {
          _id: groupByFormat,
          totalRevenue: { $sum: '$grandTotal' },
          guestCount: { $sum: 1 },
          averageRent: { $avg: '$grandTotal' },
          minRent: { $min: '$grandTotal' },
          maxRent: { $max: '$grandTotal' }
        }
      },
      { $sort: { "_id": 1 } },
      {
        $project: {
          _id: 0,
          period: '$_id',
          totalRevenue: 1,
          guestCount: 1,
          averageRent: { $round: ["$averageRent", 2] },
          minRent: 1,
          maxRent: 1
        }
      }
    ]);

    // Get the overall summary for the entire period
    const summaryData = await Invoice.aggregate([
        ...basePipeline,
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$grandTotal' },
            totalGuests: { $sum: 1 },
            averageRevenuePerGuest: { $avg: '$grandTotal' }
          }
        }
    ]);
    const summary = summaryData[0] || {}; // Use a default object if no data

    // Format the period data for a clean frontend display
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
          const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
          periodLabel = `${monthNames[item.period.month - 1]} ${item.period.year}`;
          break;
        case 'yearly':
          periodLabel = `${item.period.year}`;
          break;
        default:
          periodLabel = 'Unknown Period';
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

    // Send the final, well-structured response
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
        totalRevenue: summary.totalRevenue || 0,
        totalRevenueFormatted: `Rs ${(summary.totalRevenue || 0).toLocaleString()}`,
        totalGuests: summary.totalGuests || 0,
        averageRevenuePerGuest: Math.round(summary.averageRevenuePerGuest || 0),
        averageRevenuePerGuestFormatted: `Rs ${Math.round(summary.averageRevenuePerGuest || 0).toLocaleString()}`
      },
      data: formattedData
    });
  } catch (error) {
    console.error("getRevenueByCategoryAndPeriod Error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.compareRevenueByCategories = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const yearNum = parseInt(year);
    const startDate = new Date(yearNum, 0, 1);
    const endDate = new Date(yearNum, 11, 31);

    const basePipeline = createBasePipeline(startDate, endDate);

    const categoryRevenues = await Invoice.aggregate([
        ...basePipeline,
        { $group: {
            _id: '$roomInfo.category',
            totalRevenue: { $sum: '$grandTotal' },
            guestCount: { $sum: 1 },
            averageRent: { $avg: '$grandTotal' }
        }},
        { $lookup: {
            from: 'rooms', let: { categoryName: '$_id' },
            pipeline: [ { $match: { $expr: { $eq: ['$category', '$$categoryName'] } } }, { $count: 'roomCount' } ],
            as: 'roomCountData'
        }},
        { $project: {
            _id: 0, category: '$_id', totalRevenue: 1, guestCount: 1,
            averageRent: { $round: ['$averageRent', 2] },
            roomCount: { $ifNull: [{ $arrayElemAt: ['$roomCountData.roomCount', 0] }, 0] }
        }},
        { $sort: { totalRevenue: -1 } }
    ]);
    
    const formattedData = categoryRevenues.map(cat => ({
        ...cat,
        totalRevenueFormatted: `Rs ${cat.totalRevenue.toLocaleString()}`,
    }));

    const summary = formattedData.reduce((acc, curr) => ({
      totalRevenue: acc.totalRevenue + curr.totalRevenue,
      totalGuests: acc.totalGuests + curr.guestCount,
      totalRooms: acc.totalRooms + curr.roomCount
    }), { totalRevenue: 0, totalGuests: 0, totalRooms: 0 });

    res.status(200).json({
      success: true,
      year: yearNum,
      dateRange: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0] },
      summary: {
        totalRevenue: summary.totalRevenue,
        totalRevenueFormatted: `Rs ${summary.totalRevenue.toLocaleString()}`,
        totalGuests: summary.totalGuests,
        totalRooms: summary.totalRooms
      },
      data: formattedData
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.getDailyRevenueSummary = async (req, res, next) => {
    try {
        const { startDate: reqStartDate, endDate: reqEndDate } = req.query;
        const startDate = reqStartDate ? new Date(reqStartDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = reqEndDate ? new Date(reqEndDate) : new Date();

        const basePipeline = createBasePipeline(startDate, endDate);

        const dailyData = await Invoice.aggregate([
            ...basePipeline,
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$guestInfo.checkOutDate" } },
                totalRevenue: { $sum: '$grandTotal' },
                guestCount: { $sum: 1 }, // Represents paid checkouts on this day
                averageRevenue: { $avg: '$grandTotal' },
            }},
            { $sort: { "_id": 1 } },
            { $project: {
                _id: 0, date: '$_id', totalRevenue: 1, guestCount: 1,
                averageRevenue: { $round: ["$averageRevenue", 2] },
                // Note: checkIns/checkOuts are now implicitly guestCount per checkout day
                checkIns: 0, // This metric is no longer directly applicable
                checkOuts: '$guestCount' // A more accurate name
            }}
        ]);

        const formattedData = dailyData.map(day => ({
            date: day.date,
            totalRevenue: day.totalRevenue,
            totalRevenueFormatted: `Rs ${day.totalRevenue.toLocaleString()}`,
            guestCount: day.guestCount,
            averageRevenue: day.averageRevenue,
            averageRevenueFormatted: `Rs ${day.averageRevenue.toLocaleString()}`,
            checkIns: day.checkIns, // Kept for frontend compatibility
            checkOuts: day.checkOuts
        }));

        const summary = formattedData.reduce((acc, day) => ({
            totalRevenue: acc.totalRevenue + day.totalRevenue,
            totalGuests: acc.totalGuests + day.guestCount,
            totalCheckOuts: acc.totalCheckOuts + day.checkOuts
        }), { totalRevenue: 0, totalGuests: 0, totalCheckOuts: 0 });

        const dayCount = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        res.status(200).json({
            success: true,
            dateRange: { from: startDate.toISOString().split('T')[0], to: endDate.toISOString().split('T')[0], days: dayCount },
            summary: {
                totalRevenue: summary.totalRevenue,
                totalRevenueFormatted: `Rs ${summary.totalRevenue.toLocaleString()}`,
                totalGuests: summary.totalGuests, // Total paid checkouts in period
                averageDailyRevenue: dayCount > 0 ? Math.round(summary.totalRevenue / dayCount) : 0,
                averageDailyRevenueFormatted: `Rs ${dayCount > 0 ? Math.round(summary.totalRevenue / dayCount).toLocaleString() : 0}`,
                totalCheckIns: 0,
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
    const { period = 'monthly', year = new Date().getFullYear(), category = 'all' } = req.query;

    const yearNum = parseInt(year);
    let startDate, endDate, groupByFormat, daysInPeriodCalc;

    switch (period) {
      case 'monthly':
        startDate = new Date(yearNum, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        groupByFormat = { year: { $year: "$checkInAt" }, month: { $month: "$checkInAt" } };
        daysInPeriodCalc = (p) => new Date(p.year, p.month, 0).getDate();
        break;
      case 'yearly':
        startDate = new Date(yearNum - 4, 0, 1);
        endDate = new Date(yearNum, 11, 31, 23, 59, 59);
        groupByFormat = { year: { $year: "$checkInAt" } };
        daysInPeriodCalc = (p) => (p.year % 4 === 0 && (p.year % 100 !== 0 || p.year % 400 === 0)) ? 366 : 365;
        break;
      default:
        return res.status(400).json({ success: false, error: "Invalid period. Use: monthly, or yearly" });
    }

    // --- Step 1: Get Total Available Rooms ---
    const roomQuery = category !== 'all' ? { category: category } : {};
    const totalRooms = await Room.countDocuments(roomQuery);
    if (totalRooms === 0) {
      return res.status(200).json({ success: true, message: "No rooms found for criteria", data: [] });
    }

    // --- Step 2: Get Operational Occupancy Data from Guest Model ---
    const occupancyPipeline = [
      { $match: { checkInAt: { $gte: startDate, $lte: endDate }, ...(category !== 'all' && { room: { $in: (await Room.find(roomQuery).select('_id')).map(r => r._id) } }) } },
      { $group: {
          _id: groupByFormat,
          occupiedRoomDays: { $sum: "$stayDuration" },
          totalGuests: { $sum: 1 },
          uniqueRoomsOccupied: { $addToSet: "$room" }
      }},
      { $addFields: { uniqueRoomsOccupiedCount: { $size: "$uniqueRoomsOccupied" } } },
      { $sort: { "_id": 1 } }
    ];

    // --- Step 3: Get Accurate Financial Data from Invoice Model ---
    const revenuePipeline = [
      ...createBasePipeline(startDate, endDate, category),
      { $group: {
        // Must group by the same format as occupancy pipeline, but using checkOutDate
        _id: { year: { $year: "$guestInfo.checkOutDate" }, month: { $month: "$guestInfo.checkOutDate" } }, // Assuming monthly for this example
        totalRevenue: { $sum: '$grandTotal' }
      }}
    ];

    // --- Step 4: Execute both queries in parallel ---
    const [occupancyData, revenueData] = await Promise.all([
      Guest.aggregate(occupancyPipeline),
      Invoice.aggregate(revenuePipeline)
    ]);

    // --- Step 5: Merge the two datasets ---
    const revenueMap = new Map();
    revenueData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      revenueMap.set(key, item.totalRevenue);
    });

    const formattedData = occupancyData.map(item => {
      let periodLabel;
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      
      let key, daysInPeriod;
      if(period === 'monthly'){
        periodLabel = `${monthNames[item._id.month - 1]} ${item._id.year}`;
        key = `${item._id.year}-${item._id.month}`;
        daysInPeriod = daysInPeriodCalc(item._id);
      } else { // yearly
        periodLabel = `${item._id.year}`;
        key = `${item._id.year}`;
        daysInPeriod = daysInPeriodCalc(item._id);
      }
      
      const accurateTotalRevenue = revenueMap.get(key) || 0;
      const totalRoomDays = totalRooms * daysInPeriod;
      const occupancyRate = totalRoomDays > 0 ? (item.occupiedRoomDays / totalRoomDays) * 100 : 0;
      const revPAR = totalRooms > 0 ? accurateTotalRevenue / totalRooms : 0;

      return {
        period: periodLabel,
        occupancyRate: Math.round(occupancyRate * 100) / 100,
        occupancyRateFormatted: `${(Math.round(occupancyRate * 100) / 100).toFixed(2)}%`,
        occupiedRoomDays: item.occupiedRoomDays,
        totalRoomDays: totalRoomDays,
        uniqueRoomsOccupied: item.uniqueRoomsOccupiedCount,
        totalRooms: totalRooms,
        totalGuests: item.totalGuests,
        totalRevenue: accurateTotalRevenue,
        totalRevenueFormatted: `Rs ${accurateTotalRevenue.toLocaleString()}`,
        revPAR: Math.round(revPAR),
        revPARFormatted: `Rs ${Math.round(revPAR).toLocaleString()}`
      };
    });

    // --- Step 6: Calculate final summary ---
    const summary = formattedData.reduce((acc, curr) => ({
        totalRevenue: acc.totalRevenue + curr.totalRevenue,
        totalGuests: acc.totalGuests + curr.totalGuests,
        totalOccupiedRoomDays: acc.totalOccupiedRoomDays + curr.occupiedRoomDays,
        totalPossibleRoomDays: acc.totalPossibleRoomDays + curr.totalRoomDays,
    }), { totalRevenue: 0, totalGuests: 0, totalOccupiedRoomDays: 0, totalPossibleRoomDays: 0 });

    const averageOccupancyRate = summary.totalPossibleRoomDays > 0 ? (summary.totalOccupiedRoomDays / summary.totalPossibleRoomDays) * 100 : 0;
    const averageRevPAR = totalRooms > 0 ? summary.totalRevenue / totalRooms : 0;

    res.status(200).json({
      success: true,
      period, year: yearNum, category,
      summary: {
        averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
        averageOccupancyRateFormatted: `${(Math.round(averageOccupancyRate * 100) / 100).toFixed(2)}%`,
        totalRooms,
        totalRevenue: summary.totalRevenue,
        totalRevenueFormatted: `Rs ${summary.totalRevenue.toLocaleString()}`,
        totalGuests: summary.totalGuests,
        averageRevPAR: Math.round(averageRevPAR),
        averageRevPARFormatted: `Rs ${Math.round(averageRevPAR).toLocaleString()}`
      },
      data: formattedData
    });
  } catch (error) {
    console.error("getOccupancyAnalytics Error:", error);
    res.status(500).json({ success: false, error: "Server Error" });
  }
};

exports.getRevenueByPaymentMethods = async (req, res, next) => {
    try {
        const { startDate: reqStartDate, endDate: reqEndDate, category = 'all' } = req.query;
        const startDate = reqStartDate ? new Date(reqStartDate) : new Date(new Date().getFullYear(), 0, 1);
        const endDate = reqEndDate ? new Date(reqEndDate) : new Date();

        const basePipeline = createBasePipeline(startDate, endDate, category);

        const paymentMethodData = await Invoice.aggregate([
            ...basePipeline,
            {
              $group: {
                _id: '$guestInfo.paymentMethod',
                totalRevenue: { $sum: '$grandTotal' },
                guestCount: { $sum: 1 },
                averageAmount: { $avg: '$grandTotal' },
                minAmount: { $min: '$grandTotal' },
                maxAmount: { $max: '$grandTotal' }
              }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        const totalRevenueAllMethods = paymentMethodData.reduce((sum, method) => sum + method.totalRevenue, 0);
        const totalGuestsAllMethods = paymentMethodData.reduce((sum, method) => sum + method.guestCount, 0);

        const formattedBreakdown = paymentMethodData.map(method => {
            const percentage = totalRevenueAllMethods > 0 ? (method.totalRevenue / totalRevenueAllMethods) * 100 : 0;
            return {
                paymentMethod: method._id,
                totalRevenue: method.totalRevenue,
                totalRevenueFormatted: `Rs ${method.totalRevenue.toLocaleString()}`,
                percentage: Math.round(percentage * 100) / 100,
                percentageFormatted: `${(Math.round(percentage * 100) / 100).toFixed(2)}%`,
                guestCount: method.guestCount,
                averageAmount: Math.round(method.averageAmount),
                averageAmountFormatted: `Rs ${Math.round(method.averageAmount).toLocaleString()}`,
                minAmount: method.minAmount,
                maxAmount: method.maxAmount
            };
        });
        
        // --- Get Monthly Trends ---
        const trendData = await Invoice.aggregate([
            ...basePipeline,
            { $group: {
                _id: {
                    year: { $year: "$guestInfo.checkOutDate" },
                    month: { $month: "$guestInfo.checkOutDate" },
                    paymentMethod: "$guestInfo.paymentMethod"
                },
                monthlyRevenue: { $sum: "$grandTotal" },
                monthlyCount: { $sum: 1 }
            }},
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

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
                from: startDate.toISOString().split('T')[0],
                to: endDate.toISOString().split('T')[0]
            },
            category: category,
            summary: {
                totalRevenue: totalRevenueAllMethods,
                totalRevenueFormatted: `Rs ${totalRevenueAllMethods.toLocaleString()}`,
                totalGuests: totalGuestsAllMethods,
                averageTransactionAmount: totalGuestsAllMethods > 0 ? Math.round(totalRevenueAllMethods / totalGuestsAllMethods) : 0,
                averageTransactionAmountFormatted: `Rs ${totalGuestsAllMethods > 0 ? Math.round(totalRevenueAllMethods / totalGuestsAllMethods).toLocaleString() : 0}`,
                paymentMethodsUsed: paymentMethodData.length
            },
            paymentBreakdown: formattedBreakdown,
            monthlyTrends: monthlyTrends
        });
    } catch (error) {
        console.error("getRevenueByPaymentMethods Error:", error);
        res.status(500).json({ success: false, error: "Server Error" });
    }
};

// exports.getRevenueByCategoryAndPeriod = async (req, res, next) => {
//   try {
//     const { category, period = 'monthly', year = new Date().getFullYear() } = req.query;

//     if (!category) {
//       return res.status(400).json({
//         success: false,
//         error: "Please provide a room category",
//       });
//     }

//     // First, get all room IDs for the specified category
//     const roomsInCategory = await Room.find({ category: category }).select('_id');
//     const roomIds = roomsInCategory.map(room => room._id);

//     if (roomIds.length === 0) {
//       return res.status(200).json({
//         success: true,
//         category: category,
//         message: `No rooms found for category: ${category}`,
//         data: []
//       });
//     }

//     // Define date ranges based on period
//     let startDate, endDate, groupByFormat, dateFormat;
    
//     const currentDate = new Date();
//     const yearNum = parseInt(year);

//     switch (period) {
//       case 'daily':
//         // Last 30 days
//         startDate = new Date(currentDate);
//         startDate.setDate(startDate.getDate() - 30);
//         endDate = currentDate;
//         groupByFormat = {
//           year: { $year: "$checkInAt" },
//           month: { $month: "$checkInAt" },
//           day: { $dayOfMonth: "$checkInAt" }
//         };
//         dateFormat = "%Y-%m-%d";
//         break;

//       case 'weekly':
//         // Current year by weeks
//         startDate = new Date(yearNum, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         groupByFormat = {
//           year: { $year: "$checkInAt" },
//           week: { $week: "$checkInAt" }
//         };
//         dateFormat = "Week %V of %Y";
//         break;

//       case 'monthly':
//         // Monthly for specified year
//         startDate = new Date(yearNum, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         groupByFormat = {
//           year: { $year: "$checkInAt" },
//           month: { $month: "$checkInAt" }
//         };
//         dateFormat = "%B %Y";
//         break;

//       case 'yearly':
//         // Last 5 years
//         startDate = new Date(yearNum - 4, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         groupByFormat = {
//           year: { $year: "$checkInAt" }
//         };
//         dateFormat = "%Y";
//         break;

//       default:
//         return res.status(400).json({
//           success: false,
//           error: "Invalid period. Use: daily, weekly, monthly, or yearly"
//         });
//     }

//     // Aggregate revenue data
//     const revenueData = await Guest.aggregate([
//       {
//         // Match guests in the specified rooms and date range
//         $match: {
//           room: { $in: roomIds },
//           checkInAt: { $gte: startDate, $lte: endDate },
//           // Only count guests who have actually paid (you might want to add a 'paid' field)
//           totalRent: { $exists: true, $ne: null }
//         }
//       },
//       {
//         // Group by time period
//         $group: {
//           _id: groupByFormat,
//           totalRevenue: { $sum: "$totalRent" },
//           guestCount: { $sum: 1 },
//           averageRent: { $avg: "$totalRent" },
//           minRent: { $min: "$totalRent" },
//           maxRent: { $max: "$totalRent" }
//         }
//       },
//       {
//         // Sort by date
//         $sort: { "_id": 1 }
//       },
//       {
//         // Format the output
//         $project: {
//           _id: 0,
//           period: "$_id",
//           totalRevenue: 1,
//           guestCount: 1,
//           averageRent: { $round: ["$averageRent", 2] },
//           minRent: 1,
//           maxRent: 1
//         }
//       }
//     ]);

//     // Calculate summary statistics
//     const summary = await Guest.aggregate([
//       {
//         $match: {
//           room: { $in: roomIds },
//           checkInAt: { $gte: startDate, $lte: endDate },
//           totalRent: { $exists: true, $ne: null }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           totalRevenue: { $sum: "$totalRent" },
//           totalGuests: { $sum: 1 },
//           averageRevenue: { $avg: "$totalRent" }
//         }
//       }
//     ]);

//     // Format period labels for better readability
//     const formattedData = revenueData.map(item => {
//       let periodLabel;
//       switch (period) {
//         case 'daily':
//           periodLabel = `${item.period.year}-${String(item.period.month).padStart(2, '0')}-${String(item.period.day).padStart(2, '0')}`;
//           break;
//         case 'weekly':
//           periodLabel = `Week ${item.period.week} of ${item.period.year}`;
//           break;
//         case 'monthly':
//           const monthNames = ["January", "February", "March", "April", "May", "June",
//             "July", "August", "September", "October", "November", "December"];
//           periodLabel = `${monthNames[item.period.month - 1]} ${item.period.year}`;
//           break;
//         case 'yearly':
//           periodLabel = `${item.period.year}`;
//           break;
//       }

//       return {
//         period: periodLabel,
//         totalRevenue: item.totalRevenue,
//         totalRevenueFormatted: `Rs ${item.totalRevenue.toLocaleString()}`,
//         guestCount: item.guestCount,
//         averageRent: item.averageRent,
//         averageRentFormatted: `Rs ${item.averageRent.toLocaleString()}`,
//         minRent: item.minRent,
//         maxRent: item.maxRent
//       };
//     });

//     res.status(200).json({
//       success: true,
//       category: category,
//       period: period,
//       year: yearNum,
//       dateRange: {
//         from: startDate.toISOString().split('T')[0],
//         to: endDate.toISOString().split('T')[0]
//       },
//       summary: {
//         totalRevenue: summary[0]?.totalRevenue || 0,
//         totalRevenueFormatted: `Rs ${(summary[0]?.totalRevenue || 0).toLocaleString()}`,
//         totalGuests: summary[0]?.totalGuests || 0,
//         averageRevenuePerGuest: Math.round(summary[0]?.averageRevenue || 0),
//         averageRevenuePerGuestFormatted: `Rs ${Math.round(summary[0]?.averageRevenue || 0).toLocaleString()}`
//       },
//       data: formattedData
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };

// exports.compareRevenueByCategories = async (req, res, next) => {
//   try {
//     const { period = 'monthly', year = new Date().getFullYear() } = req.query;
    
//     // Get all room categories
//     const categories = Room.schema.path('category').enumValues;
    
//     const yearNum = parseInt(year);
//     let startDate, endDate;
    
//     // Set date range based on period
//     switch (period) {
//       case 'monthly':
//         startDate = new Date(yearNum, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         break;
//       case 'yearly':
//         startDate = new Date(yearNum - 4, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         break;
//       default:
//         startDate = new Date(yearNum, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//     }

//     // Get revenue for each category
//     const categoryRevenues = await Promise.all(
//       categories.map(async (category) => {
//         // Get rooms for this category
//         const roomsInCategory = await Room.find({ category }).select('_id');
//         const roomIds = roomsInCategory.map(room => room._id);
        
//         if (roomIds.length === 0) {
//           return {
//             category,
//             totalRevenue: 0,
//             guestCount: 0,
//             roomCount: 0
//           };
//         }

//         // Get revenue data
//         const revenueData = await Guest.aggregate([
//           {
//             $match: {
//               room: { $in: roomIds },
//               checkInAt: { $gte: startDate, $lte: endDate },
//               totalRent: { $exists: true, $ne: null }
//             }
//           },
//           {
//             $group: {
//               _id: null,
//               totalRevenue: { $sum: "$totalRent" },
//               guestCount: { $sum: 1 },
//               averageRent: { $avg: "$totalRent" }
//             }
//           }
//         ]);

//         return {
//           category,
//           totalRevenue: revenueData[0]?.totalRevenue || 0,
//           totalRevenueFormatted: `Rs ${(revenueData[0]?.totalRevenue || 0).toLocaleString()}`,
//           guestCount: revenueData[0]?.guestCount || 0,
//           averageRent: Math.round(revenueData[0]?.averageRent || 0),
//           roomCount: roomIds.length
//         };
//       })
//     );

//     // Calculate totals
//     const totals = categoryRevenues.reduce((acc, curr) => ({
//       totalRevenue: acc.totalRevenue + curr.totalRevenue,
//       totalGuests: acc.totalGuests + curr.guestCount,
//       totalRooms: acc.totalRooms + curr.roomCount
//     }), { totalRevenue: 0, totalGuests: 0, totalRooms: 0 });

//     // Sort by revenue (highest first)
//     categoryRevenues.sort((a, b) => b.totalRevenue - a.totalRevenue);

//     res.status(200).json({
//       success: true,
//       period: period,
//       year: yearNum,
//       dateRange: {
//         from: startDate.toISOString().split('T')[0],
//         to: endDate.toISOString().split('T')[0]
//       },
//       summary: {
//         totalRevenue: totals.totalRevenue,
//         totalRevenueFormatted: `Rs ${totals.totalRevenue.toLocaleString()}`,
//         totalGuests: totals.totalGuests,
//         totalRooms: totals.totalRooms
//       },
//       data: categoryRevenues
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };


// exports.getDailyRevenueSummary = async (req, res, next) => {
//   try {
//     const { 
//       startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default: 30 days ago
//       endDate = new Date().toISOString().split('T')[0] // Default: today
//     } = req.query;

//     const start = new Date(startDate);
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999); // End of day

//     if (start > end) {
//       return res.status(400).json({
//         success: false,
//         error: "Start date cannot be after end date"
//       });
//     }

//     // Get daily revenue breakdown
//     const dailyRevenue = await Guest.aggregate([
//       {
//         $match: {
//           checkInAt: { $gte: start, $lte: end },
//           totalRent: { $exists: true, $ne: null }
//         }
//       },
//       {
//         $group: {
//           _id: {
//             year: { $year: "$checkInAt" },
//             month: { $month: "$checkInAt" },
//             day: { $dayOfMonth: "$checkInAt" }
//           },
//           totalRevenue: { $sum: "$totalRent" },
//           guestCount: { $sum: 1 },
//           averageRevenue: { $avg: "$totalRent" },
//           checkIns: { $sum: { $cond: [{ $eq: ["$status", "checked-in"] }, 1, 0] } },
//           checkOuts: { $sum: { $cond: [{ $eq: ["$status", "checked-out"] }, 1, 0] } }
//         }
//       },
//       {
//         $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
//       },
//       {
//         $project: {
//           _id: 0,
//           date: {
//             $dateFromParts: {
//               year: "$_id.year",
//               month: "$_id.month",
//               day: "$_id.day"
//             }
//           },
//           totalRevenue: 1,
//           guestCount: 1,
//           averageRevenue: { $round: ["$averageRevenue", 2] },
//           checkIns: 1,
//           checkOuts: 1
//         }
//       }
//     ]);

//     // Format the data
//     const formattedData = dailyRevenue.map(day => ({
//       date: day.date.toISOString().split('T')[0],
//       totalRevenue: day.totalRevenue,
//       totalRevenueFormatted: `Rs ${day.totalRevenue.toLocaleString()}`,
//       guestCount: day.guestCount,
//       averageRevenue: day.averageRevenue,
//       averageRevenueFormatted: `Rs ${day.averageRevenue.toLocaleString()}`,
//       checkIns: day.checkIns,
//       checkOuts: day.checkOuts
//     }));

//     // Calculate summary statistics
//     const summary = dailyRevenue.reduce((acc, day) => ({
//       totalRevenue: acc.totalRevenue + day.totalRevenue,
//       totalGuests: acc.totalGuests + day.guestCount,
//       totalCheckIns: acc.totalCheckIns + day.checkIns,
//       totalCheckOuts: acc.totalCheckOuts + day.checkOuts
//     }), { totalRevenue: 0, totalGuests: 0, totalCheckIns: 0, totalCheckOuts: 0 });

//     const dayCount = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

//     res.status(200).json({
//       success: true,
//       dateRange: {
//         from: startDate,
//         to: endDate,
//         days: dayCount
//       },
//       summary: {
//         totalRevenue: summary.totalRevenue,
//         totalRevenueFormatted: `Rs ${summary.totalRevenue.toLocaleString()}`,
//         totalGuests: summary.totalGuests,
//         averageDailyRevenue: Math.round(summary.totalRevenue / dayCount),
//         averageDailyRevenueFormatted: `Rs ${Math.round(summary.totalRevenue / dayCount).toLocaleString()}`,
//         totalCheckIns: summary.totalCheckIns,
//         totalCheckOuts: summary.totalCheckOuts
//       },
//       data: formattedData
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };

// exports.getOccupancyAnalytics = async (req, res, next) => {
//   try {
//     const { 
//       period = 'monthly', 
//       year = new Date().getFullYear(),
//       category = 'all'
//     } = req.query;

//     const yearNum = parseInt(year);
//     let startDate, endDate, groupByFormat;

//     // Set date range based on period
//     switch (period) {
//       case 'daily':
//         startDate = new Date(yearNum, new Date().getMonth(), 1);
//         endDate = new Date(yearNum, new Date().getMonth() + 1, 0);
//         groupByFormat = {
//           year: { $year: "$checkInAt" },
//           month: { $month: "$checkInAt" },
//           day: { $dayOfMonth: "$checkInAt" }
//         };
//         break;
//       case 'monthly':
//         startDate = new Date(yearNum, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         groupByFormat = {
//           year: { $year: "$checkInAt" },
//           month: { $month: "$checkInAt" }
//         };
//         break;
//       case 'yearly':
//         startDate = new Date(yearNum - 4, 0, 1);
//         endDate = new Date(yearNum, 11, 31);
//         groupByFormat = {
//           year: { $year: "$checkInAt" }
//         };
//         break;
//       default:
//         return res.status(400).json({
//           success: false,
//           error: "Invalid period. Use: daily, monthly, or yearly"
//         });
//     }

//     // Get total rooms (filtered by category if specified)
//     let roomQuery = {};
//     if (category !== 'all') {
//       roomQuery = { category: category };
//     }
    
//     const totalRooms = await Room.countDocuments(roomQuery);
//     const roomsInCategory = category !== 'all' ? 
//       await Room.find(roomQuery).select('_id') : 
//       await Room.find({}).select('_id');
    
//     const roomIds = roomsInCategory.map(room => room._id);

//     if (totalRooms === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No rooms found for the specified criteria",
//         data: []
//       });
//     }

//     // Get occupancy data
//     const occupancyData = await Guest.aggregate([
//       {
//         $match: {
//           checkInAt: { $gte: startDate, $lte: endDate },
//           ...(category !== 'all' && { room: { $in: roomIds } })
//         }
//       },
//       {
//         $group: {
//           _id: groupByFormat,
//           occupiedRoomDays: { $sum: "$stayDuration" },
//           totalGuests: { $sum: 1 },
//           totalRevenue: { $sum: "$totalRent" },
//           uniqueRooms: { $addToSet: "$room" }
//         }
//       },
//       {
//         $addFields: {
//           occupiedRooms: { $size: "$uniqueRooms" }
//         }
//       },
//       {
//         $sort: { "_id": 1 }
//       }
//     ]);

//     // Calculate occupancy rates and RevPAR
//     const formattedData = occupancyData.map(item => {
//       let periodLabel;
//       let daysInPeriod;

//       switch (period) {
//         case 'daily':
//           periodLabel = `${item._id.year}-${String(item._id.month).padStart(2, '0')}-${String(item._id.day).padStart(2, '0')}`;
//           daysInPeriod = 1;
//           break;
//         case 'monthly':
//           const monthNames = ["January", "February", "March", "April", "May", "June",
//             "July", "August", "September", "October", "November", "December"];
//           periodLabel = `${monthNames[item._id.month - 1]} ${item._id.year}`;
//           daysInPeriod = new Date(item._id.year, item._id.month, 0).getDate();
//           break;
//         case 'yearly':
//           periodLabel = `${item._id.year}`;
//           daysInPeriod = (item._id.year % 4 === 0) ? 366 : 365;
//           break;
//       }

//       const totalRoomDays = totalRooms * daysInPeriod;
//       const occupancyRate = (item.occupiedRoomDays / totalRoomDays) * 100;
//       const revPAR = item.totalRevenue / totalRooms; // Revenue per Available Room

//       return {
//         period: periodLabel,
//         occupancyRate: Math.round(occupancyRate * 100) / 100,
//         occupancyRateFormatted: `${Math.round(occupancyRate * 100) / 100}%`,
//         occupiedRoomDays: item.occupiedRoomDays,
//         totalRoomDays: totalRoomDays,
//         uniqueRoomsOccupied: item.occupiedRooms,
//         totalRooms: totalRooms,
//         totalGuests: item.totalGuests,
//         totalRevenue: item.totalRevenue,
//         totalRevenueFormatted: `Rs ${item.totalRevenue.toLocaleString()}`,
//         revPAR: Math.round(revPAR),
//         revPARFormatted: `Rs ${Math.round(revPAR).toLocaleString()}`
//       };
//     });

//     // Calculate overall summary
//     const overallSummary = occupancyData.reduce((acc, curr) => ({
//       totalOccupiedRoomDays: acc.totalOccupiedRoomDays + curr.occupiedRoomDays,
//       totalRevenue: acc.totalRevenue + curr.totalRevenue,
//       totalGuests: acc.totalGuests + curr.totalGuests
//     }), { totalOccupiedRoomDays: 0, totalRevenue: 0, totalGuests: 0 });

//     const periodCount = occupancyData.length;
//     const totalPossibleRoomDays = totalRooms * (period === 'daily' ? periodCount : 
//       period === 'monthly' ? periodCount * 30 : periodCount * 365);
    
//     const averageOccupancyRate = periodCount > 0 ? 
//       (overallSummary.totalOccupiedRoomDays / totalPossibleRoomDays) * 100 : 0;

//     res.status(200).json({
//       success: true,
//       period: period,
//       year: yearNum,
//       category: category,
//       summary: {
//         averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
//         averageOccupancyRateFormatted: `${Math.round(averageOccupancyRate * 100) / 100}%`,
//         totalRooms: totalRooms,
//         totalRevenue: overallSummary.totalRevenue,
//         totalRevenueFormatted: `Rs ${overallSummary.totalRevenue.toLocaleString()}`,
//         totalGuests: overallSummary.totalGuests,
//         averageRevPAR: Math.round(overallSummary.totalRevenue / totalRooms),
//         averageRevPARFormatted: `Rs ${Math.round(overallSummary.totalRevenue / totalRooms).toLocaleString()}`
//       },
//       data: formattedData
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };


// exports.getRevenueByPaymentMethods = async (req, res, next) => {
//   try {
//     const { 
//       startDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
//       endDate = new Date().toISOString().split('T')[0],
//       category = 'all'
//     } = req.query;

//     const start = new Date(startDate);
//     const end = new Date(endDate);
//     end.setHours(23, 59, 59, 999);

//     if (start > end) {
//       return res.status(400).json({
//         success: false,
//         error: "Start date cannot be after end date"
//       });
//     }

//     // Build match query
//     let matchQuery = {
//       checkInAt: { $gte: start, $lte: end },
//       totalRent: { $exists: true, $ne: null }
//     };

//     // If category is specified, get room IDs for that category
//     if (category !== 'all') {
//       const roomsInCategory = await Room.find({ category: category }).select('_id');
//       const roomIds = roomsInCategory.map(room => room._id);
      
//       if (roomIds.length === 0) {
//         return res.status(200).json({
//           success: true,
//           category: category,
//           message: `No rooms found for category: ${category}`,
//           data: []
//         });
//       }
      
//       matchQuery.room = { $in: roomIds };
//     }

//     // Get payment method breakdown
//     const paymentMethodData = await Guest.aggregate([
//       {
//         $match: matchQuery
//       },
//       {
//         $group: {
//           _id: "$paymentMethod",
//           totalRevenue: { $sum: "$totalRent" },
//           guestCount: { $sum: 1 },
//           averageAmount: { $avg: "$totalRent" },
//           minAmount: { $min: "$totalRent" },
//           maxAmount: { $max: "$totalRent" }
//         }
//       },
//       {
//         $sort: { totalRevenue: -1 }
//       }
//     ]);

//     // Calculate total revenue for percentages
//     const totalRevenue = paymentMethodData.reduce((sum, method) => sum + method.totalRevenue, 0);
//     const totalGuests = paymentMethodData.reduce((sum, method) => sum + method.guestCount, 0);

//     // Format the data
//     const formattedData = paymentMethodData.map(method => {
//       const percentage = totalRevenue > 0 ? (method.totalRevenue / totalRevenue) * 100 : 0;
      
//       return {
//         paymentMethod: method._id,
//         totalRevenue: method.totalRevenue,
//         totalRevenueFormatted: `Rs ${method.totalRevenue.toLocaleString()}`,
//         percentage: Math.round(percentage * 100) / 100,
//         percentageFormatted: `${Math.round(percentage * 100) / 100}%`,
//         guestCount: method.guestCount,
//         averageAmount: Math.round(method.averageAmount),
//         averageAmountFormatted: `Rs ${Math.round(method.averageAmount).toLocaleString()}`,
//         minAmount: method.minAmount,
//         maxAmount: method.maxAmount
//       };
//     });

//     // Get trend data (month-wise breakdown)
//     const trendData = await Guest.aggregate([
//       {
//         $match: matchQuery
//       },
//       {
//         $group: {
//           _id: {
//             year: { $year: "$checkInAt" },
//             month: { $month: "$checkInAt" },
//             paymentMethod: "$paymentMethod"
//           },
//           monthlyRevenue: { $sum: "$totalRent" },
//           monthlyCount: { $sum: 1 }
//         }
//       },
//       {
//         $sort: { "_id.year": 1, "_id.month": 1 }
//       }
//     ]);

//     // Format trend data
//     const monthlyTrends = {};
//     trendData.forEach(item => {
//       const monthKey = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
//       if (!monthlyTrends[monthKey]) {
//         monthlyTrends[monthKey] = {};
//       }
//       monthlyTrends[monthKey][item._id.paymentMethod] = {
//         revenue: item.monthlyRevenue,
//         count: item.monthlyCount
//       };
//     });

//     res.status(200).json({
//       success: true,
//       dateRange: {
//         from: startDate,
//         to: endDate
//       },
//       category: category,
//       summary: {
//         totalRevenue: totalRevenue,
//         totalRevenueFormatted: `Rs ${totalRevenue.toLocaleString()}`,
//         totalGuests: totalGuests,
//         averageTransactionAmount: Math.round(totalRevenue / totalGuests),
//         averageTransactionAmountFormatted: `Rs ${Math.round(totalRevenue / totalGuests).toLocaleString()}`,
//         paymentMethodsUsed: paymentMethodData.length
//       },
//       paymentBreakdown: formattedData,
//       monthlyTrends: monthlyTrends
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ success: false, error: "Server Error" });
//   }
// };

