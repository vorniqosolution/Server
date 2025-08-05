const Guest = require("../model/guest");
const Room = require("../model/room");
const Discount = require("../model/discount");
const Invoice = require("../model/invoice");
const axios = require("axios");
const Setting = require("../model/Setting");
const mongoose = require("mongoose");

exports.createGuest = async (req, res) => {
  try {
    let {
      fullName,
      address,
      phone,
      cnic,
      email,
      roomNumber,
      stayDuration,
      paymentMethod,
      applyDiscount = false,
      additionaldiscount = 0,
    } = req.body;

    console.log("additionaldiscount", additionaldiscount);

    // 1. Lookup room
    const room = await Room.findOne({ roomNumber });
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    if (room.status !== "available")
      return res
        .status(400)
        .json({ success: false, message: "Room not available" });

    // 2. Calculate rent
    let baseRent = room.rate * stayDuration;
    baseRent -= additionaldiscount; // ✅ subtract additional discount first

    let discountAmount = 0;
    let discountTitle = null;
    let taxAmount = 0; // ✅ initialized before
    let totalRent = baseRent;

    // Get tax settings
    const settings = await Setting.findById("global_settings");
    const taxRate = settings ? settings.taxRate : 0; // ✅ get tax rate
    console.log("taxRate", taxRate);

    // Apply percentage discount if applicable
    if (applyDiscount) {
      const today = new Date();
      const validDiscount = await Discount.findOne({
        startDate: { $lte: today },
        endDate: { $gte: today },
      });

      if (!validDiscount)
        return res
          .status(400)
          .json({ success: false, message: "No valid discount available" });

      discountAmount = baseRent * (validDiscount.percentage / 100); // ✅ percentage discount on baseRent
      totalRent = baseRent - discountAmount; // ✅ apply discount
      discountTitle = validDiscount.title;
    }

    // Calculate tax and final total rent
    taxAmount = (totalRent * taxRate) / 100; // ✅ tax on discounted amount
    totalRent += taxAmount; // ✅ final amount with tax

    // 3. Create guest record
    const guest = await Guest.create({
      fullName,
      address,
      phone,
      cnic,
      email,
      room: room._id,
      stayDuration,
      paymentMethod,
      applyDiscount,
      discountTitle,
      totalRent,
      gst: taxAmount, // ✅ storing GST
      additionaldiscount: additionaldiscount, // ✅ storing additional discount
      createdBy: req.user.userId,
    });

    // 4. Mark room occupied
    room.status = "occupied";
    await room.save();

    // 5. Invoice Calculation (fully synced with guest logic) ✅
    let invoiceBaseRent = room.rate * stayDuration; // ✅
    invoiceBaseRent -= additionaldiscount; // ✅

    let invoiceDiscountAmount = 0;
    let invoiceTaxAmount = 0;
    let invoiceTotal = invoiceBaseRent;

    if (applyDiscount) {
      invoiceDiscountAmount = invoiceBaseRent * (discountAmount / baseRent); // ✅ same ratio as guest logic
      invoiceTotal = invoiceBaseRent - invoiceDiscountAmount; // ✅
    }

    invoiceTaxAmount = (invoiceTotal * taxRate) / 100; // ✅
    invoiceTotal += invoiceTaxAmount; // ✅

    const invoice = await Invoice.create({
      invoiceNumber: `HSQ-${Date.now()}`,
      guest: guest._id,
      items: [
        {
          description: `Room Rent (${room.category} - #${room.roomNumber})`,
          quantity: stayDuration,
          unitPrice: room.rate,
          total: invoiceBaseRent, // ✅ already reduced by additional discount
        },
      ],
      subtotal: invoiceBaseRent, // ✅ after additional discount
      discountAmount: invoiceDiscountAmount, // ✅ calculated same as above
      taxRate,
      taxAmount: invoiceTaxAmount,
      grandTotal: invoiceTotal,
      additionaldiscount,
      dueDate: guest.checkOutAt,
      createdBy: req.user.userId,
    });

    console.log("invoice", invoice);

    // =================================================================

    // 6. Notify Inventory (if applicable)
    // ... (your existing axios call)
    try {
      await axios.post(
        `${process.env.API_BASE_URL}/api/inventory/checkin`,
        { roomId: room._id, guestId: guest._id },
        {
          headers: {
            Cookie: req.headers.cookie,
          },
        }
      );
      console.log(
        "Calling Inventory at:",
        `${process.env.API_BASE_URL}/api/inventory/checkin`
      );
    } catch (invErr) {
      console.error("Inventory check-in failed:", invErr.message);
      // Continue without blocking check-in
    }

    // 7. Return guest AND their new invoice data
    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      data: {
        guest,
        invoice, // <-- SEND INVOICE TO FRONTEND
      },
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
    const guest = await Guest.findByIdAndDelete(req.params.id);
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }
    return res.json({ message: "Guest deleted successfully" });
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
