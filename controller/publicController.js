const Room = require("../model/room");
const Reservation = require("../model/reservationmodel");
const Guest = require("../model/guest");

exports.getPublicAvailableRooms = async (req, res) => {
  try {
    const { checkin, checkout } = req.query;
    if (!checkin || !checkout)
      return res
        .status(400)
        .json({ message: "Check-in and checkout dates are required." });
    const startDate = new Date(`${checkin}T00:00:00.000Z`);
    const endDate = new Date(`${checkout}T00:00:00.000Z`);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
      return res
        .status(400)
        .json({ message: "Invalid date format. Use YYYY-MM-DD." });
    if (endDate <= startDate)
      return res
        .status(400)
        .json({ message: "Check-out must be after check-in." });

    const reservedRooms = await Reservation.find({
      status: { $in: ["reserved", "confirmed"] },
      startAt: { $lt: endDate },
      endAt: { $gt: startDate },
    }).select("room");
    const occupiedRooms = await Guest.find({
      status: "checked-in",
      checkInAt: { $lt: endDate },
      checkOutAt: { $gt: startDate },
    }).select("room");
    const unavailableRoomIds = [
      ...new Set([
        ...reservedRooms.map((r) => r.room.toString()),
        ...occupiedRooms.map((g) => g.room.toString()),
      ]),
    ];

    const availableRooms = await Room.find({
      _id: { $nin: unavailableRoomIds },
      status: "available",
      isPubliclyVisible: true,
    })
      .select(
        "publicName roomNumber rate images amenities category bedType view publicDescription adults cleaniness"
      )
      .sort({ rate: 1 });

    res.status(200).json(availableRooms);
  } catch (err) {
    res
      .status(500)
      .json({ message: "Server error while checking availability." });
  }
};

exports.createPublicReservation = async (req, res) => {
    const {
        fullName,
        address,
        phone,
        email,
        cnic,
        specialRequest,
        paymentMethod,
        promoCode,
        roomId,
        checkInDate,
        checkOutDate,
        expectedArrivalTime,
    } = req.body;
    
    try {
        const startAt = new Date(checkInDate);
        const endAt = new Date(checkOutDate);

        const room = await Room.findById(roomId);
        if (!room || room.status !== 'available' || !room.isPubliclyVisible) {
            return res.status(409).json({ message: "Sorry, the selected room is no longer available." });
        }

        const existingReservation = await Reservation.findOne({
            room: room._id, 
            status: { $in: ["reserved", "checked-in", "confirmed"] },
            startAt: { $lt: endAt }, 
            endAt: { $gt: startAt },
        });
        if (existingReservation) {
            return res.status(409).json({ message: "This room is already reserved for these dates." });
        }

        const overlappingGuest = await Guest.findOne({
            room: room._id, 
            status: "checked-in", 
            checkInAt: { $lt: endAt }, 
            checkOutAt: { $gt: startAt },
        });
        if (overlappingGuest) {
            return res.status(409).json({ message: "This room is currently occupied for these dates." });
        }
        
        const newReservation = new Reservation({
            fullName,
            address,
            phone,
            email,
            cnic,
            room: room._id,
            startAt,
            endAt,
            expectedArrivalTime,
            status: 'reserved',
            source: 'Website',
            specialRequest,
            paymentMethod,
            promoCode,
            createdBy: process.env.WEBSITE_SYSTEM_USER_ID,
        });
         console.log('System User ID from .env:', process.env.WEBSITE_SYSTEM_USER_ID);

        await newReservation.save();

        res.status(201).json({
            success: true,
            message: "Your reservation has been successfully submitted!",
            reservationId: newReservation._id,
        });

    } catch (err) {
        console.error("Create Public Reservation Error:", err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: "Invalid data provided. Please check all fields.", details: err.message });
        }
        res.status(500).json({ message: "An unexpected server error occurred." });
    }
};

