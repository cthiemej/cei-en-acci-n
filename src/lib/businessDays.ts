/**
 * Chilean business days calculator.
 * Excludes weekends and Chilean fixed holidays.
 * Easter (Viernes Santo / Sábado Santo) is calculated dynamically.
 */

function getEasterDate(year: number): Date {
  // Anonymous Gregorian algorithm
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getChileanHolidays(year: number): Set<string> {
  const holidays = new Set<string>();
  const add = (m: number, d: number) => {
    holidays.add(`${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };

  // Fixed holidays
  add(1, 1);   // Año Nuevo
  add(5, 1);   // Día del Trabajo
  add(5, 21);  // Glorias Navales
  add(6, 20);  // Día de los Pueblos Indígenas
  add(7, 16);  // Virgen del Carmen
  add(8, 15);  // Asunción de la Virgen
  add(9, 18);  // Fiestas Patrias
  add(9, 19);  // Glorias del Ejército
  add(10, 12); // Encuentro de Dos Mundos
  add(10, 31); // Día de las Iglesias Evangélicas
  add(11, 1);  // Todos los Santos
  add(12, 25); // Navidad

  // Easter-based holidays (Viernes Santo & Sábado Santo)
  const easter = getEasterDate(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const holySaturday = new Date(easter);
  holySaturday.setDate(easter.getDate() - 1);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  holidays.add(fmt(goodFriday));
  holidays.add(fmt(holySaturday));

  return holidays;
}

function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Cache holidays per year
const holidayCache = new Map<number, Set<string>>();
function getHolidays(year: number): Set<string> {
  if (!holidayCache.has(year)) {
    holidayCache.set(year, getChileanHolidays(year));
  }
  return holidayCache.get(year)!;
}

function isBusinessDay(d: Date): boolean {
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return false;
  return !getHolidays(d.getFullYear()).has(formatDateKey(d));
}

/**
 * Add N business days to a date.
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    if (isBusinessDay(result)) added++;
  }
  return result;
}

/**
 * Count business days remaining between today and a future date.
 * Returns negative if the date is in the past.
 */
export function businessDaysRemaining(deadline: Date, from?: Date): number {
  const today = from ?? new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);

  if (target.getTime() === today.getTime()) return 0;

  const isPast = target < today;
  const start = isPast ? target : today;
  const end = isPast ? today : target;

  let count = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (isBusinessDay(cursor)) count++;
  }

  return isPast ? -count : count;
}
