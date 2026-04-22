import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { computeDayAvailability, generateDateRange, todayStr } from "@/lib/schedule-logic";

export async function GET() {
  const db = getServiceClient();
  const today = todayStr();

  // Fetch next 42 days of schedule data
  const dates = generateDateRange(today, 21);
  const { data: scheduleRows } = await db
    .from("work_schedule")
    .select("date, shift_start, shift_end")
    .in("date", dates);

  // Fetch booked job counts per date
  const { data: bookingRows } = await db
    .from("bookings")
    .select("preferred_date")
    .in("preferred_date", dates)
    .in("status", ["pending", "confirmed"]);

  const scheduleMap: Record<string, { shift_start: string | null; shift_end: string | null }> = {};
  for (const row of scheduleRows ?? []) {
    scheduleMap[row.date] = { shift_start: row.shift_start, shift_end: row.shift_end };
  }

  const bookedCount: Record<string, number> = {};
  for (const row of bookingRows ?? []) {
    bookedCount[row.preferred_date] = (bookedCount[row.preferred_date] ?? 0) + 1;
  }

  const available = dates
    .map((date) => {
      const s = scheduleMap[date];
      const avail = computeDayAvailability(date, s?.shift_start ?? null, s?.shift_end ?? null);
      const booked = bookedCount[date] ?? 0;
      const remaining = Math.max(0, avail.jobsAllowed - booked);
      return { date, dayOfWeek: avail.dayOfWeek, jobsAllowed: avail.jobsAllowed, slotsRemaining: remaining, slots: avail.slots };
    })
    .filter((d) => d.slotsRemaining > 0);

  return NextResponse.json(available);
}
