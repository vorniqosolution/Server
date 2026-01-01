const Guest = require('../model/guest');
const Reservation = require('../model/reservationmodel');


async function checkRoomAvailability(roomId, startDate, endDate, options = {}) {
    const { excludeGuestId, excludeReservationId } = options;
    const conflicts = [];

    // Ensure dates are Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date range
    if (start >= end) {
        return {
            available: false,
            conflicts: [{ type: 'validation', message: 'End date must be after start date' }]
        };
    }

    // Check for overlapping checked-in guests
    const guestQuery = {
        room: roomId,
        status: 'checked-in',
        // Overlap condition: guest.checkIn < requestedEnd AND guest.checkOut > requestedStart
        checkInAt: { $lt: end },
        checkOutAt: { $gt: start }
    };

    // Exclude the current guest if extending their stay
    if (excludeGuestId) {
        guestQuery._id = { $ne: excludeGuestId };
    }

    const conflictingGuests = await Guest.find(guestQuery)
        .select('fullName checkInAt checkOutAt')
        .lean();

    if (conflictingGuests.length > 0) {
        conflicts.push(...conflictingGuests.map(g => ({
            type: 'guest',
            id: g._id,
            name: g.fullName,
            startDate: g.checkInAt,
            endDate: g.checkOutAt
        })));
    }

    // Check for overlapping reservations
    const reservationQuery = {
        room: roomId,
        status: { $in: ['reserved', 'confirmed'] },
        // Overlap condition: reservation.start < requestedEnd AND reservation.end > requestedStart
        startAt: { $lt: end },
        endAt: { $gt: start }
    };

    // Exclude a specific reservation if editing it
    if (excludeReservationId) {
        reservationQuery._id = { $ne: excludeReservationId };
    }

    const conflictingReservations = await Reservation.find(reservationQuery)
        .select('fullName startAt endAt')
        .lean();

    if (conflictingReservations.length > 0) {
        conflicts.push(...conflictingReservations.map(r => ({
            type: 'reservation',
            id: r._id,
            name: r.fullName,
            startDate: r.startAt,
            endDate: r.endAt
        })));
    }

    return {
        available: conflicts.length === 0,
        conflicts
    };
}

async function isRoomAvailable(roomId, startDate, endDate, options = {}) {
    const result = await checkRoomAvailability(roomId, startDate, endDate, options);
    return result.available;
}

async function getConflictingBookings(roomId, startDate, endDate, options = {}) {
    const result = await checkRoomAvailability(roomId, startDate, endDate, options);
    return result.conflicts;
}

function calculateNights(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

module.exports = {
    checkRoomAvailability,
    isRoomAvailable,
    getConflictingBookings,
    calculateNights
};
