// const express = require("express");
// const router = express.Router();
// const authenticate = require("../middleware/authMiddleware");
// // const authorie = require("../middleware/adminMiddleware");
// const {
//   createRoom,
//   getRooms,
//   getRoomById,
//   updateRoom,
//   deleteRoom,
//   getAvailableRooms,
//   getAvailablePresidentialRooms,
// } = require("../controller/roomController");

// router.use(authenticate);
// router.get("/get-available-rooms", getAvailableRooms);

// // Protect all room routes
// // Only allow access to admin users
// // router.use(authorie("admin"));

// router.post("/create-room", createRoom);
// router.get("/get-all-rooms", getRooms);
// router.get("/get-presidential-rooms", getAvailablePresidentialRooms);
// router.get("/get-by-id/:id", getRoomById);
// router.put("/update-room/:id", updateRoom);
// router.delete("/delete-room/:id", deleteRoom);

// module.exports = router;

const express = require("express");
const router = express.Router();
const authenticate = require("../middleware/authMiddleware");
// const authorie = require("../middleware/adminMiddleware");
const {
  createRoom,
  getRooms,
  getRoomById,
  updateRoom,
  deleteRoom,
  getAvailableRooms,
  getAvailablePresidentialRooms,
  getRoomTimeline,
} = require("../controller/roomController");

// Import multer configuration
const upload = require("../config/multer");

router.use(authenticate);
router.get("/get-available-rooms", getAvailableRooms);

// Protect all room routes
// Only allow access to admin users
// router.use(authorie("admin"));

// Add multer middleware to handle file uploads
router.post("/create-room", upload.array('images', 6), createRoom);
router.get("/get-all-rooms", getRooms);
router.get("/get-presidential-rooms", getAvailablePresidentialRooms);
router.get("/get-by-id/:id", getRoomById);
router.put("/update-room/:id", upload.array('images', 6), updateRoom);
router.delete("/delete-room/:id", deleteRoom);
// ADD THIS NEW ROUTE
router.get("/:id/timeline", getRoomTimeline);

module.exports = router;