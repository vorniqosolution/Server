const Guest = require("../model/guest");
const Room = require("../model/room");
const Discount = require("../model/discount");
const Invoice = require("../model/invoice");
const axios = require("axios");
const Setting = require("../model/Setting");
const mongoose = require("mongoose");
const Reservation = require("../model/reservationmodel");
const { isValid } = require("date-fns");
const dateFnsTz = require("date-fns-tz");

exports.createGuest = async (req, res) => {
  try {
    let {
      fullName,
      address,
      phone,
      cnic,
      email,
      roomNumber,
      checkInDate,
      checkOutDate,
      paymentMethod,
      applyDiscount = false,
      additionaldiscount = 0,
      reservationId,
    } = req.body;

    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: "Check-in and check-out dates are required.",
      });
    }

    // 1. FIX: CAPTURE THE ACTUAL CHECK-IN MOMENT AND TIME STRING
    const checkInMoment = new Date();
    const checkInTimeStr = checkInMoment.toTimeString().slice(0, 5);

    // This format ensures the saved Date object includes the exact time of check-in
    // instead of midnight UTC, fixing the checkInTime calculation.
    const checkIn = new Date(`${checkInDate}T${checkInTimeStr}:00.000`);
    const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

    // Check if the dates are valid after parsing
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Please use YYYY-MM-DD.",
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: "Check-out date must be after the check-in date.",
      });
    }

    // 2. ENFORCE "TODAY ONLY" RULE
    const today = new Date();
    // Compare only the date part for today's rule
    const checkInDay = new Date(checkInDate);

    today.setUTCHours(0, 0, 0, 0);
    checkInDay.setUTCHours(0, 0, 0, 0);

    if (checkInDay.getTime() !== today.getTime()) {
      return res.status(400).json({
        success: false,
        message:
          "Guest check-in must be for today's date. For future bookings, please create a reservation.",
      });
    }

    // 3. FIND ROOM AND CHECK CURRENT AVAILABILITY
    const room = await Room.findOne({ roomNumber });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    if (room.status === "occupied" || room.status === "maintenance") {
      return res
        .status(400)
        .json({ success: false, message: `Room is currently ${room.status}.` });
    }

    const blockingReservation = await Reservation.findOne({
      room: room._id,
      status: { $in: ["reserved", "confirmed"] },
      startAt: { $lte: checkInDay }, // Use the date part for comparison
      endAt: { $gt: checkInDay },
    });

    if (
      blockingReservation &&
      (!reservationId || blockingReservation._id.toString() !== reservationId)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Room is reserved for another guest today. Please check in via the reservation.",
      });
    }

    // --- FROM HERE, THE REST OF THE LOGIC IS UNCHANGED ---
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const settings = await Setting.findById("global_settings").lean();
    const taxRate = Number(settings?.taxRate ?? 0);
    const rate = Number(room.rate) || 0;
    const roomTotal = rate * nights;
    
    const additionalDiscountAmount = Math.min(
      Math.max(0, Number(additionaldiscount) || 0),
      roomTotal
    );
    let stdPct = 0;
    let discountTitle = null;
    
    if (applyDiscount) {
      const validDiscount = await Discount.findOne({
        startDate: { $lte: today },
        endDate: { $gte: today },
      });
      if (!validDiscount)
        return res.status(400).json({
          success: false,
          message: "No valid discount is available for today.",
        });
      stdPct = Number(validDiscount.percentage) || 0;
      discountTitle = validDiscount.title;
    }
    const standardDiscountAmount = Math.round(roomTotal * (stdPct / 100));
    const subtotalBeforeTax = Math.max(
      0,
      roomTotal - standardDiscountAmount - additionalDiscountAmount
    );
    const gstAmount = Math.round((subtotalBeforeTax * taxRate) / 100);
    const totalRent = subtotalBeforeTax + gstAmount;

    const guest = await Guest.create({
      fullName,
      address,
      phone,
      cnic,
      email,
      room: room._id,
      checkInAt: checkIn,
      checkInTime: checkInTimeStr, // FIX: Explicitly set the correct time string
      checkOutAt: checkOut,
      stayDuration: nights,
      paymentMethod,
      applyDiscount,
      discountTitle,
      totalRent,
      gst: gstAmount,
      additionaldiscount: additionalDiscountAmount,
      createdBy: req.user.userId,
    });

    room.status = "occupied";
    await room.save();
    
    if (reservationId)
      await Reservation.findByIdAndUpdate(reservationId, {
        status: "checked-in",
        guest: guest._id,
      });

    await Invoice.create({
      invoiceNumber: `HSQ-${Date.now()}`,
      guest: guest._id, 
      items: [
        {
          description: `Room Rent (${room.category} - #${room.roomNumber})`,
          quantity: nights,
          unitPrice: rate,
          total: roomTotal,
        },
      ],
      subtotal: roomTotal,
      discountAmount: standardDiscountAmount,
      additionaldiscount: additionalDiscountAmount,
      taxRate,
      taxAmount: gstAmount,
      grandTotal: totalRent,
      dueDate: checkOut,
      status: "pending",
      createdBy: req.user.userId,
      checkInAt: guest.checkInAt,
      guestDetails: {
        fullName: guest.fullName,
        phone: guest.phone,
        cnic: guest.cnic,
      },
      roomDetails: {
        roomNumber: room.roomNumber,
        category: room.category,
      },
    });
    
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/inventory/checkin`,
        {
          roomId: room._id,
          guestId: guest._id,
          source: reservationId ? "reservation" : "walkin",
        },
        {
          headers: {
            Cookie: req.headers.cookie,
            Authorization: req.headers.authorization,
          },
        }
      );
    } catch (invErr) {
      console.error("Inventory check-in failed:", invErr?.message);
    }

    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      data: { guest },
    });
  } catch (err) {
    console.error("createGuest Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getGuests = async (req, res) => {
  try {
    const guests = await Guest.find()
      // pull in roomNumber, bedType, rate and status
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    return res.status(200).json({ guests });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

exports.getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id)
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email");

    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const invoice = await Invoice.findOne({ guest: guest._id });

    res.status(200).json({
      data: {
        guest,
        invoice: invoice || null,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

exports.checkoutGuest = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid guest ID" });
    }
    const guest = await Guest.findById(id);
    if (!guest) {
      return res
        .status(404)
        .json({ success: false, message: "Guest not found" });
    }
    if (guest.status === "checked-out") {
      return res
        .status(400)
        .json({ success: false, message: "Guest already checked out" });
    }

    // mark checkout timestamp
    const now = new Date();
    guest.checkOutAt = now;
    guest.checkOutTime = now.toTimeString().slice(0, 5);
    guest.status = "checked-out";

    // recalc stay duration
    const inMs = guest.checkInAt.getTime();
    const outMs = now.getTime();
    guest.stayDuration = Math.ceil((outMs - inMs) / (1000 * 60 * 60 * 24));
    await guest.save();

    // free up the room
    const room = await Room.findById(guest.room);
    if (room) {
      room.status = "available";
      await room.save();
    }
    // Change the status in reservation model
    const reservation = await Reservation.findOneAndUpdate(
      { guest: id },
      { $set: { status: "checked-out" } },
      { new: true }
    );
    // Notify Inventory module of check-out
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/inventory/checkout`,
        { roomId: guest.room, guestId: guest._id },
        {
          headers: {
            Cookie: req.headers.cookie,
          },
        }
      );
      console.log(
        "Calling Inventory at:",
        `${process.env.API_BASE_URL}/api/inventory/checkout`
      );
    } catch (invErr) {
      console.error("Inventory check-out failed:", invErr.message);
      // Continue without blocking check-out
    }

    return res
      .status(200)
      .json({ success: true, message: "Guest checked out", data: guest });
  } catch (err) {
    console.error("checkoutGuest Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: err.message });
  }
};

