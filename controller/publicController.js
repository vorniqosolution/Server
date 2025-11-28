const Room = require("../model/room");
const Reservation = require("../model/reservationmodel");
const Guest = require("../model/guest");
const {
  sendReservationConfirmation,
} = require("../service/reservationEmailService");
const { getJson } = require("serpapi");

exports.getPublicAvailableRooms = async (req, res) => {
  try {
    const { checkin, checkout, adults } = req.query;

    const reqAdults = parseInt(adults, 10) || 1;
    
    if (!checkin || !checkout) {
      return res.status(400).json({ message: "Check-in and checkout dates are required." });
    }

    const startDate = new Date(`${checkin}T00:00:00.000Z`);
    const endDate = new Date(`${checkout}T00:00:00.000Z`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ message: "Check-out must be after check-in." });
    }

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
        ...reservedRooms.map((r) => r.room),
        ...occupiedRooms.map((g) => g.room),
      ]),
    ];

    const groupedAvailableRooms = await Room.aggregate([
      {
        $match: {
          _id: { $nin: unavailableRoomIds },
          isPubliclyVisible: true,
          status: { $ne: "maintenance" },
          adults: { $gte: reqAdults }, 
        },
      },
      {
        $group: {
          _id: {
            category: "$category",
            bedType: "$bedType",
          },
          publicDescription: { $first: "$publicDescription" },
          amenities: { $first: "$amenities" },
          cleanliness: { $first: "$cleanliness" },
          category: { $first: "$category" },
          bedType: { $first: "$bedType" },
          startingRate: { $min: "$rate" },
          minAdults: { $min: "$adults" },
          maxAdults: { $max: "$adults" },
          minInfants: { $min: "$infants" }, 
          maxInfants: { $max: "$infants" },

          imageUrl: { $first: { $arrayElemAt: ["$images.path", 0] } },
          
          availableRooms: {
            $push: {
              _id: "$_id",
              roomNumber: "$roomNumber",
              view: "$view",
              rate: "$rate",
              adults: "$adults",
              infants: "$infants",
              images: "$images",
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
          cleanliness: 1,
          category: 1,
          bedType: 1,
          adultsCapacity: {
            $cond: {
              if: { $eq: ["$minAdults", "$maxAdults"] },
              then: { $toString: "$minAdults" },
              else: { $concat: [{ $toString: "$minAdults" }, "-", { $toString: "$maxAdults" }] },
            },
          },
          // --- CHANGE 3: Expose Infant Capacity ---
          infantsCapacity: {
            $cond: {
              if: { $eq: ["$minInfants", "$maxInfants"] },
              then: { $toString: "$minInfants" }, // e.g., "0"
              else: { $concat: [{ $toString: "$minInfants" }, "-", { $toString: "$maxInfants" }] }, // e.g., "0-1"
            },
          },
          imageUrl: 1,
          availableRooms: 1,
          availableCount: { $size: "$availableRooms" },
        },
      },
      { $sort: { startingRate: 1 } },
    ]);

    res.status(200).json(groupedAvailableRooms);
  } catch (err) {
    console.error("Error checking availability:", err);
    res.status(500).json({ message: "Server error while checking availability." });
  }
};

exports.getPublicCategoryDetails = async (req, res) => {
  try {
    const roomsGroupedByCategory = await Room.aggregate([
      {
        $match: {
          isPubliclyVisible: true,
        },
      },
      {
        $sort: {
          category: 1,
          rate: 1,
        },
      },
      {
        $group: {
          _id: "$category",
          rooms: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          categoryName: "$_id",
          rooms: {
            $map: {
              input: "$rooms",
              as: "room",
              in: {
                id: "$$room._id",
                rate: "$$room.rate",
                images: "$$room.images",
                publicName: "$$room.publicName",
                publicDescription: "$$room.publicDescription",
                adults: "$$room.adults",
                infants: "$$room.infants"
              },
            },
          },
        },
      },
      {
        $sort: {
          categoryName: 1,
        },
      },
    ]);

    res.status(200).json(roomsGroupedByCategory);
  } catch (err) {
    console.error(`Error fetching public rooms by category:`, err);
    res
      .status(500)
      .json({ message: "Server error while fetching room details." });
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
    adults,
    infants
  } = req.body;

  try {
    const startAt = new Date(checkInDate);
    const endAt = new Date(checkOutDate);

    const room = await Room.findById(roomId);

    if (!room) {
      return res
        .status(404)
        .json({ message: "The selected room could not be found." });
    }
    if (!room.isPubliclyVisible) {
      return res
        .status(403)
        .json({ message: "This room is not available for public booking." });
    }
    if (room.status === "maintenance") {
      return res.status(409).json({
        message:
          "This room is currently under maintenance and cannot be booked.",
      });
    }

    // --- STRICT CAPACITY CHECK ---
    const reqAdults = parseInt(adults) || 1;
    const reqInfants = parseInt(infants) || 0;

    if (room.adults < reqAdults) {
        return res.status(409).json({ message: `This room allows a maximum of ${room.adults} adults.` });
    }
    
    const maxInfants = room.infants || 0; 
    if (maxInfants < reqInfants) {
        return res.status(409).json({ message: `This room allows a maximum of ${maxInfants} infants.` });
    }
    // ----------------------------

    const existingReservation = await Reservation.findOne({
      room: room._id,
      status: { $in: ["reserved", "checked-in", "confirmed"] },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    if (existingReservation) {
      return res
        .status(409)
        .json({ message: "This room is already reserved for these dates." });
    }

    const overlappingGuest = await Guest.findOne({
      room: room._id,
      status: "checked-in",
      checkInAt: { $lt: endAt },
      checkOutAt: { $gt: startAt },
    });
    if (overlappingGuest) {
      return res
        .status(409)
        .json({ message: "This room is currently occupied for these dates." });
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
      adults: reqAdults,
      infants: reqInfants,
      expectedArrivalTime,
      status: "reserved",
      source: "Website",
      specialRequest,
      paymentMethod,
      promoCode,
      createdBy: process.env.WEBSITE_SYSTEM_USER_ID,
    });

    const savedReservation = await newReservation.save();

    if (savedReservation) {
      sendReservationConfirmation(savedReservation, room).catch((err) =>
        console.error("BACKGROUND EMAIL ERROR (Guest Confirmation):", err)
      );
    }

    res.status(201).json({
      success: true,
      message: "Your reservation has been successfully submitted!",
      reservationId: newReservation._id,
    });
  } catch (err) {
    console.error("Create Public Reservation Error:", err);
    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid data provided. Please check all fields.",
        details: err.message,
      });
    }
    res.status(500).json({ message: "An unexpected server error occurred." });
  }
};

exports.getGoolgeReview = async (req, res) => {
  try {
    const response = await getJson({
      engine: "google_maps_reviews",
      data_id: `${process.env.SERP_DATA_ID}`,
      sort_by: "ratingHigh",
      api_key: `${process.env.SERP_API}`,
    });
    return res.json(response.reviews);
  } catch (error) {
    return res.status(500).json({ message: "Failed to Fetch Reviews" });
  }
};
