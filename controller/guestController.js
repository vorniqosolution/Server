const Guest = require("../model/guest");
const Room = require("../model/room");
const Discount = require("../model/discount");

// Check in a new guest using roomNumber
exports.createGuest = async (req, res) => {
  try {
    const {
      fullName,
      address,
      phone,
      cnic,
      roomNumber,
      stayDuration,
      applyDiscount = false
    } = req.body;

    // 1. Lookup room by roomNumber
    const room = await Room.findOne({ roomNumber });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.status !== "available")
      return res.status(400).json({ message: "Room not available" });

    // 2. Calculate base rent
    const baseRent = room.rate * stayDuration;
    let totalRent = baseRent;
    let discountTitle = null;

    if (applyDiscount) {
      // Find active discount
      const today = new Date();
      const validDiscount = await Discount.findOne({
        startDate: { $lte: today },
        endDate: { $gte: today }
      });

      if (!validDiscount) {
        return res.status(400).json({ message: "No valid discount available today" });
      }

      totalRent = baseRent * (1 - validDiscount.percentage / 100);
      discountTitle = validDiscount.title;
    }

    // 3. Create guest record
    const guest = await Guest.create({
      fullName,
      address,
      phone,
      cnic,
      room: room._id,
      stayDuration,
      applyDiscount,
      discountTitle,
      totalRent,
      createdBy: req.user.userId
    });

    // 4. Mark room occupied
    room.status = "occupied";
    await room.save();

    res.status(201).json({ message: "Guest checked in", guest });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all guests
exports.getGuests = async (req, res) => {
  try {
    const guests = await Guest.find()
      .populate("room", "roomNumber type status rate")
      .populate("createdBy", "name email");
    res.status(200).json({ guests });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get guest by ID
exports.getGuestById = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id)
      .populate("room", "roomNumber type status rate")
      .populate("createdBy", "name email");
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    res.status(200).json({ guest });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Check out guest
exports.checkoutGuest = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    if (guest.status === "checked-out")
      return res.status(400).json({ message: "Guest already checked out" });

    guest.checkOutAt = new Date();
    guest.status = "checked-out";
    await guest.save();

    const room = await Room.findById(guest.room);
    if (room) {
      room.status = "available";
      await room.save();
    }

    res.status(200).json({ message: "Guest checked out", guest });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