exports.deleteGuest = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);

    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    const room = await Room.findById(guest.room);

    if (room) {
      await Room.findByIdAndUpdate(room._id, { status: "available" });
    }
    await Guest.findByIdAndDelete(req.params.id);

    return res.json({
      message: "Guest deleted successfully, room status updated",
    });
  } catch (err) {
    console.error("deleteGuest Error:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

exports.UpdateGuestById = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, phone, cnic, paymentMethod, address } = req.body;

    console.log("Received data:", {
      fullName,
      email,
      phone,
      cnic,
      paymentMethod,
      address,
    });
    console.log("Guest ID:", id);

    const updatedGuest = await Guest.findByIdAndUpdate(
      id,
      {
        fullName: fullName,
        email: email,
        phone: phone,
        cnic: cnic,
        paymentMethod: paymentMethod,
        address: address,
      },
      { new: true, runValidators: true }
    );

    if (!updatedGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    return res.status(200).json({
      message: "Guest updated successfully",
      data: updatedGuest,
    });
  } catch (error) {
    console.error("UpdateGuestById Error:", error);
    return res.status(500).json({
      message: "Internal server error while updating guest",
      error: error.message,
    });
  }
};

exports.getGuestActivityByDate = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required. Format: YYYY-MM-DD" });
    }

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    
    const queries = {
      checkIns: Guest.find({ 
        checkInAt: { $gte: dayStart, $lte: dayEnd } 
      }).populate('room', 'roomNumber category').lean(),

      checkOuts: Guest.find({ 
        status: 'checked-out', 
        checkOutAt: { $gte: dayStart, $lte: dayEnd } 
      }).populate('room', 'roomNumber category').lean(),
    };
    
    // Execute both queries in parallel for speed
    const [checkIns, checkOuts] = await Promise.all(Object.values(queries));

    // Prepare the data payload with categorized lists
    const responseData = { 
      checkIns, 
      checkOuts,
    };

    // Prepare the summary with the counts
    const summary = {
      checkIns: checkIns.length,
      checkOuts: checkOuts.length,
    };

    res.status(200).json({ success: true, date, summary, data: responseData });

  } catch (err) {
    console.error("Error in getGuestActivityByDate:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
