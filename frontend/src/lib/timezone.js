import { parseDate } from './utils.js';

/**
 * Top-Level Domains (ccTLD) and domain-specific mapping to countries and IANA timezones
 */
export const CCTLD_TIMEZONE_MAP = {
  // United Kingdom & Ireland
  'uk': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'co.uk': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'org.uk': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'me.uk': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'ie': { country: 'Ireland', flag: '🇮🇪', timeZone: 'Europe/Dublin', label: 'Ireland (Dublin / IST)' },

  // Western & Central Europe
  'de': { country: 'Germany', flag: '🇩🇪', timeZone: 'Europe/Berlin', label: 'Germany (Berlin / CET)' },
  'fr': { country: 'France', flag: '🇫🇷', timeZone: 'Europe/Paris', label: 'France (Paris / CET)' },
  'nl': { country: 'Netherlands', flag: '🇳🇱', timeZone: 'Europe/Amsterdam', label: 'Netherlands (Amsterdam / CET)' },
  'be': { country: 'Belgium', flag: '🇧🇪', timeZone: 'Europe/Brussels', label: 'Belgium (Brussels / CET)' },
  'ch': { country: 'Switzerland', flag: '🇨🇭', timeZone: 'Europe/Zurich', label: 'Switzerland (Zurich / CET)' },
  'at': { country: 'Austria', flag: '🇦🇹', timeZone: 'Europe/Vienna', label: 'Austria (Vienna / CET)' },
  'it': { country: 'Italy', flag: '🇮🇹', timeZone: 'Europe/Rome', label: 'Italy (Rome / CET)' },
  'es': { country: 'Spain', flag: '🇪🇸', timeZone: 'Europe/Madrid', label: 'Spain (Madrid / CET)' },
  'pt': { country: 'Portugal', flag: '🇵🇹', timeZone: 'Europe/Lisbon', label: 'Portugal (Lisbon / WET)' },
  'pl': { country: 'Poland', flag: '🇵🇱', timeZone: 'Europe/Warsaw', label: 'Poland (Warsaw / CET)' },
  'se': { country: 'Sweden', flag: '🇸🇪', timeZone: 'Europe/Stockholm', label: 'Sweden (Stockholm / CET)' },
  'no': { country: 'Norway', flag: '🇳🇴', timeZone: 'Europe/Oslo', label: 'Norway (Oslo / CET)' },
  'dk': { country: 'Denmark', flag: '🇩🇰', timeZone: 'Europe/Copenhagen', label: 'Denmark (Copenhagen / CET)' },
  'fi': { country: 'Finland', flag: '🇫🇮', timeZone: 'Europe/Helsinki', label: 'Finland (Helsinki / EET)' },
  'cz': { country: 'Czech Republic', flag: '🇨🇿', timeZone: 'Europe/Prague', label: 'Czech Republic (CET)' },
  'ro': { country: 'Romania', flag: '🇷🇴', timeZone: 'Europe/Bucharest', label: 'Romania (EET)' },
  'hu': { country: 'Hungary', flag: '🇭🇺', timeZone: 'Europe/Budapest', label: 'Hungary (CET)' },
  'gr': { country: 'Greece', flag: '🇬🇷', timeZone: 'Europe/Athens', label: 'Greece (Athens / EET)' },

  // North America
  'us': { country: 'United States', flag: '🇺🇸', timeZone: 'America/New_York', label: 'US East (New York / EDT)' },
  'ca': { country: 'Canada', flag: '🇨🇦', timeZone: 'America/Toronto', label: 'Canada (Toronto / EDT)' },
  'mx': { country: 'Mexico', flag: '🇲🇽', timeZone: 'America/Mexico_City', label: 'Mexico (Mexico City / CST)' },

  // Asia & Middle East
  'in': { country: 'India', flag: '🇮🇳', timeZone: 'Asia/Kolkata', label: 'India (IST / UTC+5:30)' },
  'co.in': { country: 'India', flag: '🇮🇳', timeZone: 'Asia/Kolkata', label: 'India (IST / UTC+5:30)' },
  'ae': { country: 'United Arab Emirates', flag: '🇦🇪', timeZone: 'Asia/Dubai', label: 'UAE (Dubai / GST)' },
  'sa': { country: 'Saudi Arabia', flag: '🇸🇦', timeZone: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh / AST)' },
  'sg': { country: 'Singapore', flag: '🇸🇬', timeZone: 'Asia/Singapore', label: 'Singapore (SGT / UTC+8)' },
  'jp': { country: 'Japan', flag: '🇯🇵', timeZone: 'Asia/Tokyo', label: 'Japan (Tokyo / JST)' },
  'cn': { country: 'China', flag: '🇨🇳', timeZone: 'Asia/Shanghai', label: 'China (Beijing / CST)' },
  'hk': { country: 'Hong Kong', flag: '🇭🇰', timeZone: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },

  // Oceania
  'au': { country: 'Australia', flag: '🇦🇺', timeZone: 'Australia/Sydney', label: 'Australia (Sydney / AEST)' },
  'com.au': { country: 'Australia', flag: '🇦🇺', timeZone: 'Australia/Sydney', label: 'Australia (Sydney / AEST)' },
  'nz': { country: 'New Zealand', flag: '🇳🇿', timeZone: 'Pacific/Auckland', label: 'New Zealand (Auckland / NZST)' },
  'co.nz': { country: 'New Zealand', flag: '🇳🇿', timeZone: 'Pacific/Auckland', label: 'New Zealand (Auckland / NZST)' },

  // South America & Africa
  'br': { country: 'Brazil', flag: '🇧🇷', timeZone: 'America/Sao_Paulo', label: 'Brazil (São Paulo / BRT)' },
  'za': { country: 'South Africa', flag: '🇿🇦', timeZone: 'Africa/Johannesburg', label: 'South Africa (SAST)' },
};

