export const convertToUTC = (date: Date | string): Date => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};

export const parseMeetingDateTime = (meeting: any): Date | null => {
  try {
    if (!meeting?.meetingDate || !meeting?.meetingTime) return null;

    // Convert the date to UTC
    const dateValue = typeof meeting.meetingDate === 'string'
      ? meeting.meetingDate.includes('T')
        ? new Date(meeting.meetingDate)  // Handle ISO string
        : new Date(meeting.meetingDate)  // Handle date string
      : new Date(meeting.meetingDate);   // Handle Date object

    if (isNaN(dateValue.getTime())) return null;

    // Combine date and time in UTC
    const [hours, minutes] = meeting.meetingTime.split(':');
    const combinedDate = new Date(dateValue);
    combinedDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    
    return convertToUTC(combinedDate);
  } catch (err) {
    console.error('Error parsing meeting datetime:', err);
    return null;
  }
};