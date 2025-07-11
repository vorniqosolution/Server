const Room = require("../model/room");

exports.createRoom = async (req, res) => {
  try {
    const { roomNumber, type, status, rate, notes } = req.body;
    const existing = await Room.findOne({ roomNumber });
    if (existing)
      return res.status(400).json({ message: "Room number already exists" });

    const roomData = { roomNumber, type, rate, notes };
    // Include status if provided, otherwise schema default applies
    if (status) roomData.status = status;

    const room = await Room.create(roomData);
    res.status(201).json({ message: "Room created successfully", room });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get all rooms
exports.getRooms = async (req, res) => {
  try {
    const rooms = await Room.find();
    res.status(200).json({ rooms });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Get a room by ID
exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ message: "Room not found" });
    res.status(200).json({ room });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Update a room
exports.updateRoom = async (req, res) => {
  try {
    const updated = await Room.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!updated) return res.status(404).json({ message: "Room not found" });
    res
      .status(200)
      .json({ message: "Room updated successfully", room: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// Delete a room
exports.deleteRoom = async (req, res) => {
  try {
    const deleted = await Room.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Room not found" });
    res.status(200).json({ message: "Room deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
