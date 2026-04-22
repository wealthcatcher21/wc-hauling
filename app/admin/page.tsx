"use client";

import { useState, useEffect, useCallback } from "react";
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
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-100",
};

const LOAD_NET: Record<string, number> = {
  "Half Load – $350": 138,
  "Three-Quarter Load – $500": 237,
  "Full Load – $725": 380,
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

  const loadBookings = useCallback(async () => {
    setLoadingBookings(true);
    const res = await fetch("/api/bookings", { headers });
    const data = await res.json();
    if (Array.isArray(data)) {
      setBookings(data);
      // Auto-fetch mileage estimates for all non-cancelled bookings
      for (const b of data) {
        if (b.status !== "cancelled" && b.service_address) {
          setMileageMap((prev) => ({ ...prev, [b.id]: "loading" }));
          fetch("/api/estimate-mileage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: b.service_address }),
          })
            .then((r) => r.json())
            .then((m) => {
              if (m.estimatedMiles) setMileageMap((prev) => ({ ...prev, [b.id]: { estimatedMiles: m.estimatedMiles, mileageCost: m.mileageCost } }));
              else setMileageMap((prev) => ({ ...prev, [b.id]: "error" }));
            })
            .catch(() => setMileageMap((prev) => ({ ...prev, [b.id]: "error" })));
        }
      }
    }
    setLoadingBookings(false);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authed) return;
    loadSchedule();
    loadBookings();
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
          <h1 className="text-2xl font-bold text-center mb-2">WC Hauling Admin</h1>
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
            <span className="font-bold text-lg">WC Hauling Admin</span>
            <span className="text-green-400 text-sm ml-3">● Live</span>
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
            {loadingBookings ? (
              <p className="text-gray-500">Loading...</p>
            ) : bookings.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg font-semibold">No bookings yet</p>
                <p className="text-sm mt-2">Once customers submit requests, they&apos;ll appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {bookings.map((b) => {
                  const isSaturday = new Date(b.preferred_date + "T00:00:00").getDay() === 6;
                  const mileage = mileageMap[b.id];
                  return (
                    <div key={b.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
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
                        {b.status === "confirmed" && (
                          <div className="flex items-center gap-2">
                            <input type="number" placeholder="Actual gross $" min={0}
                              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-green-500"
                              onBlur={(e) => { if (e.target.value) updateBooking(b.id, { status: "completed", gross_revenue: Number(e.target.value) }); }} />
                            <button onClick={() => updateBooking(b.id, { status: "completed" })}
                              disabled={updatingBooking === b.id}
                              className="bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-60">
                              Mark Complete
                            </button>
                          </div>
                        )}
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div>
            <h2 className="text-xl font-bold mb-6">Revenue Tracker</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Completed Jobs", value: completedBookings.length, color: "green" },
                { label: "Total Gross", value: `$${totalGross.toLocaleString()}`, color: "blue" },
                { label: "Est. Net (all jobs)", value: `$${estimatedNet.toLocaleString()}`, color: "green" },
                { label: "Jobs to $5K/mo", value: Math.max(0, Math.ceil((5000 - estimatedNet) / 237)), color: estimatedNet >= 5000 ? "green" : "yellow" },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                  <p className="text-gray-500 text-sm mb-1">{s.label}</p>
                  <p className={`text-3xl font-extrabold ${s.color === "green" ? "text-green-700" : s.color === "blue" ? "text-blue-700" : "text-yellow-600"}`}>{s.value}</p>
                </div>
              ))}
            </div>

            <h3 className="font-bold text-lg mb-3">Completed Jobs Breakdown</h3>
            {completedBookings.length === 0 ? (
              <p className="text-gray-400 text-sm">No completed jobs yet. Mark jobs as complete in the Bookings tab.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Customer</th>
                      <th className="px-4 py-3 text-left font-semibold">Load</th>
                      <th className="px-4 py-3 text-right font-semibold">Gross</th>
                      <th className="px-4 py-3 text-right font-semibold">Est. Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedBookings.map((b, i) => (
                      <tr key={b.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-4 py-3">{formatDate(b.preferred_date)}</td>
                        <td className="px-4 py-3">{b.customer_name}</td>
                        <td className="px-4 py-3">{b.load_size.split(" – ")[0]}</td>
                        <td className="px-4 py-3 text-right">${b.gross_revenue ?? "–"}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-semibold">~${LOAD_NET[b.load_size] ?? "?"}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t border-gray-200 font-bold">
                    <tr>
                      <td colSpan={3} className="px-4 py-3">Total</td>
                      <td className="px-4 py-3 text-right">${totalGross}</td>
                      <td className="px-4 py-3 text-right text-green-700">~${estimatedNet}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
