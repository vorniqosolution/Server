const Reservation = require("../model/reservationmodel");
const Room = require("../model/room");
const Guest = require("../model/guest");
const Transaction = require("../model/transactions");
const { checkRoomAvailability } = require("../utils/roomUtils");
const { getStartOfDay } = require("../utils/dateUtils");

/**
 * Swap Reservation Service
 * Changes room and/or dates atomically while preserving transaction history
 */
exports.swapReservationService = async (reservationId, data, userId) => {
    const { newRoomId, newCheckin, newCheckout } = data;

    // Helper to throw with status code
    const throwError = (message, status = 400) => {
        const error = new Error(message);
        error.statusCode = status;
        throw error;
    };

    // At least one change is required
    if (!newRoomId && !newCheckin && !newCheckout) {
        throwError("At least one of newRoomId, newCheckin, or newCheckout is required");
    }

    // Find the reservation
    const reservation = await Reservation.findById(reservationId).populate("room");
    if (!reservation) {
        throwError("Reservation not found", 404);
    }

    // Only allow swap for reserved/confirmed reservations
    if (!["reserved", "confirmed"].includes(reservation.status)) {
        throwError(`Cannot swap a reservation with status '${reservation.status}'`);
    }

    // Store original values for comparison
    const originalRoom = reservation.room;
    const originalStartAt = reservation.startAt;
    const originalEndAt = reservation.endAt;

    // Determine target room
    let targetRoomId = newRoomId || reservation.room._id;
    let targetRoom = newRoomId ? await Room.findById(newRoomId) : reservation.room;

    if (newRoomId && !targetRoom) {
        throwError("New room not found", 404);
    }

    if (targetRoom.status === "maintenance") {
        throwError("Cannot assign room under maintenance");
    }

    // Determine target dates
    const targetStartAt = newCheckin ? getStartOfDay(newCheckin) : reservation.startAt;
    const targetEndAt = newCheckout ? getStartOfDay(newCheckout) : reservation.endAt;

    // Validate dates
    if (isNaN(targetStartAt.getTime()) || isNaN(targetEndAt.getTime())) {
        throwError("Invalid date format. Please use YYYY-MM-DD.");
    }

    if (targetEndAt <= targetStartAt) {
        throwError("Checkout date must be after check-in date");
    }

    // Check capacity
    if (targetRoom.adults < reservation.adults) {
        throwError(
            `Room ${targetRoom.roomNumber} only allows ${targetRoom.adults} adults, reservation has ${reservation.adults}`
        );
    }

    const roomMaxInfants = targetRoom.infants || 0;
    if (roomMaxInfants < reservation.infants) {
        throwError(
            `Room ${targetRoom.roomNumber} only allows ${roomMaxInfants} infants, reservation has ${reservation.infants}`
        );
    }

    // Check availability for target room + target dates
    const availability = await checkRoomAvailability(
        targetRoomId,
        targetStartAt,
        targetEndAt,
        { excludeReservationId: reservationId }
    );

    if (!availability.available) {
        const conflictDetails = availability.conflicts
            .map(
                (c) =>
                    `${c.type === "reservation" ? "Reservation" : "Guest"} (${c.name}) from ${new Date(
                        c.startDate
                    ).toLocaleDateString()} to ${new Date(c.endDate).toLocaleDateString()}`
            )
            .join("; ");

        throwError(`Room is not available for the selected dates: ${conflictDetails}`, 409);
    }

    // Calculate nights and financials
    const oneDay = 24 * 60 * 60 * 1000;
    const originalNights = Math.round(Math.abs((originalEndAt - originalStartAt) / oneDay)) || 1;
    const newNights = Math.round(Math.abs((targetEndAt - targetStartAt) / oneDay)) || 1;

    const originalRate = originalRoom.rate || 0;
    const newRate = targetRoom.rate || 0;

    const originalEstimate = originalRate * originalNights;
    const newEstimate = newRate * newNights;

    // Get existing advance payments
    const transactions = await Transaction.find({ reservation: reservationId });
    let totalAdvance = 0;
    transactions.forEach((tx) => {
        if (tx.type === "advance") totalAdvance += tx.amount;
        if (tx.type === "refund") totalAdvance -= tx.amount;
    });

    const newBalance = Math.max(0, newEstimate - totalAdvance);

    // Update reservation
    reservation.room = targetRoomId;
    reservation.startAt = targetStartAt;
    reservation.endAt = targetEndAt;
    await reservation.save();

    // Populate for response
    await reservation.populate("room");

    // Build change summary
    const changes = [];
    if (newRoomId && newRoomId !== originalRoom._id.toString()) {
        changes.push(`Room: ${originalRoom.roomNumber} → ${targetRoom.roomNumber}`);
    }
    if (newCheckin && targetStartAt.getTime() !== originalStartAt.getTime()) {
        changes.push(
            `Check-in: ${originalStartAt.toISOString().split("T")[0]} → ${targetStartAt.toISOString().split("T")[0]}`
        );
    }
    if (newCheckout && targetEndAt.getTime() !== originalEndAt.getTime()) {
        changes.push(
            `Checkout: ${originalEndAt.toISOString().split("T")[0]} → ${targetEndAt.toISOString().split("T")[0]}`
        );
    }

    return {
        message: `Reservation swapped successfully: ${changes.join(", ")}`,
        reservation: {
            _id: reservation._id,
            fullName: reservation.fullName,
            startAt: reservation.startAt,
            endAt: reservation.endAt,
            status: reservation.status,
            room: {
                _id: targetRoom._id,
                roomNumber: targetRoom.roomNumber,
                category: targetRoom.category,
                rate: targetRoom.rate,
            },
        },
        changes: {
            room: newRoomId
                ? {
                    from: { roomNumber: originalRoom.roomNumber, rate: originalRate },
                    to: { roomNumber: targetRoom.roomNumber, rate: newRate },
                }
                : null,
            dates:
                newCheckin || newCheckout
                    ? {
                        from: { startAt: originalStartAt, endAt: originalEndAt, nights: originalNights },
                        to: { startAt: targetStartAt, endAt: targetEndAt, nights: newNights },
                    }
                    : null,
        },
        financials: {
            originalEstimate,
            newEstimate,
            difference: newEstimate - originalEstimate,
            totalAdvance,
            newBalance,
        },
    };
};
