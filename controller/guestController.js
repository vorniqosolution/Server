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

exports.getGuests = async (req, res) => {
  try {
    const guests = await Guest.find()
      // pull in roomNumber, bedType, rate and status
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email");
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

exports.getCheckedInGuestsByRoomCategory = async (req, res, next) => {
  try {
    const { category } = req.query;

    if (!category) {
      return res.status(400).json({
        success: false,
        error: "Please provide a room category",
      });
    }

    // First, find all rooms of the specified category
    const roomsInCategory = await Room.find({ category: category }).select(
      "_id"
    );
    const roomIds = roomsInCategory.map((room) => room._id);

    if (roomIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: `No rooms found for category: ${category}`,
      });
    }

    // Now find all guests who are:
    // 1. Currently checked-in (status: "checked-in")
    // 2. In one of the rooms from our category
    const checkedInGuests = await Guest.find({
      status: "checked-in",
      room: { $in: roomIds },
    })
      .populate("room", "roomNumber bedType view rate") // Include room details
      .populate("createdBy", "name email") // Include admin who created the booking
      .sort({ checkInAt: -1 }); // Most recent check-ins first

    res.status(200).json({
      success: true,
      category: category,
      count: checkedInGuests.length,
      data: checkedInGuests,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
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

    // 1. VALIDATE AND PARSE DATES (NATIVE JAVASCRIPT METHOD)
    if (!checkInDate || !checkOutDate) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Check-in and check-out dates are required.",
        });
    }

    // This format explicitly tells the Date constructor to parse in UTC (the 'Z' at the end).
    // This is guaranteed to be timezone-independent and works reliably everywhere.
    const checkIn = new Date(`${checkInDate}T00:00:00.000Z`);
    const checkOut = new Date(`${checkOutDate}T00:00:00.000Z`);

    // Check if the dates are valid after parsing
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Invalid date format. Please use YYYY-MM-DD.",
        });
    }

    if (checkOut <= checkIn) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Check-out date must be after the check-in date.",
        });
    }

    // 2. ENFORCE "TODAY ONLY" RULE
    const today = new Date();
    // Set 'today' to the beginning of the day in UTC for a fair comparison
    today.setUTCHours(0, 0, 0, 0);

    if (checkIn.getTime() !== today.getTime()) {
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
      startAt: { $lte: today },
      endAt: { $gt: today },
    });

    if (
      blockingReservation &&
      (!reservationId || blockingReservation._id.toString() !== reservationId)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            "Room is reserved for another guest today. Please check in via the reservation.",
        });
    }

    // --- FROM HERE, THE REST OF THE LOGIC IS UNCHANGED AND CORRECT ---
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    const settings = await Setting.findById("global_settings").lean();
    const taxRate = Number(settings?.taxRate ?? 0);
    const rate = Number(room.rate) || 0;
    const roomTotal = rate * nights;
    console.log("//Total Room//", roomTotal)
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
        return res
          .status(400)
          .json({
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

    return res
      .status(201)
      .json({
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

// exports.createGuest = async (req, res) => {
//   try {
//     let {
//       fullName,
//       address,
//       phone,
//       cnic,
//       email,
//       roomNumber,
//       stayDuration,
//       paymentMethod,
//       applyDiscount = false,
//       additionaldiscount = 0,
//       reservationId, // <-- must be sent by frontend for reserved rooms
//     } = req.body;

//     console.log("Reservation id", reservationId);
//     // 1) Find room FIRST
//     const room = await Room.findOne({ roomNumber });
//     if (!room) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Room not found" });
//     }

//     // 2) Block only occupied
//     if (room.status === "occupied") {
//       return res
//         .status(400)
//         .json({ success: false, message: "Room already occupied" });
//     }

//     // 3) If reserved, require a matching reservation
//     let reservation = null;
//     if (room.status === "reserved") {
//       if (!reservationId) {
//         return res.status(400).json({
//           success: false,
//           message: "Room is reserved. reservationId is required to check in.",
//         });
//       }

//       reservation = await Reservation.findOne({
//         _id: reservationId,
//         $or: [{ room: room._id }, { roomNumber: room.roomNumber }],
//         status: { $in: ["reserved", "confirmed", "pending"] },
//       });

//       if (!reservation) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid reservation for this room",
//         });
//       }
//     }

//     // 4) Pricing / discount / tax  ✅ UPDATED (correct order + shared with invoice)
//     const settings = await Setting.findById("global_settings").lean();
//     const taxRate = Number(settings?.taxRate ?? 0); // 0 in your case

//     const nights = Math.max(1, Number(stayDuration) || 1);
//     const rate = Number(room.rate) || 0;

//     // Full room total BEFORE any discounts
//     const roomTotal = rate * nights;

//     // Additional discount (fixed). Clamp to roomTotal just in case.
//     const additionalDiscountAmount = Math.min(
//       Math.max(0, Number(additionaldiscount) || 0),
//       roomTotal
//     );

//     // Standard (% ) discount on FULL roomTotal (not after additional)
//     let stdPct = 0;
//     let discountTitle = null;
//     if (applyDiscount) {
//       const today = new Date();
//       const validDiscount = await Discount.findOne({
//         startDate: { $lte: today },
//         endDate: { $gte: today },
//       });

//       if (!validDiscount) {
//         return res
//           .status(400)
//           .json({ success: false, message: "No valid discount available" });
//       }

//       stdPct = Number(validDiscount.percentage) || 0; // 25 in your example
//       discountTitle = validDiscount.title;
//     }

//     const standardDiscountAmount = Math.round(roomTotal * (stdPct / 100));

//     const subtotalBeforeTax = Math.max(
//       0,
//       roomTotal - standardDiscountAmount - additionalDiscountAmount
//     );

//     const gstAmount = Math.round((subtotalBeforeTax * taxRate) / 100); // 0 if taxRate=0
//     const totalRent = subtotalBeforeTax + gstAmount;

//     // 5) Create guest (values aligned with invoice)
//     const guest = await Guest.create({
//       fullName,
//       address,
//       phone,
//       cnic,
//       email,
//       room: room._id,
//       stayDuration: nights,
//       paymentMethod,
//       applyDiscount,
//       discountTitle,
//       totalRent,
//       gst: gstAmount,
//       additionaldiscount: additionalDiscountAmount,
//       createdBy: req.user.userId,
//     });

//     // 6) Update room -> occupied
//     room.status = "occupied";
//     await room.save();

//     // 7) If from reservation, update reservation
//     if (reservation) {
//       reservation.status = "checked-in";
//       reservation.guest = guest._id;
//       await reservation.save();
//     }

//     // 8) Invoice Calculation  ✅ UPDATED to exactly mirror the guest math
//     const invoice = await Invoice.create({
//       invoiceNumber: `HSQ-${Date.now()}`,
//       guest: guest._id,
//       items: [
//         {
//           description: `Room Rent (${room.category} - #${room.roomNumber})`,
//           quantity: nights,
//           unitPrice: rate,
//           total: roomTotal, // line total BEFORE discounts
//         },
//       ],
//       subtotal: roomTotal, // before any discounts
//       discountAmount: standardDiscountAmount, // standard % discount
//       additionaldiscount: additionalDiscountAmount, // fixed discount
//       taxRate,
//       taxAmount: gstAmount,
//       grandTotal: totalRent,
//       dueDate: guest.checkOutAt, // keep as-is if your model provides it
//       createdBy: req.user.userId,
//     });

//     console.log("invoice", invoice);

//     // 9) ALWAYS notify Inventory (both simple and reservation check-in)
//     try {
//       const authHeaders = {};
//       if (req.headers.cookie) authHeaders.Cookie = req.headers.cookie;
//       if (req.headers.authorization)
//         authHeaders.Authorization = req.headers.authorization;

//       await axios.post(
//         `${process.env.API_BASE_URL}/api/inventory/checkin`,
//         {
//           roomId: room._id,
//           guestId: guest._id,
//           source: reservation ? "reservation" : "walkin",
//         },
//         { headers: authHeaders }
//       );

//       console.log("Inventory check-in posted:", {
//         roomId: room._id.toString(),
//         guestId: guest._id.toString(),
//         source: reservation ? "reservation" : "walkin",
//       });
//     } catch (invErr) {
//       console.error(
//         "Inventory check-in failed:",
//         invErr?.response?.status,
//         invErr?.message
//       );
//       // do not block the guest creation if inventory call fails
//     }

//     return res.status(201).json({
//       success: true,
//       message: "Guest checked in successfully",
//       data: { guest },
//     });
//   } catch (err) {
//     console.error("createGuest Error:", err);
//     return res
//       .status(500)
//       .json({ success: false, message: "Server error", error: err.message });
//   }
// };
