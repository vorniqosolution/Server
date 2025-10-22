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
      !fullName ||
      !address ||
      !phone ||
      !cnic ||
      !roomNumber ||
      !checkin ||
      !checkout
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Please provide all required fields.",
        });
    }

    const room = await Room.findOne({ roomNumber });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    if (room.status === "maintenance")
      return res
        .status(400)
        .json({ success: false, message: "Room is under maintenance." });

    // Use the reliable, native JavaScript UTC date parsing
    const startAt = new Date(`${checkin}T00:00:00.000Z`);
    const endAt = new Date(`${checkout}T00:00:00.000Z`);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid date format. Please use YYYY-MM-DD.",
        });
    }

    if (endAt <= startAt)
      return res
        .status(400)
        .json({
          success: false,
          message: "Checkout date must be after check-in date",
        });

    // The rest of the logic is already robust
    const existingReservation = await Reservation.findOne({
      room: room._id,
      status: { $in: ["reserved", "confirmed"] },
      startAt: { $lt: endAt },
      endAt: { $gt: startAt },
    });
    if (existingReservation)
      return res
        .status(400)
        .json({
          success: false,
          message: `Room ${roomNumber} already has a reservation during this period.`,
        });

    const overlappingGuest = await Guest.findOne({
      room: room._id,
      status: "checked-in",
      checkInAt: { $lt: endAt },
      checkOutAt: { $gt: startAt },
    });
    if (overlappingGuest)
      return res
        .status(400)
        .json({
          success: false,
          message: `Room ${roomNumber} is occupied by a guest during this period.`,
        });

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

    return res.status(201).json({ success: true, data: reservation });
  } catch (err) {
    console.error("createReservation Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const list = await Reservation.find()
      .populate("room", "roomNumber category rate status")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 }, { startAt: 1 });

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

exports.deleteReservation = async (req, res) => {
  try {
    const reservationId = req.params.id;

    // 1. Find the reservation to check its status
    const reservationToDelete = await Reservation.findById(reservationId);
    if (!reservationToDelete) {
      return res
        .status(404)
        .json({ success: false, message: "Reservation not found" });
    }

    // 2. Prevent deletion of reservations that have been checked-in
    // Deletion should only be allowed for 'reserved' or 'cancelled' statuses.
    if (
      reservationToDelete.status === "checked-in" ||
      reservationToDelete.status === "checked-out"
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: `Cannot delete a reservation that is currently '${reservationToDelete.status}'. Please cancel it first if it is 'reserved'.`,
        });
    }

    // 3. If the reservation was 'reserved' and is now being deleted, 
    // we should make sure the associated room is set back to 'available'.
    if (reservationToDelete.status === "reserved") {
      const room = await Room.findById(reservationToDelete.room);
      if (room && room.status !== "maintenance") {
        room.status = "available";
        await room.save();
      }
    }

    // 4. Perform the deletion
    const result = await Reservation.findByIdAndDelete(reservationId);
    
    // This check is slightly redundant since we already checked in step 1, 
    // but is good practice to ensure the operation was successful.
    if (!result) {
        return res
            .status(404)
            .json({ success: false, message: "Reservation not found after check" });
    }

    // 5. Success response
    return res.status(200).json({
      success: true,
      message: "Reservation permanently deleted.",
      deletedId: reservationId,
    });
  } catch (err) {
    console.error("deleteReservation Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getReservationsCreatedOnDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: "Date is required. Format: YYYY-MM-DD" 
      });
    }

    // --- Robust Date Validation ---
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please use YYYY-MM-DD",
      });
    }
    const [_, y, mo, d] = m.map(Number);
    const dayStart = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999));

    if (dayStart.getUTCFullYear() !== y || dayStart.getUTCMonth() + 1 !== mo || dayStart.getUTCDate() !== d) {
      return res.status(400).json({ success: false, message: "Invalid calendar date" });
    }
    // --- End Validation ---

    const reservations = await Reservation.find({
      createdAt: { $gte: dayStart, $lte: dayEnd }
    })
    .populate("room", "roomNumber category")
    .populate("createdBy", "name")
    .sort({ createdAt: -1 })
    .lean();

    const formattedReservations = reservations.map(reservation => {
      const checkInDate = new Date(reservation.startAt);
      const checkOutDate = new Date(reservation.endAt);
      const totalDays = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
      
      return {
        _id: reservation._id,
        fullName: reservation.fullName,
        phone: reservation.phone,
        status: reservation.status,
        source: reservation.source,
        roomNumber: reservation.room?.roomNumber,
        checkIn: reservation.startAt,
        checkOut: reservation.endAt,
        totalDays,
        createdBy: reservation.createdBy?.name || "System",
        createdAt: reservation.createdAt,
      };
    });

    // --- MODIFIED SUMMARY BLOCK ---
    // This is a more efficient way to calculate the summary in one pass.
    const byStatusSummary = formattedReservations.reduce((acc, reservation) => {
      const status = reservation.status;
      // If the status key exists, increment it. Otherwise, set it to 1.
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { 
      // Initialize all possible statuses to 0. 
      // This ensures the frontend always gets these keys, even if the count is zero.
      'reserved': 0, 
      'checked-in': 0, 
      'checked-out': 0, 
      'cancelled': 0 
    });

    const summary = {
      totalCreated: formattedReservations.length,
      byStatus: byStatusSummary
    };

    res.status(200).json({
      success: true,
      date: date,
      summary: summary,
      data: formattedReservations
    });

  } catch (err) {
    console.error("Error in getReservationsCreatedOnDate:", err);
    res.status(500).json({ 
      success: false, 
      message: "Server error", 
      error: err.message 
    });
  }
};