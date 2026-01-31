import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Format date to ISO string
 */
export function formatDate(date: Date | string): string {
  return dayjs(date).toISOString();
}

/**
 * Format date to Italian format
 */
export function formatDateIT(date: Date | string): string {
  return dayjs(date).format('DD/MM/YYYY');
}

/**
 * Format datetime to Italian format
 */
export function formatDateTimeIT(date: Date | string): string {
  return dayjs(date).format('DD/MM/YYYY HH:mm');
}

/**
 * Add days to date
 */
export function addDays(date: Date | string, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

/**
 * Add months to date
 */
export function addMonths(date: Date | string, months: number): Date {
  return dayjs(date).add(months, 'month').toDate();
}

/**
 * Calculate difference in days
 */
export function diffInDays(date1: Date | string, date2: Date | string): number {
  return dayjs(date1).diff(dayjs(date2), 'day');
}

/**
 * Check if date is past
 */
export function isPast(date: Date | string): boolean {
  return dayjs(date).isBefore(dayjs());
}

/**
 * Check if date is future
 */
export function isFuture(date: Date | string): boolean {
  return dayjs(date).isAfter(dayjs());
}

/**
 * Start of day
 */
export function startOfDay(date: Date | string): Date {
  return dayjs(date).startOf('day').toDate();
}

/**
 * End of day
 */
export function endOfDay(date: Date | string): Date {
  return dayjs(date).endOf('day').toDate();
}
