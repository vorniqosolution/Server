const Reservation = require("../model/reservationmodel");
const Room = require("../model/room");
const Guest = require("../model/guest");
const Transaction = require("../model/transactions");

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
      adults = 1,       
      infants = 0,       
      arrivalTime,   
      specialRequest,
      paymentMethod,
      promoCode,
      advanceAmount,
      advancePaymentMethod
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
      return res.status(400).json({
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
    if (room.adults < adults) {
        return res.status(400).json({ 
            success: false, 
            message: `Capacity exceeded. Room ${roomNumber} allows max ${room.adults} adults.` 
        });
    }
    
    // 2. Check Infants (Safely handle if room.infants is undefined in DB)
    const roomMaxInfants = room.infants || 0; 
    if (roomMaxInfants < infants) {
        return res.status(400).json({ 
            success: false, 
            message: `Capacity exceeded. Room ${roomNumber} allows max ${roomMaxInfants} infants.` 
        });
    }
    // -------------------------------

    // Use the reliable, native JavaScript UTC date parsing
    const startAt = new Date(`${checkin}T00:00:00.000Z`);
    const endAt = new Date(`${checkout}T00:00:00.000Z`);

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please use YYYY-MM-DD.",
      });
    }

    if (endAt <= startAt)
      return res.status(400).json({
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
      return res.status(400).json({
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
      return res.status(400).json({
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
      // --- SAVING NEW DATA ---
      adults,
      infants,
      expectedArrivalTime: arrivalTime, // Mapping frontend 'arrivalTime' to DB field
      specialRequest,
      paymentMethod,
      promoCode,
      // -----------------------
      source: "CRM", // Explicitly mark this as an internal booking
      createdBy: req.user.userId,
    });

    // ============================================================
    // 👇 NEW LOGIC: AUTOMATIC TRANSACTION CREATION 👇
    // ============================================================
    if (advanceAmount && Number(advanceAmount) > 0) {
        // Create the Ledger Entry
        await Transaction.create({
            reservation: reservation._id,
            amount: Number(advanceAmount),
            type: 'advance',
            // Default to 'Cash' if method not provided
            paymentMethod: advancePaymentMethod || "Cash", 
            description: "Initial Deposit (Auto-created with Reservation)",
            recordedBy: req.user.userId
        });
    }
    // ============================================================

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

// exports.getReservationById = async (req, res) => {
//   try {
//     const r = await Reservation.findById(req.params.id)
//       .populate("room", "roomNumber category rate status")
//       .populate("createdBy", "name email");
//     if (!r)
//       return res.status(404).json({ success: false, message: "Not found" });

//     // 1. Fetch the Wallet History for this ID
//     const transactions = await Transaction.find({ reservation: r._id });
    
//     let totalAdvance = 0;
//     transactions.forEach(tx => {
//         if(tx.type === 'advance') totalAdvance += tx.amount;
//         if(tx.type === 'refund') totalAdvance -= tx.amount;
//     });

//     // 2. Calculate Expected Costs
//     const oneDay = 24 * 60 * 60 * 1000;
//     // Calculate nights (Start to End)
//     const diffDays = Math.round(Math.abs((new Date(r.endAt) - new Date(r.startAt)) / oneDay));
//     const nights = diffDays === 0 ? 1 : diffDays; // Minimum 1 night
    
//     const roomRate = r.room?.rate || 0;
//     const estimatedTotal = roomRate * nights;
    
//     // 3. Calculate Balance
//     const estimatedBalance = Math.max(0, estimatedTotal - totalAdvance);

//     res.json({ success: true, data: r });
//   } catch (err) {
//     res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };

exports.getReservationById = async (req, res) => {
  try {
    const r = await Reservation.findById(req.params.id)
      .populate("room", "roomNumber category rate status")
      .populate("createdBy", "name email");

    if (!r)
      return res.status(404).json({ success: false, message: "Not found" });

    // ============================================================
    // 👇 NEW LOGIC: FETCH WALLET & CALCULATE FINANCIALS 👇
    // ============================================================
    
    // 1. Fetch transactions linked to this reservation
    // Make sure you imported Transaction at the top of the file!
    const transactions = await Transaction.find({ reservation: r._id });
    
    let totalAdvance = 0;
    transactions.forEach(tx => {
        if(tx.type === 'advance') totalAdvance += tx.amount;
        if(tx.type === 'refund') totalAdvance -= tx.amount;
    });

    // 2. Calculate Nights
    const oneDay = 24 * 60 * 60 * 1000;
    const diffDays = Math.round(Math.abs((new Date(r.endAt) - new Date(r.startAt)) / oneDay));
    const nights = diffDays === 0 ? 1 : diffDays; 
    
    // 3. Calculate Totals
    const roomRate = r.room?.rate || 0;
    const estimatedTotal = roomRate * nights;
    const estimatedBalance = Math.max(0, estimatedTotal - totalAdvance);

    // ============================================================

    // 4. Return merged data
    res.json({ 
        success: true, 
        data: {
            ...r.toObject(), // 👈 CRITICAL: Converts Mongoose doc to plain object
            financials: {    // 👈 Appends the new data
                nights,
                roomRate,
                estimatedTotal,
                totalAdvance,
                estimatedBalance
            }
        } 
    });

  } catch (err) {
    console.error("Get Reservation Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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
      return res.status(400).json({
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

exports.getDailyActivityReport = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res
        .status(400)
        .json({ success: false, message: "Date is required." });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const queries = {
      scheduledArrivals: Reservation.find({
        status: "reserved",
        startAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber")
        .lean(),
      actualCheckIns: Guest.find({
        checkInAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber")
        .lean(),
      actualCheckOuts: Guest.find({
        status: "checked-out",
        checkOutAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber")
        .lean(),
      newBookings: Reservation.find({
        createdAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber")
        .lean(),
      cancellations: Reservation.find({
        status: "cancelled",
        updatedAt: { $gte: dayStart, $lte: dayEnd },
      })
        .populate("room", "roomNumber")
        .lean(),
    };

     const [arrivals, checkIns, checkOuts, newBookings, cancellations] =
      await Promise.all(Object.values(queries));

    const formatReportItem = (item, type) => ({
      ...item,
      type,
    });

    const responseData = {
      checkIns: checkIns.map((item) => formatReportItem(item, "guest")),
      checkOuts: checkOuts.map((item) => formatReportItem(item, "guest")),
      newBookings: newBookings.map((item) =>
        formatReportItem(item, "reservation")
      ),
      arrivals: arrivals.map((item) => formatReportItem(item, "reservation")),
      cancellations: cancellations.map((item) =>
        formatReportItem(item, "reservation")
      ),
    };

    const summary = {
      arrivals: arrivals.length,
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
      newBookings: newBookings.length,
      cancellations: cancellations.length,
    };

    res.status(200).json({ success: true, date, summary, data: responseData });
  } catch (err) {
    console.error("Error in getDailyActivityReport:", err);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};