/**
 * Domain-specific overrides for companies with .com / .org
 */
export const DOMAIN_OVERRIDES = {
  'fastenerandfixing.com': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'fabory.com': { country: 'Netherlands', flag: '🇳🇱', timeZone: 'Europe/Amsterdam', label: 'Netherlands (Amsterdam / CET)' },
  'brightonbest.org': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'franciskirk.com': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'grampianfasteners.com': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (Aberdeen / GMT/BST)' },
  'harclo.com': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)' },
  'jetpress.com': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (Nottingham / GMT/BST)' },
  'apexstainless.com': { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (Leicester / GMT/BST)' },
  'centuryfasteners.ie': { country: 'Ireland', flag: '🇮🇪', timeZone: 'Europe/Dublin', label: 'Ireland (Dublin / IST)' },
};

/**
 * Popular business timezones list for manual selector
 */
export const POPULAR_TIMEZONES = [
  { timeZone: 'Europe/London', label: 'United Kingdom (London)', flag: '🇬🇧' },
  { timeZone: 'Europe/Dublin', label: 'Ireland (Dublin)', flag: '🇮🇪' },
  { timeZone: 'Europe/Amsterdam', label: 'Netherlands (Amsterdam)', flag: '🇳🇱' },
  { timeZone: 'Europe/Berlin', label: 'Germany (Berlin / Frankfurt)', flag: '🇩🇪' },
  { timeZone: 'Europe/Paris', label: 'France (Paris)', flag: '🇫🇷' },
  { timeZone: 'Europe/Rome', label: 'Italy (Rome / Milan)', flag: '🇮🇹' },
  { timeZone: 'Europe/Madrid', label: 'Spain (Madrid / Barcelona)', flag: '🇪🇸' },
  { timeZone: 'America/New_York', label: 'US Eastern (New York / Miami)', flag: '🇺🇸' },
  { timeZone: 'America/Chicago', label: 'US Central (Chicago / Dallas)', flag: '🇺🇸' },
  { timeZone: 'America/Denver', label: 'US Mountain (Denver / Phoenix)', flag: '🇺🇸' },
  { timeZone: 'America/Los_Angeles', label: 'US Pacific (Los Angeles / Seattle)', flag: '🇺🇸' },
  { timeZone: 'America/Toronto', label: 'Canada (Toronto / Montreal)', flag: '🇨🇦' },
  { timeZone: 'Asia/Dubai', label: 'UAE (Dubai / Abu Dhabi)', flag: '🇦🇪' },
  { timeZone: 'Asia/Riyadh', label: 'Saudi Arabia (Riyadh)', flag: '🇸🇦' },
  { timeZone: 'Asia/Singapore', label: 'Singapore', flag: '🇸🇬' },
  { timeZone: 'Asia/Tokyo', label: 'Japan (Tokyo)', flag: '🇯🇵' },
  { timeZone: 'Asia/Shanghai', label: 'China (Shanghai / Beijing)', flag: '🇨🇳' },
  { timeZone: 'Australia/Sydney', label: 'Australia (Sydney / Melbourne)', flag: '🇦🇺' },
  { timeZone: 'Pacific/Auckland', label: 'New Zealand (Auckland)', flag: '🇳🇿' },
  { timeZone: 'Africa/Johannesburg', label: 'South Africa (Johannesburg)', flag: '🇿🇦' },
  { timeZone: 'Asia/Kolkata', label: 'India (IST / Mumbai / Delhi)', flag: '🇮🇳' },
  { timeZone: 'UTC', label: 'UTC (Universal Coordinated Time)', flag: '🌐' }
];

