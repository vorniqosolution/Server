// controllers/roomController.js
const Room = require("../model/room");

exports.createRoom = async (req, res) => {
  try {
    const {
      roomNumber,
      bedType,
      category,
      view,
      rate,
      owner,
      status
    } = req.body;

    // Prevent duplicate room numbers
    if (await Room.findOne({ roomNumber })) {
      return res.status(400).json({ message: "Room number already exists" });
    }

    // Build payload
    const roomData = { roomNumber, bedType, category, view, rate, owner };
    if (status) roomData.status = status;

    const room = await Room.create(roomData);
    res.status(201).json({ message: "Room created successfully", room });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getRooms = async (req, res) => {
  try {
    // Optionally sort by view and roomNumber for grouped dropdowns
    const rooms = await Room.find().sort({ view: 1, roomNumber: 1 });
    res.status(200).json({ rooms });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(200).json({ room });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    const {
      roomNumber,
      bedType,
      category,
      view,
      rate,
      owner,
      status
    } = req.body;

    // Build update object
    const updateData = { roomNumber, bedType, category, view, rate, owner };
    if (status !== undefined) updateData.status = status;

    const updated = await Room.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true, omitUndefined: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Room not found" });
    }

    res
      .status(200)
      .json({ message: "Room updated successfully", room: updated });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const deleted = await Room.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: "Room not found" });
    }
    res.status(200).json({ message: "Room deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const rooms = await Room.find({ status: "available" });
    res.status(200).json({ rooms });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};
