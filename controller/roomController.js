const Room = require("../model/room");
const Reservation = require("../model/reservationmodel");
const Guest = require("../model/guest");
const fs = require('fs');
const path = require('path');
const util = require('util');
const unlinkAsync = util.promisify(fs.unlink);

// CRM Functions
exports.createRoom = async (req, res) => {
  try {
    const { roomNumber, bedType, category, view, rate, owner, status } =
      req.body;

    // Prevent duplicate room numbers
    if (await Room.findOne({ roomNumber })) {
      return res.status(400).json({ message: "Room number already exists" });
    }

    // Build payload
    const roomData = { roomNumber, bedType, category, view, rate, owner };
    if (status) roomData.status = status;

    if (req.files && req.files.length > 0) {
      roomData.images = req.files.map((file) => ({
        filename: file.filename,
        path: `/uploads/rooms/${file.filename}`, // Relative path for serving
        mimetype: file.mimetype,
        size: file.size,
      }));
    }

    const room = await Room.create(roomData);
    res.status(201).json({ message: "Room created successfully", room });
  } catch (err) {
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(console.error);
      }
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getRooms = async (req, res) => {
  try {
    // Optionally sort by view and roomNumber for grouped dropdowns
    const rooms = await Room.find().sort({ roomNumber: 1 });
    res.status(200).json({ rooms });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getAvailablePresidentialRooms = async (req, res, next) => {
  try {
    // Find all rooms that are:
    // 1. Presidential category
    // 2. Currently available (not booked, occupied, or under maintenance)
    const availablePresidentialRooms = await Room.find({
      category: "Presidential",
      status: "available",
    })
      .select("roomNumber rate bedType view") // Select only the fields we need
      .sort({ roomNumber: "asc" }); // Sort by room number

    if (
      !availablePresidentialRooms ||
      availablePresidentialRooms.length === 0
    ) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: "No Presidential rooms are currently available",
      });
    }

    // Format the response to be more user-friendly
    const formattedRooms = availablePresidentialRooms.map((room) => ({
      roomNumber: room.roomNumber,
      price: room.rate,
      priceFormatted: `Rs ${room.rate.toLocaleString()}`,
      bedType: room.bedType,
      view: room.view,
      roomId: room._id,
    }));

    res.status(200).json({
      success: true,
      category: "Presidential",
      count: formattedRooms.length,
      data: formattedRooms,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server Error" });
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
    const { roomNumber, bedType, category, view, rate, owner, status, deletedImages } = req.body;

    // Find the room first
    const room = await Room.findById(req.params.id);
    if (!room) {
      // Clean up any uploaded files
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            await unlinkAsync(file.path);
          } catch (err) {
            console.error(`Failed to delete temp file ${file.path}:`, err);
          }
        }
      }
      return res.status(404).json({ message: "Room not found" });
    }

    // Build update object
    const updateData = { roomNumber, bedType, category, view, rate, owner };
    if (status !== undefined) updateData.status = status;

    // Handle deleted images
    if (deletedImages) {
      let deletedImagesList = [];
      try {
        deletedImagesList = JSON.parse(deletedImages);
      } catch (parseErr) {
        console.error("Error parsing deletedImages:", parseErr);
        deletedImagesList = []; // Use empty array if parsing fails
      }
      
      for (const filename of deletedImagesList) {
        try {
          // Delete file from filesystem
          const filePath = path.join(__dirname, '../uploads/rooms', filename);
          // Check if file exists before trying to delete
          if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
            console.log(`Successfully deleted file: ${filename}`);
          } else {
            console.log(`File not found, skipping: ${filename}`);
          }
          
          // Remove from room images array
          room.images = room.images.filter(img => img.filename !== filename);
        } catch (fileErr) {
          console.error(`Failed to delete file ${filename}:`, fileErr);
          // Continue even if file deletion fails
        }
      }
    }

    // Add new images
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => ({
        filename: file.filename,
        path: `/uploads/rooms/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size
      }));
      
      if (!room.images) {
        room.images = [];
      }
      room.images.push(...newImages);
    }

    // Update images in updateData
    updateData.images = room.images;

    const updated = await Room.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
      omitUndefined: true,
    });

    res.status(200).json({ message: "Room updated successfully", room: updated });
  } catch (err) {
    console.error("Room update error:", err);
    // Clean up any uploaded files on error
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          await unlinkAsync(file.path);
        } catch (cleanupErr) {
          console.error(`Failed to clean up file ${file.path}:`, cleanupErr);
        }
      }
    }
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Delete all images from filesystem
    if (room.images && room.images.length > 0) {
      for (const image of room.images) {
        try {
          const filePath = path.join(__dirname, '../uploads/rooms', image.filename);
          // Check if file exists before deleting
          if (fs.existsSync(filePath)) {
            await unlinkAsync(filePath);
            console.log(`Successfully deleted file: ${image.filename}`);
          } else {
            console.log(`File not found, skipping: ${image.filename}`);
          }
        } catch (fileErr) {
          console.error(`Error deleting file ${image.filename}:`, fileErr);
          // Continue with deletion even if one file fails
        }
      }
    }

    // Now delete the room from database
    await room.deleteOne();
    res.status(200).json({ message: "Room deleted successfully" });
  } catch (err) {
    console.error("Room deletion error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.getAvailableRooms = async (req, res) => {
  try {
    const { checkin, checkout } = req.query;
    if (!checkin || !checkout) {
      return res.status(400).json({ success: false, message: "Check-in and checkout dates are required." });
    }

    // Use the reliable, native JavaScript UTC date parsing
    const startDate = new Date(`${checkin}T00:00:00.000Z`);
    const endDate = new Date(`${checkout}T00:00:00.000Z`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ success: false, message: "Invalid date format. Please use YYYY-MM-DD." });
    }

    if (endDate <= startDate) {
      return res.status(400).json({ success: false, message: "Check-out date must be after check-in date." });
    }

    // The rest of the logic is already robust and correct
    const reservedRooms = await Reservation.find({
      status: { $in: ["reserved", "confirmed"] },
      startAt: { $lt: endDate },
      endAt: { $gt: startDate },
    }).select('room');
    
    const occupiedRooms = await Guest.find({
      status: 'checked-in',
      checkInAt: { $lt: endDate },
      checkOutAt: { $gt: startDate },
    }).select('room');
    
    const unavailableRoomIds = [
      ...reservedRooms.map(r => r.room.toString()),
      ...occupiedRooms.map(g => g.room.toString())
    ];
    const uniqueUnavailableRoomIds = [...new Set(unavailableRoomIds)];

    const availableRooms = await Room.find({
      _id: { $nin: uniqueUnavailableRoomIds },
      status: { $ne: 'maintenance' }
    }).sort({ roomNumber: 1 });

    return res.status(200).json({ success: true, rooms: availableRooms });

  } catch (err) {
    console.error("getAvailableRooms Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.getRoomTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the start of today in UTC for a reliable starting point
    const startDate = new Date();
    startDate.setUTCHours(0, 0, 0, 0);

    // Calculate the end date 30 days from now
    const endDate = new Date(startDate);
    endDate.setUTCDate(startDate.getUTCDate() + 30);

    // The rest of the logic is already robust and correct
    const guests = await Guest.find({
      room: id,
      checkInAt: { $lt: endDate },
      checkOutAt: { $gt: startDate },
    }).select('fullName checkInAt checkOutAt status');

    const reservations = await Reservation.find({
      room: id,
      status: { $in: ['reserved', 'confirmed'] },
      startAt: { $lt: endDate },
      endAt: { $gt: startDate },
    }).select('fullName startAt endAt status');

    const bookings = [
      ...guests.map(g => ({
        type: 'Guest (Checked-in)',
        name: g.fullName,
        startDate: g.checkInAt,
        endDate: g.checkOutAt,
        status: g.status,
      })),
      ...reservations.map(r => ({
        type: 'Reservation',
        name: r.fullName,
        startDate: r.startAt,
        endDate: r.endAt,
        status: r.status,
      })),
    ];

    bookings.sort((a, b) => a.startDate - b.startDate);

    res.status(200).json({ success: true, timeline: bookings });

  } catch (err)
 {
    console.error("getRoomTimeline Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

// WEBSITE FUNCTIONS

