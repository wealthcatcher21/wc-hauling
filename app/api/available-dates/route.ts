import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { computeDayAvailability, generateDateRange, todayStr } from "@/lib/schedule-logic";

export async function GET() {
  const db = getServiceClient();

  // Start 2 days from today — no same-day or next-day bookings
  const startDate = (() => {
    const d = new Date(todayStr() + "T00:00:00");
    d.setDate(d.getDate() + 2);
    return d.toISOString().split("T")[0];
  })();

  const dates = generateDateRange(startDate, 14);

  const { data: scheduleRows } = await db
    .from("work_schedule")
    .select("date, shift_start, shift_end")
    .in("date", dates);

  // Fetch booked jobs with their specific time slots
  const { data: bookingRows } = await db
    .from("bookings")
    .select("preferred_date, time_slot")
    .in("preferred_date", dates)
    .in("status", ["pending", "confirmed"]);

  const scheduleMap: Record<string, { shift_start: string | null; shift_end: string | null }> = {};
  for (const row of scheduleRows ?? []) {
    scheduleMap[row.date] = { shift_start: row.shift_start, shift_end: row.shift_end };
  }

  // Track booked specific slots and no-preference bookings per date
  const bookedSpecific: Record<string, string[]> = {};
  const bookedFlexible: Record<string, number> = {};

  for (const row of bookingRows ?? []) {
    const date = row.preferred_date;
    if (row.time_slot) {
      if (!bookedSpecific[date]) bookedSpecific[date] = [];
      bookedSpecific[date].push(row.time_slot);
    } else {
      bookedFlexible[date] = (bookedFlexible[date] ?? 0) + 1;
    }
  }

  const available = dates
    .map((date) => {
      const s = scheduleMap[date];
      const avail = computeDayAvailability(date, s?.shift_start ?? null, s?.shift_end ?? null);

      if (avail.jobsAllowed === 0) return null;

      // Remove specifically booked time slots
      let remainingSlots = avail.slots.filter(
        (slot) => !(bookedSpecific[date] ?? []).includes(slot)
      );

      // Remove slots for flexible/no-preference bookings (consume from front)
      const flexCount = bookedFlexible[date] ?? 0;
      remainingSlots = remainingSlots.slice(flexCount);

      if (remainingSlots.length === 0) return null;

      return {
        date,
        dayOfWeek: avail.dayOfWeek,
        slotsRemaining: remainingSlots.length,
        slots: remainingSlots,
      };
    })
    .filter(Boolean);

  return NextResponse.json(available);
}
