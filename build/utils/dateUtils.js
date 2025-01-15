"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMeetingDateTime = exports.convertToUTC = void 0;
const convertToUTC = (date) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};
exports.convertToUTC = convertToUTC;
const parseMeetingDateTime = (meeting) => {
    try {
        if (!meeting?.meetingDate || !meeting?.meetingTime)
            return null;
        // Convert the date to UTC
        const dateValue = typeof meeting.meetingDate === 'string'
            ? meeting.meetingDate.includes('T')
                ? new Date(meeting.meetingDate) // Handle ISO string
                : new Date(meeting.meetingDate) // Handle date string
            : new Date(meeting.meetingDate); // Handle Date object
        if (isNaN(dateValue.getTime()))
            return null;
        // Combine date and time in UTC
        const [hours, minutes] = meeting.meetingTime.split(':');
        const combinedDate = new Date(dateValue);
        combinedDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return (0, exports.convertToUTC)(combinedDate);
    }
    catch (err) {
        console.error('Error parsing meeting datetime:', err);
        return null;
    }
};
exports.parseMeetingDateTime = parseMeetingDateTime;
