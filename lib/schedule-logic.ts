export type DayType = "off" | "early-shift" | "late-shift" | "closed";

export interface DayAvailability {
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  dayType: DayType;
  jobsAllowed: number;
  slots: string[]; // e.g. ["7:00 AM", "11:30 AM"]
  shiftStart: string | null;
  shiftEnd: string | null;
}

// Rules from operating blueprint:
// - Sunday: always closed
// - Off day (no shift): weekday = 2 jobs (7AM + 11:30AM), Saturday = 1 job (7AM only)
// - Early shift (starts before 10:00 AM): 0 jobs
// - Late shift (starts 12:00 PM or later): 1 job (7AM slot before shift)
// - Between 10AM–11:59AM start: treated as early shift, 0 jobs

const EARLY_CUTOFF = "10:00";
const LATE_MIN = "12:00";
const SLOT_1 = "7:00 AM";
const SLOT_2 = "11:30 AM";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function computeDayAvailability(
  dateStr: string,
  shiftStart: string | null,
  shiftEnd: string | null
): DayAvailability {
  const date = new Date(dateStr + "T00:00:00");
  const dow = date.getDay(); // 0=Sun, 6=Sat
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = dayNames[dow];

  // Sunday always closed
  if (dow === 0) {
    return { date: dateStr, dayOfWeek, dayType: "closed", jobsAllowed: 0, slots: [], shiftStart, shiftEnd };
  }

  // No shift entered = off day
  if (!shiftStart) {
    if (dow === 6) {
      // Saturday
      return { date: dateStr, dayOfWeek, dayType: "off", jobsAllowed: 1, slots: [SLOT_1], shiftStart, shiftEnd };
    }
    return { date: dateStr, dayOfWeek, dayType: "off", jobsAllowed: 2, slots: [SLOT_1, SLOT_2], shiftStart, shiftEnd };
  }

  const shiftMinutes = timeToMinutes(shiftStart);
  const earlyMinutes = timeToMinutes(EARLY_CUTOFF);
  const lateMinutes = timeToMinutes(LATE_MIN);

  if (shiftMinutes < earlyMinutes) {
    return { date: dateStr, dayOfWeek, dayType: "early-shift", jobsAllowed: 0, slots: [], shiftStart, shiftEnd };
  }

  if (shiftMinutes >= lateMinutes) {
    return { date: dateStr, dayOfWeek, dayType: "late-shift", jobsAllowed: 1, slots: [SLOT_1], shiftStart, shiftEnd };
  }

  // Between 10AM and noon: treat as early, no jobs
  return { date: dateStr, dayOfWeek, dayType: "early-shift", jobsAllowed: 0, slots: [], shiftStart, shiftEnd };
}

export function generateDateRange(startDate: string, days: number): string[] {
  const dates: string[] = [];
  const start = new Date(startDate + "T00:00:00");
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