/**
 * Detects recipient's country and timezone based on email address
 */
export function detectRecipientTimezone(email) {
  if (!email || typeof email !== 'string') {
    return { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)', isDetected: false };
  }

  const cleanEmail = email.toLowerCase().trim();
  const atIdx = cleanEmail.lastIndexOf('@');
  if (atIdx === -1) {
    return { country: 'United Kingdom', flag: '🇬🇧', timeZone: 'Europe/London', label: 'UK (London / GMT/BST)', isDetected: false };
  }

  const domain = cleanEmail.slice(atIdx + 1);

  // 1. Check direct domain override
  if (DOMAIN_OVERRIDES[domain]) {
    return { ...DOMAIN_OVERRIDES[domain], isDetected: true };
  }

  // 2. Check compound ccTLD (e.g., .co.uk, .com.au, .co.nz)
  const parts = domain.split('.');
  if (parts.length >= 3) {
    const compoundTld = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (CCTLD_TIMEZONE_MAP[compoundTld]) {
      return { ...CCTLD_TIMEZONE_MAP[compoundTld], isDetected: true };
    }
  }

  // 3. Check simple ccTLD (e.g. .uk, .de, .fr, .nl, .ie)
  const simpleTld = parts[parts.length - 1];
  if (CCTLD_TIMEZONE_MAP[simpleTld]) {
    return { ...CCTLD_TIMEZONE_MAP[simpleTld], isDetected: true };
  }

  // Fallback for general .com domains: default to UK as standard European industrial reference
  return {
    country: 'International (UK default)',
    flag: '🇬🇧',
    timeZone: 'Europe/London',
    label: 'UK (London / GMT/BST)',
    isDetected: false
  };
}

/**
 * Formats a date in a specific IANA timezone
 */
export function formatInTimezone(dateString, timeZone, options = {}) {
  const d = parseDate(dateString);
  if (!d) return '—';

  try {
    const defaultOptions = {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
      timeZone,
      ...options
    };
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(d);
  } catch (err) {
    // If invalid timeZone, fallback to standard local formatting
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  }
}

/**
 * Calculates time difference between user's browser timezone and target timezone
 */
export function getTimeDifference(dateString, targetTimeZone) {
  const d = parseDate(dateString) || new Date();
  const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  function getOffsetMinutes(date, tz) {
    try {
      const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
      const tzDate = new Date(date.toLocaleString('en-US', { timeZone: tz }));
      return (tzDate.getTime() - utcDate.getTime()) / 60000;
    } catch (e) {
      return 0;
    }
  }

  const userOffset = getOffsetMinutes(d, userTz);
  const targetOffset = getOffsetMinutes(d, targetTimeZone);
  const diffMinutes = targetOffset - userOffset;

  if (diffMinutes === 0) {
    return { diffMinutes: 0, text: 'Same time as you', isAhead: false, isBehind: false };
  }

  const absM = Math.abs(diffMinutes) % 60;
  const absH = Math.floor(Math.abs(diffMinutes) / 60);

  const parts = [];
  if (absH > 0) parts.push(`${absH}h`);
  if (absM > 0) parts.push(`${absM}m`);
  const timeStr = parts.join(' ');

  if (diffMinutes < 0) {
    return { diffMinutes, text: `${timeStr} behind you`, isAhead: false, isBehind: true };
  } else {
    return { diffMinutes, text: `${timeStr} ahead of you`, isAhead: true, isBehind: false };
  }
}

export const getRecipientCountryInfo = detectRecipientTimezone;

