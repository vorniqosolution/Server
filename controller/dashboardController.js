const Room = require("../model/room");
const Guest = require("../model/guest");
const Reservation = require("../model/reservationmodel");
const { getStartOfDay, getEndOfDay } = require("../utils/dateUtils");

exports.getRoomStats = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = getStartOfDay(today);
        const endOfDay = getEndOfDay(today);

        // 1. Get total rooms count
        const totalRooms = await Room.countDocuments();

        // 2. Get Maintenance rooms
        const maintenanceCount = await Room.countDocuments({ status: "maintenance" });

        // 3. Get Occupied rooms (Active guests)
        // Guest MUST be 'checked-in'
        const occupiedCount = await Guest.countDocuments({
            status: "checked-in"
        });

        // 4. Get Reserved rooms (Expected Future Bookings)
        // We filter for "Tomorrow onwards" to avoid overlap with "Arrivals" (which is Today)
        const reservedCount = await Reservation.countDocuments({
            status: { $in: ["reserved", "confirmed"] },
            startAt: { $gt: endOfDay }
        });

        // 5. Get Arrivals for Today
        const matchArrivals = {
            status: { $in: ["reserved", "confirmed"] },
            startAt: { $gte: startOfDay, $lte: endOfDay }
        };
        const arrivalCount = await Reservation.countDocuments(matchArrivals);

        // 6. Calculate Available
        // Available = Total - (Occupied + Maintenance + Arrivals)
        // We exclude "Reserved" (starts tomorrow) from this calculation as they don't block room TODAY.
        const availableCount = Math.max(0, totalRooms - (occupiedCount + maintenanceCount + arrivalCount));

        res.status(200).json({
            success: true,
            data: {
                totalRooms,
                available: availableCount,
                occupied: occupiedCount,
                arrival: arrivalCount,
                maintenance: maintenanceCount,
                reserved: reservedCount
            }
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching stats" });
    }
};

exports.getTodayArrivals = async (req, res) => {
    try {
        const today = new Date();
        const startOfDay = getStartOfDay(today);
        const endOfDay = getEndOfDay(today);

        const arrivals = await Reservation.find({
            status: { $in: ["reserved", "confirmed"] },
            startAt: { $gte: startOfDay, $lte: endOfDay }
        })
            .select("fullName startAt endAt expectedArrivalTime")
            .populate("room", "roomNumber category") // Fetch room details
            .sort({ startAt: 1 }); // Earliest first

        res.status(200).json({
            success: true,
            count: arrivals.length,
            data: arrivals
        });

    } catch (error) {
        console.error("Dashboard Arrivals Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching arrivals" });
    }
};

exports.getRoomStatuses = async (req, res) => {
    try {
        const rooms = await Room.find().sort({ roomNumber: 1 });
        const guests = await Guest.find({ status: "checked-in" });

        // Fetch active reservations (Arrivals or Future)
        const today = new Date();
        const startOfDay = getStartOfDay(today); // Start of today (UTC+5)

        // We want reservations that are either:
        // 1. Arriving Today (Arrival)
        // 2. Starting in the Future (Reserved)
        const reservations = await Reservation.find({
            status: { $in: ["reserved", "confirmed"] },
            startAt: { $gte: startOfDay },
        });

        // 1. Map Guests by Room ID for O(1) access
        const guestMap = {};
        guests.forEach((g) => {
            if (g.room) guestMap[g.room.toString()] = g;
        });

        // 2. Map Reservations by Room ID
        const reservationMap = {};
        reservations.forEach((r) => {
            if (r.room) {
                const roomId = r.room.toString();
                if (!reservationMap[roomId]) reservationMap[roomId] = [];
                reservationMap[roomId].push(r);
            }
        });

        // 3. Construct Room Status List
        const roomStatuses = rooms.map((room) => {
            const roomId = room._id.toString();
            let status = "Available";
            let details = null;
            let styling = "bg-emerald-100 text-emerald-800 border-emerald-200"; // Default
            let icon = "CheckCircle";

            // Priority 1: Maintenance
            if (room.status === "maintenance") {
                status = "Maintenance";
                styling = "bg-red-100 text-red-800 border-red-200";
                icon = "Wrench";
                details = { reason: "Under Maintenance" };
            }
            // Priority 2: Occupied (Guest Checked In)
            else if (guestMap[roomId]) {
                status = "Occupied";
                styling = "bg-amber-100 text-amber-800 border-amber-200";
                icon = "Key";
                details = {
                    guestName: guestMap[roomId].fullName,
                    checkOut: guestMap[roomId].checkOutAt,
                };
            }
            // Priority 3: Reservations (Arrival or Future)
            else if (reservationMap[roomId] && reservationMap[roomId].length > 0) {
                const roomRes = reservationMap[roomId];

                // Find if any reservation is ARRIVING TODAY
                const todaysArrival = roomRes.find((r) => {
                    const start = new Date(r.startAt);
                    const now = new Date();
                    return (
                        start.getDate() === now.getDate() &&
                        start.getMonth() === now.getMonth() &&
                        start.getFullYear() === now.getFullYear()
                    );
                });

                if (todaysArrival) {
                    status = "Arrival";
                    styling = "bg-purple-200 text-purple-800 border-purple-100";
                    icon = "Sun";
                    details = {
                        guestName: todaysArrival.fullName,
                        checkIn: todaysArrival.startAt,
                    };
                } else {
                    // If not arrival, it's Reserved (Future)
                    // Sort by date to get the NEXT reservation
                    roomRes.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
                    const nextRes = roomRes[0];

                    status = "Reserved";
                    styling = "bg-sky-100 text-sky-800 border-sky-200";
                    icon = "Calendar";
                    details = {
                        guestName: nextRes.fullName,
                        checkIn: nextRes.startAt
                    };
                }
            }

            return {
                _id: room._id,
                roomNumber: room.roomNumber,
                category: room.category,
                bedType: room.bedType,
                status,
                styling, // Send styling config directly to frontend
                icon,
                details,
            };
        });

        res.status(200).json({ success: true, data: roomStatuses });
    } catch (error) {
        console.error("getRoomStatuses Error:", error);
        res
            .status(500)
            .json({ success: false, message: "Server error fetching room statuses" });
    }
};