exports.getPublicCategories = async (req, res) => {
  try {
    const categories = await Room.aggregate([
      {
        $match: {
          isPubliclyVisible: true,
        },
      },
      {
        // The key change is here: group by a composite key.
        $group: {
          _id: {
            category: "$category",
            bedType: "$bedType",
            rate: "$rate",
          },
          imageUrl: { $first: { $arrayElemAt: ["$images.path", 0] } },
        },
      },
      {
        // Reshape the data for the final output.
        $project: {
          _id: 0,
          category: "$_id.category",
          publicName: { $concat: ["$_id.bedType", " - ", "$_id.category"] },
          rate: "$_id.rate",
          imageUrl: 1,
        },
      },
      {
        // Sort first by category, then by the public name for a clean list.
        $sort: {
          category: 1,
          publicName: 1,
          rate: 1,
        },
      },
    ]);
    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching public categories:", err);
    res
      .status(500)
      .json({ message: "Server error while fetching categories." });
  }
};

exports.getPublicRoomsByCategory = async (req, res) => {
  try {
    const { categoryName } = req.params;

    if (!categoryName) {
      return res.status(400).json({ message: "Category name is required." });
    }

    const rooms = await Room.aggregate([
      {
        $match: {
          category: categoryName,
          isPubliclyVisible: true,
          status: "available",
        },
      },
      {
        $sort: {
          roomNumber: 1,
        },
      },
      {
        $project: {
          _id: 1,
          roomNumber: 1,
          bedType: 1,
          category: 1,
          view: 1,
          rate: 1,
          status: 1,
          adults: 1,
          publicDescription: 1,
          amenities: 1,
          images: 1,
          cleaniness: 1,
          publicName: { $concat: ["$bedType", " - ", "$category"] },
        },
      },
    ]);

    res.status(200).json(rooms);
  } catch (err) {
    console.error("Error fetching rooms by category:", err);
    res.status(500).json({ message: "Server error while fetching rooms." });
  }
};

exports.getPublicCategoryDetails = async (req, res) => {
  try {
    const { categoryName } = req.params;

    if (!categoryName) {
      return res.status(400).json({ message: "Category name is required." });
    }
    const categorySubtypesWithRooms = await Room.aggregate([
      {
        $match: {
          category: categoryName,
          isPubliclyVisible: true,
        },
      },
      {
        $group: {
          _id: {
            category: "$category",
            bedType: "$bedType",
          },
          startingRate: { $min: "$rate" },
          amenities: { $first: "$amenities" },
          publicDescription: { $first: "$publicDescription" },
          imageUrl: { $first: { $arrayElemAt: ["$images.path", 0] } },
          minAdults: { $min: "$adults" },
          maxAdults: { $max: "$adults" },
          cleanliness: { $first: "$cleanliness" },
          availableRooms: {
            $push: {
              $cond: [
                { $eq: ["$status", "available"] },
                {
                  _id: "$_id",
                  roomNumber: "$roomNumber",
                  view: "$view",
                  category: "$category",
                  bedType: "$bedType",
                  rate: "$rate",
                  adults: "$adults",
                  amenities: "$amenities"
                },
                "$$REMOVE",
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 0,
          publicName: { $concat: ["$_id.bedType", " - ", "$_id.category"] },
          publicDescription: 1,
          startingRate: 1,
          amenities: 1,
          imageUrl: 1,
          cleanliness: 1,
          adultsCapacity: {
            $cond: {
              if: { $eq: ["$minAdults", "$maxAdults"] },
              then: { $toString: "$minAdults" },
              else: {
                $concat: [
                  { $toString: "$minAdults" },
                  "-",
                  { $toString: "$maxAdults" },
                ],
              },
            },
          },
          availableRooms: 1,
          availableCount: { $size: "$availableRooms" },
        },
      },
      {
        $sort: {
          startingRate: 1,
        },
      },
    ]);

    res.status(200).json(categorySubtypesWithRooms);
  } catch (err) {
    console.error(`Error fetching subtypes for category ${req.params.categoryName}:`, err);
    res.status(500).json({ message: "Server error while fetching category details." });
  }
};
