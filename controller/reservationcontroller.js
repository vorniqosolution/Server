const Reservation = require("../model/reservationmodel");
const Room = require("../model/room");
const Guest = require("../model/guest");
exports.createReservation = async (req, res) => {
  try {
    const {
      fullName,
      address,
      phone,
      email,
      cnic,
      roomNumber,
      checkin,
      checkout,
    } = req.body;
    if (
      (!fullName,
      !address,
      !phone,
      !email,
      !cnic,
      !roomNumber,
      !checkin,
      !checkout)
    ) {
      return res
        .status(400)
        .json({ message: "Please enter complete credentials" });
    }
    const room = await Room.findOne({ roomNumber });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    }
    if (room.status === "occupied") {
      return res
        .status(400)
        .json({ success: false, message: "Room is currently occupied." });
    }

    if (room.status === "reserved") {
      return res
        .status(400)
        .json({ success: false, message: "Room is already reserved." });
    }

    if (room.status === "maintenance") {
      return res
        .status(400)
        .json({ success: false, message: "Room is under maintenance." });
    }

    const startAt = new Date(checkin);
    const endAt = new Date(checkout);
    console.log("startAt", startAt);
    console.log("endAt", endAt);
    // 2. Validate dates
    if (endAt <= startAt) {
      return res
        .status(400)
        .json({ success: false, message: "Checkout must be after checkin" });
    }

    // 3. Check for overlapping reservations for this room
    const existingReservation = await Reservation.findOne({
      room: room._id,
      status: { $in: ["reserved", "checked-in"] },
      $or: [
        { startAt: { $lt: endAt }, endAt: { $gt: startAt } }, // overlap condition
      ],
    });

    if (existingReservation) {
      return res.status(400).json({
        success: false,
        message: `Room ${roomNumber} is already reserved or occupied during this period.`,
      });
    }

    // 4. Create reservation
    const reservation = await Reservation.create({
      fullName,
      address,
      phone,
      email,
      cnic,
      room: room._id,
      startAt,
      endAt,
      createdBy: req.user.userId,
    });

    // 5. Update room status
    room.status = "reserved";
    await room.save();

    return res.status(201).json({ success: true, data: reservation });
  } catch (err) {
    console.error("createReservation Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const list = await Reservation.find()
      .populate("room", "roomNumber category rate status")
      .populate("createdBy", "name email")
      .sort({ startAt: -1 });

    if (list.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Currently no reservations found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      count: list.length,
      data: list,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};

exports.getReservationById = async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id)
      .populate("room", "roomNumber category rate status")
      .populate("createdBy", "name email");
    if (!r)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: r });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.cancelReservation = async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id);
    if (!r)
      return res
        .status(404)
        .json({ success: false, message: "Room Not found" });

    if (r.status === "cancelled") {
      return res
        .status(400)
        .json({ success: false, message: "Already room cancel" });
    }
    if (r.status !== "reserved") {
      return res
        .status(400)
        .json({ success: false, message: "Cannot cancel after check-in" });
    }

    r.status = "cancelled";
    await r.save();

    // Free the room
    const room = await Room.findById(r.room);
    if (room) {
      room.status = "available";
      await room.save();
    }

    res.json({ success: true, message: "Reservation cancelled" });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.GetAllReservedRoomWithDate = async (req, res) => {
  try {
    const { day, month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }
    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    const parsedDay = day ? Number(day) : null;
    const pipeline = [
      {
        $match: {
          status: "reserved",
        },
      },
      {
        $addFields: {
          bookingMonth: { $month: "$startAt" },
          bookingYear: { $year: "$startAt" },
          bookingDay: { $dayOfMonth: "$startAt" },
        },
      },
      {
        $match: {
          bookingMonth: parsedMonth,
          bookingYear: parsedYear,
          ...(parsedDay && { bookingDay: parsedDay }),
        },
      },
      {
        $lookup: {
          from: "rooms", // collection name in MongoDB
          localField: "room",
          foreignField: "_id",
          as: "roomData",
        },
      },
      { $unwind: "$roomData" },
      {
        $addFields: {
          daysBooked: {
            $dateDiff: {
              startDate: "$startAt",
              endDate: "$endAt",
              unit: "day",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          roomNumber: "$roomData.roomNumber",
          roomStatus: "$roomData.status",
          daysBooked: 1,
        },
      },
    ];

    const result = await Reservation.aggregate(pipeline);
    console.log("Result", result);
    if (result.length === 0) {
      return res.json({ message: "No reservation" });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

exports.GetAllOccupiedRoomsWithDate = async (req, res) => {
  try {
    const { day, month, year } = req.query;
    if (!month || !year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }
    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    const parsedDay = day ? Number(day) : null;

    const pipeline = [
      {
        $match: {
          status: "occupied",
        },
      },
      {
        // Agar checkOutAt nahi hai to stayDuration ka use karke calculate karo
        $addFields: {
          expectedCheckOutAt: {
            $cond: [
              { $ifNull: ["$checkOutAt", false] },
              "$checkOutAt",
              {
                $add: [
                  "$checkInAt",
                  { $multiply: ["$stayDuration", 24 * 60 * 60 * 1000] },
                ],
              },
            ],
          },
        },
      },
      {
        // Month/Year/Day extract for filtering
        $addFields: {
          bookingMonth: { $month: "$checkInAt" },
          bookingYear: { $year: "$checkInAt" },
          bookingDay: { $dayOfMonth: "$checkInAt" },
        },
      },
      {
        $match: {
          bookingMonth: parsedMonth,
          bookingYear: parsedYear,
          ...(parsedDay && { bookingDay: parsedDay }),
        },
      },
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
        $addFields: {
          daysStayed: {
            $dateDiff: {
              startDate: "$checkInAt",
              endDate: "$expectedCheckOutAt",
              unit: "day",
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          fullName: 1,
          roomNumber: "$roomData.roomNumber",
          roomStatus: "$roomData.status",
          checkInAt: 1,
          expectedCheckOutAt: 1,
          daysStayed: 1,
        },
      },
    ];

    const result = await Guest.aggregate(pipeline);

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("Error fetching occupied rooms:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
