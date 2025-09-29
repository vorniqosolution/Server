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
} = require("../controller/roomController");
const upload = require("../config/multer");

// public Routes
router.get("/public/get-all-rooms", getRooms);
router.get("/public/get-available-rooms", getAvailableRooms);

// CRM Routes
router.use(authenticate);
router.get("/get-available-rooms", getAvailableRooms);
router.post("/create-room", upload.array('images', 6), createRoom);
router.get("/get-all-rooms", getRooms);
router.get("/get-presidential-rooms", getAvailablePresidentialRooms);
router.get("/get-by-id/:id", getRoomById);
router.put("/update-room/:id", upload.array('images', 6), updateRoom);
router.delete("/delete-room/:id", deleteRoom);
router.get("/:id/timeline", getRoomTimeline);

module.exports = router;


exports.getPublicCategoryDetails = async (req, res) => {
  try {
    const allCategoryDetails = await Room.aggregate([
      // Stage 1: Match ALL publicly visible rooms.
      {
        $match: {
          isPubliclyVisible: true,
        },
      },
      
      // Stage 2: Group by category and bed type to create the unique cards.
      {
        $group: {
          _id: {
            category: "$category",
            bedType: "$bedType",
          },
          // Collect all the details needed for the UI card from the first room in each group.
          publicDescription: { $first: "$publicDescription" },
          startingRate: { $min: "$rate" }, // Show the lowest price for this type
          amenities: { $first: "$amenities" },
          cleanliness: { $first: "$cleanliness" },
          category: { $first: "$category" },
          bedType: { $first: "$bedType" },
          minAdults: { $min: "$adults" },
          maxAdults: { $max: "$adults" },
          imageUrl: { $first: { $arrayElemAt: ["$images.path", 0] } },
        },
      },

      // Stage 3: Project the final, clean shape for the API response.
      {
        $project: {
          _id: 0,
          publicName: { $concat: ["$_id.bedType", " - ", "$_id.category"] },
          publicDescription: 1,
          startingRate: 1,
          amenities: 1,
          cleanliness: 1,
          category: 1,
          bedType: 1,
          adultsCapacity: {
            $cond: {
              if: { $eq: ["$minAdults", "$maxAdults"] },
              then: { $toString: "$minAdults" },
              else: { $concat: [{ $toString: "$minAdults" }, "-", { $toString: "$maxAdults" }] },
            },
          },
          imageUrl: 1,
          // Notice: availableRooms and availableCount have been completely removed.
        },
      },
      
      // Stage 4: Sort the results for a consistent display.
      {
        $sort: {
          startingRate: 1,
        },
      },
    ]);

    res.status(200).json(allCategoryDetails);
  } catch (err) {
    console.error(`Error fetching all category details:`, err);
    res.status(500).json({ message: "Server error while fetching category details." });
  }
};