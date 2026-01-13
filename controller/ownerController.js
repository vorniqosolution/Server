const Owner = require("../model/Owner");
const OwnerAttendance = require("../model/OwnerAttendance");
const Settings = require("../model/Setting");
const SETTINGS_ID = "global_settings";
const {
    determineSeason,
    determineDayType,
    getSeasonRange,
    normalizeToMidnight
} = require("../utils/ownerDateUtils");

// 1. Create a new Owner
exports.createOwner = async (req, res) => {
    try {
        const {
            fullName,
            cardId,
            cnic,
            phone,
            email,
            apartmentNumber,
            agreementStartDate,
            agreementEndDate,
            assignedRoom,
            seasonLimits
        } = req.body;

        const existingOwner = await Owner.findOne({ cardId });
        if (existingOwner) {
            return res.status(400).json({ message: "Owner with this Card ID already exists." });
        }

        const newOwner = await Owner.create({
            fullName,
            cardId,
            cnic,
            phone,
            email,
            apartmentNumber,
            agreementStartDate,
            agreementEndDate,
            areaOfApartment: null,
            seasonLimits: seasonLimits || { totalSeasonLimit: 22 },
            assignedRoom: assignedRoom || null,
            createdBy: req.user.userId,
        });

        res.status(201).json({ message: "Owner created successfully", owner: newOwner });
    } catch (error) {
        console.error("Create Owner Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 2. Scan/Get Owner by Card ID
exports.getOwnerByCardId = async (req, res) => {
    try {
        const { cardId } = req.params;

        const owner = await Owner.findOne({ cardId }).populate("assignedRoom", "roomNumber category");
        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }

        const now = new Date();
        const settings = await Settings.findById(SETTINGS_ID);
        const currentSeason = determineSeason(now, settings?.seasonConfig);
        const currentYear = now.getFullYear();

        let totalDaysUsed = 0;
        let seasonLogs = [];
        let breakdown = {
            weekendUsed: 0,
            weekdayUsed: 0,
            season: currentSeason
        };

        if (currentSeason !== "none") {
            const range = getSeasonRange(currentSeason, now, settings?.seasonConfig);
            if (range) {
                const { start, end } = range;
                seasonLogs = await OwnerAttendance.find({
                    owner: owner._id,
                    date: { $gte: start, $lte: end }
                }).sort({ date: -1 });

                totalDaysUsed = seasonLogs.length;

                seasonLogs.forEach(log => {
                    const dayType = determineDayType(log.date);
                    if (dayType === "weekend") breakdown.weekendUsed++;
                    else breakdown.weekdayUsed++;
                });
            }
        }

        const limit = owner.seasonLimits?.totalSeasonLimit || 22;
        const remainingDays = Math.max(0, limit - totalDaysUsed);
        const isOverStay = totalDaysUsed >= limit;

        const today = normalizeToMidnight(new Date());

        const isTodayMarked = await OwnerAttendance.findOne({
            owner: owner._id,
            date: today
        });

        res.status(200).json({
            success: true,
            owner,
            usage: {
                totalDaysUsed,
                remainingDays,
                limit,
                isOverStay,
                isTodayMarked: !!isTodayMarked,
                currentSeason,
                breakdown
            },
            recentLogs: seasonLogs.slice(0, 5),
        });
    } catch (error) {
        console.error("Get Owner Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 3. Mark Attendance
exports.markAttendance = async (req, res) => {
    try {
        const { cardId, amountCharged } = req.body;

        const owner = await Owner.findOne({ cardId });
        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }

        const now = new Date();
        const today = normalizeToMidnight(now);

        const existingLog = await OwnerAttendance.findOne({
            owner: owner._id,
            date: today,
        });

        if (existingLog) {
            return res.status(400).json({ message: "Attendance already marked for today." });
        }

        // Logic check
        const settings = await Settings.findById(SETTINGS_ID);
        const currentSeason = determineSeason(now, settings?.seasonConfig);
        const currentYear = now.getFullYear();
        let isOverStay = false;
        let warningMsg = "";

        if (currentSeason !== "none") {
            const range = getSeasonRange(currentSeason, now, settings?.seasonConfig);
            if (range) {
                const { start, end } = range;

                // Count logs strictly within season
                const seasonLogs = await OwnerAttendance.find({
                    owner: owner._id,
                    date: { $gte: start, $lte: end }
                });

                const totalUsed = seasonLogs.length; // Before today
                const limit = owner.seasonLimits?.totalSeasonLimit || 22;

                if (totalUsed >= limit) {
                    isOverStay = true;
                    warningMsg = "Season Total Limit Reached.";
                }

                // Check specific weekend/weekday vouchers
                const dayType = determineDayType(today);
                let typeUsed = 0;
                let typeLimit = 0;

                if (currentSeason === "summer") {
                    typeLimit = dayType === "weekend" ? owner.seasonLimits.summerWeekend : owner.seasonLimits.summerWeekday;
                } else {
                    typeLimit = dayType === "weekend" ? owner.seasonLimits.winterWeekend : owner.seasonLimits.winterWeekday;
                }

                seasonLogs.forEach(log => {
                    if (determineDayType(log.date) === dayType) typeUsed++;
                });

                if (typeLimit > 0 && typeUsed >= typeLimit) {
                    isOverStay = true; // Flag overlap
                    warningMsg += ` ${currentSeason} ${dayType} Voucher Limit Reached (${typeUsed}/${typeLimit}).`;
                }
            }
        }

        const newLog = await OwnerAttendance.create({
            owner: owner._id,
            date: today,
            month: now.getMonth(), // Keep for legacy/analytics
            year: currentYear,
            markedBy: req.user.userId,
            amountCharged: amountCharged ? Number(amountCharged) : 0,
        });

        res.status(200).json({
            success: true,
            message: "Attendance marked successfully. " + warningMsg,
            isOverStay,
            log: newLog,
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "Attendance already marked for today." });
        }
        console.error("Mark Attendance Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 4. Get All Owners
exports.getAllOwners = async (req, res) => {
    try {
        const owners = await Owner.find()
            .populate("assignedRoom", "roomNumber category")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, owners });
    } catch (error) {
        console.error("Get All Owners Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 5. Update Owner
exports.updateOwner = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (updates.assignedRoom === "") {
            updates.assignedRoom = null;
        }

        const updatedOwner = await Owner.findByIdAndUpdate(id, updates, { new: true });

        if (!updatedOwner) {
            return res.status(404).json({ message: "Owner not found" });
        }

        res.status(200).json({ success: true, message: "Owner updated successfully", owner: updatedOwner });
    } catch (error) {
        console.error("Update Owner Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 6. Delete Owner
exports.deleteOwner = async (req, res) => {
    try {
        const { id } = req.params;
        const owner = await Owner.findById(id);

        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }

        await Owner.deleteOne({ _id: id });
        res.status(200).json({ success: true, message: "Owner deleted successfully" });
    } catch (error) {
        console.error("Delete Owner Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

// 7. Get Owner Timeline (Full History)
exports.getOwnerTimeline = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify owner exists
        const owner = await Owner.findById(id);
        if (!owner) {
            return res.status(404).json({ message: "Owner not found" });
        }

        const logs = await OwnerAttendance.find({ owner: id })
            .populate("markedBy", "name email role") // Get receptionist details
            .sort({ date: -1 }); // Newest first

        const settings = await Settings.findById(SETTINGS_ID);

        // Enrich logs with derived details
        const enrichedLogs = logs.map(log => {
            const dateObj = new Date(log.date);
            const season = determineSeason(dateObj, settings?.seasonConfig);
            const dayType = determineDayType(dateObj);

            // Get Day Name (e.g. "Monday")
            const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

            return {
                _id: log._id,
                date: log.date,
                amountCharged: log.amountCharged,
                markedBy: log.markedBy, // Populated user object
                createdAt: log.createdAt,
                // Derived fields
                dayName,
                season: season === "none" ? "Off-Season" : season,
                dayType: dayType.charAt(0).toUpperCase() + dayType.slice(1), // Capitalize
                year: log.year,
                month: log.month
            };
        });

        res.status(200).json({
            success: true,
            count: enrichedLogs.length,
            timeline: enrichedLogs
        });

    } catch (error) {
        console.error("Owner Timeline Error:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
