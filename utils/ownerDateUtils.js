// Helper: Determine Season
const determineSeason = (date, config) => {
    const d = new Date(date);
    const month = d.getMonth(); // 0=Jan, 11=Dec

    const isMonthInSeason = (m, start, end) => {
        if (start <= end) return m >= start && m <= end;
        return m >= start || m <= end; // Wraps around
    };

    // Use Config or Fallback
    const summer = config?.summer || { startMonth: 5, endMonth: 7 };
    const winter = config?.winter || { startMonth: 11, endMonth: 0 }; // Dec-Jan default

    if (isMonthInSeason(month, summer.startMonth, summer.endMonth)) return "summer";
    if (isMonthInSeason(month, winter.startMonth, winter.endMonth)) return "winter";

    return "none";
};

// Helper: Determine Type (Weekend vs Weekday)
const determineDayType = (date) => {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun, 6=Sat
    // Weekend: Sat, Sun
    return (day === 0 || day === 6) ? "weekend" : "weekday";
};

// Helper: Get Season Date Range
const getSeasonRange = (season, referenceDate, config) => {
    if (season === "none") return null;

    const d = new Date(referenceDate);
    const currentYear = d.getFullYear();
    const currentMonth = d.getMonth();

    let startM, endM;

    if (config && config[season]) {
        startM = config[season].startMonth;
        endM = config[season].endMonth;
    } else {
        // Defaults
        if (season === "summer") { startM = 5; endM = 7; }
        else if (season === "winter") { startM = 11; endM = 0; }
        else return null;
    }

    let startYear = currentYear;
    let endYear = currentYear;

    if (startM > endM) {
        // Wraps around (e.g. Winter: Dec -> Jan)
        if (currentMonth <= endM) {
            // We are in the "end" part (Jan), so it started last year
            startYear = currentYear - 1;
        } else {
            // We are in the "start" part (Dec), so it ends next year
            endYear = currentYear + 1;
        }
    } else {
        // Same year (Summer)
        // Ensure strictly simplistic: assume season occurs within the year of the reference date
        // unless typical wrap-around logic applies?
        // Actually for Summer (Jun-Aug), if we are in Jun, it is this year.
    }

    return {
        start: new Date(startYear, startM, 1),
        end: new Date(endYear, endM + 1, 0, 23, 59, 59) // Day 0 of next month is last day of current
    };
};

// Helper: Normalize Date to Midnight (Strip time)
const normalizeToMidnight = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

module.exports = {
    determineSeason,
    determineDayType,
    getSeasonRange,
    normalizeToMidnight
};
