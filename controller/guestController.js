const Guest = require("../model/guest");
const Room = require("../model/room");
const Discount = require("../model/discount");
const Invoice = require("../model/invoice");
const axios = require('axios');
const mongoose = require("mongoose");

exports.createGuest = async (req, res) => {
  try {
    const {
      fullName, address, phone, cnic, email, roomNumber,
      stayDuration, paymentMethod, applyDiscount = false,
    } = req.body;

    // 1. Lookup room
    const room = await Room.findOne({ roomNumber });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    if (room.status !== "available") return res.status(400).json({ success: false, message: "Room not available" });

    // 2. Calculate rent
    const baseRent = room.rate * stayDuration;
    let totalRent = baseRent;
    let discountAmount = 0;
    let discountTitle = null;

    if (applyDiscount) {
      const today = new Date();
      const validDiscount = await Discount.findOne({ startDate: { $lte: today }, endDate: { $gte: today } });
      if (validDiscount) {
        discountAmount = baseRent * (validDiscount.percentage / 100);
        totalRent = baseRent - discountAmount;
        discountTitle = validDiscount.title;
      }
    }

    // 3. Create guest record
    const guest = await Guest.create({
      fullName, address, phone, cnic, email, room: room._id,
      stayDuration, paymentMethod, applyDiscount, discountTitle,
      totalRent, createdBy: req.user.userId,
    });

    // 4. Mark room occupied
    room.status = "occupied";
    await room.save();

    // 5. Generate the custom invoice number
    const today = new Date();
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999));

    const lastInvoiceToday = await Invoice.findOne({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });

    let sequenceNumber = 1;
    if (lastInvoiceToday) {
      const lastSequence = parseInt(lastInvoiceToday.invoiceNumber.split('-')[2], 10);
      sequenceNumber = lastSequence + 1;
    }

    const datePart = startOfDay.toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD
    const sequencePart = String(sequenceNumber).padStart(3, '0'); // 001, 002...

    const newInvoiceNumber = `HSQ-${datePart}-${sequencePart}`;
    
    // --- THIS IS THE CRITICAL FIX ---
    // 6. Calculate invoice totals and CREATE the invoice document
    const taxRate = 10;
    const subtotal = room.rate * stayDuration;
    const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
    const grandTotal = subtotal - discountAmount + taxAmount;

    // This was the missing step. We now create the invoice in the database.
    const invoice = await Invoice.create({
      invoiceNumber: newInvoiceNumber, // <-- Use the generated number
      guest: guest._id,
      items: [{
        description: `Room Rent (${room.category} - #${room.roomNumber})`,
        quantity: stayDuration,
        unitPrice: room.rate,
        total: subtotal
      }],
      subtotal,
      discountAmount,
      taxRate,
      taxAmount,
      grandTotal,
      createdBy: req.user.userId,
    });
    // --- END OF FIX ---

    // 7. Notify Inventory (if applicable)
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
    }

    // 8. Return guest AND their new invoice data
    return res.status(201).json({
      success: true,
      message: "Guest checked in successfully",
      data: {
        guest,
        invoice // This variable now exists and holds the created invoice
      }
    });

  } catch (err) {
    console.error("createGuest Error:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: "Validation Error", error: err.message });
    }
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getGuests = async (req, res) => {
  try {
    const guests = await Guest.find()
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email");
    return res.status(200).json({ guests });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

// exports.getGuestById = async (req, res) => {
//   try {
//     const guest = await Guest.findById(req.params.id)
//       .populate("room", "roomNumber bedType category rate status view")
//       .populate("createdBy", "name email");
//     if (!guest) return res.status(404).json({ message: "Guest not found" });
//     res.status(200).json({ guest });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

exports.getGuestById = async (req, res) => {
  try {
    // 1. Find the guest and populate their room details
    const guest = await Guest.findById(req.params.id)
      .populate("room", "roomNumber bedType category rate status view")
      .populate("createdBy", "name email");

    if (!guest) {
      return res.status(404).json({ success: false, message: "Guest not found" });
    }

    // 2. Find the most recent invoice associated with this guest
    const invoice = await Invoice.findOne({ guest: guest._id })
        .sort({ createdAt: -1 }); // Get the latest one

    // 3. Return both the guest and their latest invoice together
    res.status(200).json({
      success: true,
      data: {
        guest,
        invoice, // This can be null, which is handled on the frontend
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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

    const now = new Date();
    guest.checkOutAt = now;
    guest.checkOutTime = now.toTimeString().slice(0, 5);
    guest.status = "checked-out";

    const inMs = guest.checkInAt.getTime();
    const outMs = now.getTime();
    guest.stayDuration = Math.ceil((outMs - inMs) / (1000 * 60 * 60 * 24));
    await guest.save();

    const room = await Room.findById(guest.room);
    if (room) {
      room.status = "available";
      await room.save();
    }

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

    const roomsInCategory = await Room.find({ category: category }).select('_id');
    const roomIds = roomsInCategory.map(room => room._id);

    if (roomIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: `No rooms found for category: ${category}`
      });
    }
    
    const checkedInGuests = await Guest.find({
      status: "checked-in",
      room: { $in: roomIds }
    })
    .populate('room', 'roomNumber bedType view rate')
    .populate('createdBy', 'name email')
    .sort({ checkInAt: -1 });

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