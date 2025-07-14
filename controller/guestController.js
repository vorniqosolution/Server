const Guest = require("../model/guest");
const Room  = require("../model/room");

// Check in a new guest using roomNumber
exports.createGuest = async (req, res) => {
  try {
    const { fullName, address, phone, cnic, roomNumber } = req.body;
    // 1. Lookup room by roomNumber
    const room = await Room.findOne({ roomNumber });
    if (!room) return res.status(404).json({ message: "Room not found" });
    if (room.status !== "available")
      return res.status(400).json({ message: "Room not available" });

    
    const guest = await Guest.create({ // 2. Create guest record
      fullName,
      address,
      phone,
      cnic,
      room: room._id,
      createdBy: req.user.userId
    });
    // 3. Mark room occupied
    room.status = "occupied";
    await room.save();

    // 4. Respond
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

// Get single guest by ID
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

// Check out a guest
exports.checkoutGuest = async (req, res) => {
  try {
    const guest = await Guest.findById(req.params.id);
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    if (guest.status === "checked-out")
      return res.status(400).json({ message: "Guest already checked out" });

    // 1. Update guest record
    guest.checkOutAt = new Date();
    guest.status     = "checked-out";
    await guest.save();

    // 2. Free up room
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