const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
const {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom
} = require("../controller/roomController");

// Protect room routes
router.use(authenticate);

router.post("/create-room", createRoom);
router.get("/get-all-rooms", getRooms);
router.get("/get-by-id/:id", getRoomById);
router.put("/update-room/:id", updateRoom);
router.delete("/delete-room/:id", deleteRoom);

module.exports = router;
