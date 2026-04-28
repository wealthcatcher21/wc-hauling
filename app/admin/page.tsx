"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { computeDayAvailability, generateDateRange, todayStr } from "@/lib/schedule-logic";

interface ScheduleRow {
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  notes: string | null;
}

interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  service_address: string;
  load_size: string;
  preferred_date: string;
  time_slot: string | null;
  description: string | null;
  status: string;
  gross_revenue: number | null;
  notes: string | null;
  junk_location: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-100",
};

const LOAD_NET: Record<string, number> = {
  "Half Load – $400": 179,
  "Three-Quarter Load – $550": 287,
  "Full Load – $800": 468,
};

const LOAD_GROSS: Record<string, number> = {
  "Half Load – $400": 400,
  "Three-Quarter Load – $550": 550,
  "Full Load – $800": 800,
};

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [tab, setTab] = useState<"schedule" | "bookings" | "analytics">("schedule");

  // Schedule state
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleRow>>({});
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editShiftStart, setEditShiftStart] = useState("");
  const [editShiftEnd, setEditShiftEnd] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingSchedule, setSavingSchedule] = useState(false);

  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [updatingBooking, setUpdatingBooking] = useState<string | null>(null);
  const [mileageMap, setMileageMap] = useState<Record<string, { estimatedMiles: number; mileageCost: number } | "error" | "loading">>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newBookingAlert, setNewBookingAlert] = useState(false);
  const prevPendingCount = useRef<number | null>(null);

  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  const loadSchedule = useCallback(async () => {
    const res = await fetch("/api/schedule", { headers });
    const data = await res.json();
    if (Array.isArray(data)) {
      const map: Record<string, ScheduleRow> = {};
      for (const row of data) map[row.date] = row;
      setScheduleMap(map);
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadBookings = useCallback(async (silent = false) => {
    if (!silent) setLoadingBookings(true);
    const res = await fetch("/api/bookings", { headers });
    const data = await res.json();
    if (Array.isArray(data)) {
      const newPending = data.filter((b: Booking) => b.status === "pending").length;
      if (prevPendingCount.current !== null && newPending > prevPendingCount.current) {
        setNewBookingAlert(true);
      }
      prevPendingCount.current = newPending;
      setBookings(data);
      setLastUpdated(new Date());
      // Auto-fetch mileage estimates for new non-cancelled bookings
      for (const b of data) {
        if (b.status !== "cancelled" && b.service_address) {
          setMileageMap((prev) => {
            if (prev[b.id] && prev[b.id] !== "error") return prev;
            fetch("/api/estimate-mileage", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ address: b.service_address }),
            })
              .then((r) => r.json())
              .then((m) => {
                if (m.estimatedMiles) setMileageMap((p) => ({ ...p, [b.id]: { estimatedMiles: m.estimatedMiles, mileageCost: m.mileageCost } }));
                else setMileageMap((p) => ({ ...p, [b.id]: "error" }));
              })
              .catch(() => setMileageMap((p) => ({ ...p, [b.id]: "error" })));
            return { ...prev, [b.id]: "loading" };
          });
        }
      }
    }
    if (!silent) setLoadingBookings(false);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authed) return;
    loadSchedule();
    loadBookings();
    const interval = setInterval(() => loadBookings(true), 30000);
    return () => clearInterval(interval);
  }, [authed, loadSchedule, loadBookings]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/schedule", { headers: { "x-admin-token": token } });
    if (res.ok) { setAuthed(true); setLoginError(""); }
    else setLoginError("Incorrect password. Try again.");
  }

  function openEdit(date: string) {
    const row = scheduleMap[date];
    setEditingDate(date);
    setEditShiftStart(row?.shift_start ?? "");
    setEditShiftEnd(row?.shift_end ?? "");
    setEditNotes(row?.notes ?? "");
  }

  async function saveScheduleDay() {
    if (!editingDate) return;
    setSavingSchedule(true);
    await fetch("/api/schedule", {
      method: "POST",
      headers,
      body: JSON.stringify({ date: editingDate, shift_start: editShiftStart || null, shift_end: editShiftEnd || null, notes: editNotes || null }),
    });
    await loadSchedule();
    setEditingDate(null);
    setSavingSchedule(false);
  }

  async function clearScheduleDay(date: string) {
    await fetch("/api/schedule", { method: "DELETE", headers, body: JSON.stringify({ date }) });
    await loadSchedule();
    setEditingDate(null);
  }

  async function updateBooking(id: string, updates: Partial<Booking>) {
    setUpdatingBooking(id);
    await fetch("/api/bookings", { method: "PATCH", headers, body: JSON.stringify({ id, ...updates }) });
    await loadBookings();
    setUpdatingBooking(null);
  }

  async function deleteBooking(id: string, name: string) {
    if (!confirm(`Permanently delete booking for ${name}? This cannot be undone.`)) return;
    setUpdatingBooking(id);
    await fetch("/api/bookings", { method: "DELETE", headers, body: JSON.stringify({ id }) });
    await loadBookings();
    setUpdatingBooking(null);
  }

  const dates = generateDateRange(todayStr(), 21);

  // Analytics
  const completedBookings = bookings.filter((b) => b.status === "completed");
  const totalGross = completedBookings.reduce((s, b) => s + (b.gross_revenue ?? 0), 0);
  const estimatedNet = completedBookings.reduce((s, b) => s + (LOAD_NET[b.load_size] ?? 0), 0);
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center mb-2">WC Hauling Polk Admin</h1>
          <p className="text-gray-500 text-center text-sm mb-8">Enter your admin password to continue</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" required value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="Admin password" autoFocus
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500" />
            {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <span className="font-bold text-lg">WC Hauling Polk Admin</span>
            <span className="text-green-400 text-sm ml-3">● Live</span>
            {lastUpdated && (
              <span className="text-gray-400 text-xs ml-3">Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            )}
          </div>
          <div className="flex gap-2 text-sm">
            <span className="bg-yellow-500 text-black px-3 py-1 rounded-full font-semibold">{pendingCount} Pending</span>
            <span className="bg-blue-500 text-white px-3 py-1 rounded-full font-semibold">{confirmedCount} Confirmed</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 flex">
          {(["schedule", "bookings", "analytics"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-6 py-4 text-sm font-semibold capitalize border-b-2 transition-colors ${tab === t ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t} {t === "bookings" && bookings.length > 0 ? `(${bookings.length})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">

        {newBookingAlert && (
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
            <span className="text-yellow-800 font-semibold">🔔 New booking request received!</span>
            <button onClick={() => { setNewBookingAlert(false); setTab("bookings"); }}
              className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold text-sm px-4 py-2 rounded-lg transition-colors">
              View Bookings
            </button>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {tab === "schedule" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold">3-Week Schedule</h2>
                <p className="text-sm text-gray-500 mt-1">Showing the next 21 days. Update when your employer releases the next week&apos;s schedule.</p>
              </div>
            </div>

            <div className="grid gap-3">
              {dates.map((date) => {
                const row = scheduleMap[date];
                const avail = computeDayAvailability(date, row?.shift_start ?? null, row?.shift_end ?? null);
                const isEditing = editingDate === date;
                const dayColors: Record<string, string> = {
                  off: "border-green-200 bg-green-50",
                  "late-shift": "border-blue-200 bg-blue-50",
                  "early-shift": "border-orange-200 bg-orange-50",
                  closed: "border-gray-200 bg-gray-50",
                };
                const badgeColors: Record<string, string> = {
                  off: "bg-green-600 text-white",
                  "late-shift": "bg-blue-600 text-white",
                  "early-shift": "bg-orange-500 text-white",
                  closed: "bg-gray-400 text-white",
                };
                const labels: Record<string, string> = {
                  off: `Off Day – ${avail.jobsAllowed} job${avail.jobsAllowed !== 1 ? "s" : ""} allowed`,
                  "late-shift": "Late Shift – 1 job allowed",
                  "early-shift": "Early Shift – No jobs",
                  closed: "Closed (Sunday)",
                };

                return (
                  <div key={date} className={`border-2 rounded-xl p-4 ${dayColors[avail.dayType]}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-800 w-36">{formatDate(date)}</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${badgeColors[avail.dayType]}`}>{labels[avail.dayType]}</span>
                        {avail.slots.length > 0 && (
                          <span className="text-xs text-gray-500">Slots: {avail.slots.join(", ")}</span>
                        )}
                        {row?.shift_start && (
                          <span className="text-xs text-gray-500">Work: {row.shift_start} – {row.shift_end}</span>
                        )}
                      </div>
                      {avail.dayType !== "closed" && (
                        <button onClick={() => isEditing ? setEditingDate(null) : openEdit(date)}
                          className="text-sm font-semibold text-green-700 hover:underline">
                          {isEditing ? "Cancel" : "Edit"}
                        </button>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <p className="text-sm font-semibold text-gray-600 mb-3">
                          Enter your work shift (leave blank if this is your day off)
                        </p>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-xs font-semibold mb-1">Shift Start</label>
                            <input type="time" value={editShiftStart} onChange={(e) => setEditShiftStart(e.target.value)}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold mb-1">Shift End</label>
                            <input type="time" value={editShiftEnd} onChange={(e) => setEditShiftEnd(e.target.value)}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <div className="flex-1 min-w-48">
                            <label className="block text-xs font-semibold mb-1">Notes (optional)</label>
                            <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="e.g. double shift"
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                          </div>
                          <button onClick={saveScheduleDay} disabled={savingSchedule}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2 rounded-lg text-sm transition-colors disabled:opacity-60">
                            {savingSchedule ? "Saving..." : "Save"}
                          </button>
                          {row?.shift_start && (
                            <button onClick={() => clearScheduleDay(date)}
                              className="border border-red-300 text-red-600 hover:bg-red-50 font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
                              Set as Off Day
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-3">
                          Rules: Shift starts before 10 AM = no jobs. Shift starts at noon or later = 1 job (7 AM). No shift = full availability.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOOKINGS TAB */}
        {tab === "bookings" && (
          <div>
            {/* Dump reference panel */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6 flex flex-wrap gap-6 items-start">
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Dump Site</p>
                <p className="font-bold text-gray-800">North Central Transfer Station</p>
                <p className="text-sm text-gray-600">3131 K-Ville Ave, Auburndale, FL 33823</p>
              </div>
              <div>
                <p className="text-xs font-bold text-blue-500 uppercase tracking-widest mb-1">Hours</p>
                <p className="text-sm text-gray-700">Mon–Fri: 8:00 AM – 4:00 PM</p>
                <p className="text-sm text-gray-700">Saturday: 7:30 AM – 12:30 PM</p>
              </div>
              <div>
                <p className="text-xs font-bold text-red-500 uppercase tracking-widest mb-1">Will NOT Accept</p>
                <p className="text-sm text-gray-600">Bulk liquids · Pressurized tanks · Ammo/Explosives · Biological waste · Asbestos · Radioactive waste</p>
              </div>
            </div>

            <h2 className="text-xl font-bold mb-4">All Booking Requests</h2>
            {(() => {
              const slotCounts: Record<string, number> = {};
              for (const b of bookings) {
                if (b.status === "pending" || b.status === "confirmed") {
                  const key = `${b.preferred_date}|${b.time_slot ?? "no-pref"}`;
                  slotCounts[key] = (slotCounts[key] ?? 0) + 1;
                }
              }
              const overlapKeys = new Set(Object.entries(slotCounts).filter(([, v]) => v > 1).map(([k]) => k));
              if (overlapKeys.size > 0) {
                return (
                  <div className="bg-red-50 border-2 border-red-400 rounded-xl px-5 py-4 mb-5 text-red-800 font-semibold text-sm">
                    ⚠️ Scheduling conflict detected — two or more active bookings share the same date and time slot. Review the flagged jobs below before confirming.
                  </div>
                );
              }
            })()}
            {loadingBookings ? (
              <p className="text-gray-500">Loading...</p>
            ) : bookings.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-semibold">No bookings yet</p>
                <p className="text-sm mt-2">Once customers submit requests, they&apos;ll appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {(() => {
                  const slotCounts2: Record<string, number> = {};
                  for (const bk of bookings) {
                    if (bk.status === "pending" || bk.status === "confirmed") {
                      const k = `${bk.preferred_date}|${bk.time_slot ?? "no-pref"}`;
                      slotCounts2[k] = (slotCounts2[k] ?? 0) + 1;
                    }
                  }
                  const overlapSet = new Set(Object.entries(slotCounts2).filter(([, v]) => v > 1).map(([k]) => k));
                  return [...bookings].sort((a, b) => {
                    const order: Record<string, number> = { confirmed: 0, pending: 1, completed: 2, cancelled: 3 };
                    const statusDiff = (order[a.status] ?? 9) - (order[b.status] ?? 9);
                    if (statusDiff !== 0) return statusDiff;
                    return a.preferred_date.localeCompare(b.preferred_date);
                  }).map((b) => {
                  const isOverlap = (b.status === "pending" || b.status === "confirmed") && overlapSet.has(`${b.preferred_date}|${b.time_slot ?? "no-pref"}`);
                  const isSaturday = new Date(b.preferred_date + "T00:00:00").getDay() === 6;
                  const mileage = mileageMap[b.id];
                  return (
                    <div key={b.id} className={`bg-white rounded-2xl p-6 shadow-sm ${isOverlap ? "border-2 border-red-400" : "border border-gray-200"}`}>
                      {isOverlap && (
                        <div className="bg-red-50 border border-red-300 rounded-xl px-4 py-2 mb-4 text-sm text-red-800 font-semibold">
                          ⚠️ Conflict — another active booking is on this same date and time. Do not confirm both.
                        </div>
                      )}
                      {/* Not Sure load size warning */}
                      {b.load_size === "Not Sure" && b.status !== "cancelled" && b.status !== "completed" && (
                        <div className="bg-orange-50 border border-orange-300 rounded-xl px-4 py-2 mb-4 text-sm text-orange-800 font-semibold">
                          📞 Load size not confirmed — call customer to determine price before confirming this booking.
                        </div>
                      )}
                      {/* Saturday dump warning */}
                      {isSaturday && b.status !== "cancelled" && (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 mb-4 text-sm text-orange-800 font-semibold">
                          Saturday job — dump closes at 12:30 PM. Ensure haul is done before noon.
                        </div>
                      )}

                      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                        <div>
                          <h3 className="font-bold text-lg">{b.customer_name}</h3>
                          <p className="text-gray-500 text-sm">{formatDate(b.preferred_date)} {b.time_slot ? `@ ${b.time_slot}` : ""}</p>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase ${STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {b.status}
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-2 text-sm mb-4">
                        <p><span className="font-semibold">Phone:</span> <a href={`tel:${b.customer_phone}`} className="text-green-700 underline">{b.customer_phone}</a></p>
                        {b.customer_email && <p><span className="font-semibold">Email:</span> {b.customer_email}</p>}
                        <p><span className="font-semibold">Address:</span> {b.service_address}</p>
                        <p><span className="font-semibold">Load:</span> {b.load_size}</p>
                        {b.junk_location && <p><span className="font-semibold">Location:</span> {b.junk_location}</p>}
                        {b.description && <p className="sm:col-span-2"><span className="font-semibold">Details:</span> {b.description}</p>}
                      </div>

                      {/* Mileage estimate */}
                      {b.status !== "cancelled" && (
                        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-4 text-sm">
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Est. Miles (to dump + back)</p>
                            {mileage === "loading" && <p className="text-gray-400">Calculating...</p>}
                            {mileage === "error" && <p className="text-red-400">Could not estimate — verify address</p>}
                            {mileage && mileage !== "loading" && mileage !== "error" && (
                              <p className="font-bold text-gray-800">{mileage.estimatedMiles} mi</p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Mileage Cost @ $1.19/mi</p>
                            {mileage && mileage !== "loading" && mileage !== "error" ? (
                              <p className="font-bold text-red-600">-${mileage.mileageCost}</p>
                            ) : <p className="text-gray-400">—</p>}
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">Note</p>
                            <p className="text-gray-400 text-xs">Estimate only. Verify with Google Maps before job day.</p>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 items-center pt-3 border-t border-gray-100">
                        {b.status === "pending" && (
                          <button onClick={() => updateBooking(b.id, { status: "confirmed" })}
                            disabled={updatingBooking === b.id}
                            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60">
                            Confirm Job
                          </button>
                        )}
                        {b.status === "confirmed" && (() => {
                          const defaultGross = LOAD_GROSS[b.load_size] ?? 0;
                          const eqKey = `eq-${b.id}`;
                          const EQUIPMENT = [
                            { label: "Utility Dolly", price: 7 },
                            { label: "Appliance Dolly", price: 10 },
                            { label: "Furniture Dolly", price: 7 },
                          ];
                          return (
                            <div className="w-full space-y-3 pt-1">
                              <div className="flex flex-wrap gap-4 items-end">
                                <div className="flex flex-col">
                                  <label className="text-xs text-gray-400 mb-1">Amount collected (override if different)</label>
                                  <input type="number" min={0} defaultValue={defaultGross} id={`gross-${b.id}`}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-500" />
                                </div>
                              </div>
                              <div>
                                <p className="text-xs text-gray-400 font-semibold mb-2">Equipment rented? (check all that apply)</p>
                                <div className="flex flex-wrap gap-3">
                                  {EQUIPMENT.map((eq) => (
                                    <label key={eq.label} className="flex items-center gap-2 text-sm cursor-pointer bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-100">
                                      <input type="checkbox" data-eq-group={eqKey} data-price={eq.price}
                                        className="h-4 w-4 rounded text-green-600" />
                                      <span>{eq.label} <span className="text-red-500 font-semibold">${eq.price}</span></span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  const grossInput = document.getElementById(`gross-${b.id}`) as HTMLInputElement;
                                  const gross = Number(grossInput?.value) || defaultGross;
                                  const boxes = document.querySelectorAll<HTMLInputElement>(`[data-eq-group="${eqKey}"]:checked`);
                                  const eqCost = Array.from(boxes).reduce((s, el) => s + Number(el.dataset.price ?? 0), 0);
                                  const notes = eqCost > 0 ? `eq:${eqCost}` : undefined;
                                  updateBooking(b.id, { status: "completed", gross_revenue: gross, ...(notes ? { notes } : {}) });
                                }}
                                disabled={updatingBooking === b.id}
                                className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
                                Mark Complete
                              </button>
                            </div>
                          );
                        })()}
                        {b.status !== "cancelled" && b.status !== "completed" && (
                          <button onClick={() => updateBooking(b.id, { status: "cancelled" })}
                            disabled={updatingBooking === b.id}
                            className="border border-red-300 text-red-600 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60">
                            Cancel
                          </button>
                        )}
                        {b.gross_revenue && (
                          <span className="text-green-700 font-bold text-sm ml-auto">Gross: ${b.gross_revenue} → Est. net: ~${LOAD_NET[b.load_size] ?? "?"}</span>
                        )}
                        <button onClick={() => deleteBooking(b.id, b.customer_name)}
                          disabled={updatingBooking === b.id}
                          className="ml-auto text-xs text-gray-300 hover:text-red-500 transition-colors disabled:opacity-40 underline">
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (() => {
          // Group completed bookings by date to split shared daily costs
          const jobsPerDay: Record<string, number> = {};
          for (const b of completedBookings) {
            jobsPerDay[b.preferred_date] = (jobsPerDay[b.preferred_date] ?? 0) + 1;
          }

          // Per-job cost breakdown
          const jobCosts = completedBookings.map((b) => {
            const gross = b.gross_revenue ?? 0;
            const jobsToday = jobsPerDay[b.preferred_date] ?? 1;
            const helper    = Math.round(gross * 0.25 * 100) / 100;
            const cardFee   = Math.round((gross * 0.026 + 0.15) * 100) / 100;
            const truck     = Math.round((55.62 / jobsToday) * 100) / 100;
            const gas       = Math.round(((jobsToday > 1 ? 50 : 30) / jobsToday) * 100) / 100;
            const dump      = Math.round(((jobsToday > 1 ? 50 : 25) / jobsToday) * 100) / 100;
            const mileEst   = mileageMap[b.id];
            const mileage   = (mileEst && mileEst !== "loading" && mileEst !== "error") ? mileEst.mileageCost : null;
            const equipment = b.notes?.startsWith("eq:") ? Number(b.notes.slice(3)) : 0;
            const totalCost = helper + cardFee + truck + gas + dump + (mileage ?? 0) + equipment;
            const net       = Math.round((gross - totalCost) * 100) / 100;
            return { ...b, helper, cardFee, truck, gas, dump, mileage, equipment, totalCost, net };
          });

          const totalCosts = {
            helper:    jobCosts.reduce((s, j) => s + j.helper, 0),
            cardFee:   jobCosts.reduce((s, j) => s + j.cardFee, 0),
            truck:     jobCosts.reduce((s, j) => s + j.truck, 0),
            gas:       jobCosts.reduce((s, j) => s + j.gas, 0),
            dump:      jobCosts.reduce((s, j) => s + j.dump, 0),
            mileage:   jobCosts.reduce((s, j) => s + (j.mileage ?? 0), 0),
            equipment: jobCosts.reduce((s, j) => s + j.equipment, 0),
          };
          const totalAllCosts = Object.values(totalCosts).reduce((a, b) => a + b, 0);
          const totalNet = jobCosts.reduce((s, j) => s + j.net, 0);
          const r = (n: number) => `$${Math.round(n * 100) / 100}`;

          return (
            <div>
              <h2 className="text-xl font-bold mb-6">Revenue Tracker</h2>

              {/* Summary cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: "Completed Jobs", value: completedBookings.length.toString(), color: "green" },
                  { label: "Total Gross", value: r(totalGross), color: "blue" },
                  { label: "Total Net", value: r(totalNet), color: "green" },
                  { label: "Jobs to $5K/mo", value: String(Math.max(0, Math.ceil((5000 - totalNet) / 287))), color: totalNet >= 5000 ? "green" : "yellow" },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                    <p className="text-gray-500 text-sm mb-1">{s.label}</p>
                    <p className={`text-3xl font-extrabold ${s.color === "green" ? "text-green-700" : s.color === "blue" ? "text-blue-700" : "text-yellow-600"}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              {completedBookings.length === 0 ? (
                <p className="text-gray-400 text-sm">No completed jobs yet. Mark jobs as complete in the Bookings tab.</p>
              ) : (
                <>
                  {/* Cost breakdown summary */}
                  <h3 className="font-bold text-lg mb-3">Where the Money Goes</h3>
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mb-8">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                      {[
                        { label: "Helper (25%)", value: totalCosts.helper, note: "25% of gross per job" },
                        { label: "Truck Rental", value: totalCosts.truck, note: "$55/day split by jobs" },
                        { label: "Gas", value: totalCosts.gas, note: "$30–$50/day split by jobs" },
                        { label: "Dump Fees", value: totalCosts.dump, note: "$25–$50/day split by jobs" },
                        { label: "Mileage", value: totalCosts.mileage, note: "$1.19/mi est. to dump + back" },
                        { label: "Card Fees", value: totalCosts.cardFee, note: "2.6% + $0.15 per job" },
                        { label: "Equipment Rental", value: totalCosts.equipment, note: "Dollies rented per job" },
                      ].map((c) => (
                        <div key={c.label} className="bg-gray-50 rounded-xl p-4">
                          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{c.label}</p>
                          <p className="text-2xl font-extrabold text-red-600">{r(c.value)}</p>
                          <p className="text-xs text-gray-400 mt-1">{c.note}</p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-6 pt-4 border-t border-gray-100 text-sm font-semibold">
                      <span>Total Gross: <span className="text-blue-700">{r(totalGross)}</span></span>
                      <span>Total Costs: <span className="text-red-600">-{r(totalAllCosts)}</span></span>
                      <span>Total Net: <span className="text-green-700">{r(totalNet)}</span></span>
                      <span className="text-gray-400">Margin: {totalGross > 0 ? Math.round((totalNet / totalGross) * 100) : 0}%</span>
                    </div>
                  </div>

                  {/* Per-job itemized table */}
                  <h3 className="font-bold text-lg mb-3">Per-Job Itemized Costs</h3>
                  <div className="overflow-x-auto">
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm min-w-[860px]">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-3 text-left font-semibold">Date</th>
                            <th className="px-3 py-3 text-left font-semibold">Customer</th>
                            <th className="px-3 py-3 text-right font-semibold text-blue-700">Gross</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Helper</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Truck</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Gas</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Dump</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Mileage</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Card</th>
                            <th className="px-3 py-3 text-right font-semibold text-red-500">Equip.</th>
                            <th className="px-3 py-3 text-right font-semibold text-green-700">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobCosts.map((j, i) => (
                            <tr key={j.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                              <td className="px-3 py-3 whitespace-nowrap">{formatDate(j.preferred_date)}</td>
                              <td className="px-3 py-3">{j.customer_name}</td>
                              <td className="px-3 py-3 text-right font-semibold text-blue-700">{r(j.gross_revenue ?? 0)}</td>
                              <td className="px-3 py-3 text-right text-red-500">-{r(j.helper)}</td>
                              <td className="px-3 py-3 text-right text-red-500">-{r(j.truck)}</td>
                              <td className="px-3 py-3 text-right text-red-500">-{r(j.gas)}</td>
                              <td className="px-3 py-3 text-right text-red-500">-{r(j.dump)}</td>
                              <td className="px-3 py-3 text-right text-red-500">
                                {j.mileage != null ? `-${r(j.mileage)}` : <span className="text-gray-300 text-xs">est. pending</span>}
                              </td>
                              <td className="px-3 py-3 text-right text-red-500">-{r(j.cardFee)}</td>
                              <td className="px-3 py-3 text-right text-red-500">{j.equipment > 0 ? `-${r(j.equipment)}` : <span className="text-gray-300">—</span>}</td>
                              <td className="px-3 py-3 text-right font-bold text-green-700">{r(j.net)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                          <tr>
                            <td colSpan={2} className="px-3 py-3">Totals</td>
                            <td className="px-3 py-3 text-right text-blue-700">{r(totalGross)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.helper)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.truck)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.gas)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.dump)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.mileage)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.cardFee)}</td>
                            <td className="px-3 py-3 text-right text-red-500">-{r(totalCosts.equipment)}</td>
                            <td className="px-3 py-3 text-right text-green-700">{r(totalNet)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-3">Truck, gas, and dump costs are split evenly across jobs on the same day. Mileage is an estimate based on round trip to the dump.</p>
                </>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
