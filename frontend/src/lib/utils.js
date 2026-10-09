import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional class names with Tailwind conflict resolution
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formats bytes to human-readable size (KB, MB)
 */
export function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Safely parses any date string from SQLite backend (interpreting UTC timestamps without 'Z' correctly)
 */
export function parseDate(dateString) {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  let str = String(dateString).trim();
  
  // SQLite datetime('now') produces "YYYY-MM-DD HH:MM:SS" in UTC.
  // If it lacks timezone information (no 'Z' and no +/-\d\d:\d\d), treat it as UTC.
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Formats date string to user's real local time format
 */
export function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const d = parseDate(dateString);
    if (!d) return dateString;
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (e) {
    return dateString;
  }
}

/**
 * Relative time helper (e.g., "Just now", "5m ago") with accurate local time comparison
 */
export function timeAgo(dateString) {
  if (!dateString) return '—';
  try {
    const d = parseDate(dateString);
    if (!d) return dateString;
    const now = new Date();
    const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return formatDate(dateString);
  } catch (e) {
    return dateString;
  }
}
