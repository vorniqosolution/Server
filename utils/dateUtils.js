/**
 * Date Utilities for CRM
 * Handles standardized UTC+5 (PKT) date logic to ensure consistent reporting.
 */

const TIMEZONE_OFFSET = "+05:00"; // PKT vs UTC

/**
 * Returns the start of the day for the given date string or Date object,
 * adjusted for the local timezone shift.
 * @param {string|Date} dateInput - YYYY-MM-DD string or Date object
 * @returns {Date} Date object set to 00:00:00 Local Time
 */
const getStartOfDay = (dateInput) => {
    let dateStr;
    if (dateInput instanceof Date) {
        dateStr = dateInput.toISOString().split("T")[0];
    } else {
        dateStr = dateInput;
    }
    return new Date(`${dateStr}T00:00:00.000${TIMEZONE_OFFSET}`);
};

/**
 * Returns the end of the day for the given date string or Date object,
 * adjusted for the local timezone shift.
 * @param {string|Date} dateInput - YYYY-MM-DD string or Date object
 * @returns {Date} Date object set to 23:59:59.999 Local Time
 */
const getEndOfDay = (dateInput) => {
    let dateStr;
    if (dateInput instanceof Date) {
        dateStr = dateInput.toISOString().split("T")[0];
    } else {
        dateStr = dateInput;
    }
    return new Date(`${dateStr}T23:59:59.999${TIMEZONE_OFFSET}`);
};

/**
 * Validates if the input string is a valid YYYY-MM-DD date
 * @param {string} dateStr 
 * @returns {boolean}
 */
const isValidDateString = (dateStr) => {
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
};

module.exports = {
    getStartOfDay,
    getEndOfDay,
    isValidDateString,
    TIMEZONE_OFFSET
};
