export function getWeekDateRange(week: number): { start: Date; end: Date } {
  const seasonStart = new Date('2025-10-06'); // Monday of Week 1
  const start = new Date(seasonStart);
  start.setDate(start.getDate() + week * 7);

  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Sunday

  return { start, end };
}
