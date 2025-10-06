const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getAvailableRooms,
  getAvailablePresidentialRooms,
  getRoomTimeline,
  getAvailableRoomsByCategory
} = require("../controller/roomController");
const upload = require("../config/multer");

// public Routes
router.get("/public/get-all-rooms", getRooms);
router.get("/public/get-available-rooms", getAvailableRooms);

// CRM Routes
router.use(authenticate);
router.get("/get-available-rooms", getAvailableRooms);
router.post("/create-room", upload.array('images', 3), createRoom);
router.get("/get-all-rooms", getRooms);
router.get("/get-presidential-rooms", getAvailablePresidentialRooms);
router.get("/get-by-id/:id", getRoomById);
router.put("/update-room/:id", upload.array('images', 3), updateRoom);
router.delete("/delete-room/:id", deleteRoom);
router.get("/:id/timeline", getRoomTimeline);
router.get("/available-room-cat", getAvailableRoomsByCategory);


module.exports = router;