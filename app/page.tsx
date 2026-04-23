"use client";

import { useState, useEffect } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const PHONE = "(863) 271-7896";
const PHONE_HREF = "tel:8632717896";

const PRICING = [
  {
    label: "Half Load", price: "$350", popular: false,
    desc: "Small cleanouts, a few items",
    items: ["Couch or loveseat", "Queen mattress + box spring", "Small dresser or desk", "Patio furniture set", "5–10 medium boxes or bags"],
    bestFor: "Single-room cleanups or a few bulky items",
  },
  {
    label: "¾ Load", price: "$500", popular: true,
    desc: "Medium loads, garage cleanouts, furniture hauls",
    items: ["Sectional sofa or multiple large items", "6-person dining table + chairs", "Double-door refrigerator + misc items", "Half to full garage cleanout", "Mix of furniture + boxes"],
    bestFor: "Garage cleanouts or multiple rooms",
  },
  {
    label: "Full Load", price: "$725", popular: false,
    desc: "Full truck loads, large cleanouts",
    items: ["Full garage cleanout (packed)", "Multiple furniture sets", "Estate cleanouts", "Large household clear-outs", "Renovation or move-out junk"],
    bestFor: "Big jobs where everything needs to go",
  },
];

const ITEMS = [
  "Furniture & Mattresses", "Appliances", "Yard Waste & Debris",
  "Construction Materials", "Electronics", "Garage Cleanouts",
  "Estate Cleanouts", "Moving Junk", "Curbside Pickup",
];

interface AvailableDate {
  date: string;
  dayOfWeek: string;
  slotsRemaining: number;
  slots: string[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export default function Home() {
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [form, setForm] = useState({
    customer_name: "", customer_phone: "", customer_email: "",
    service_address: "", load_size: "", preferred_date: "", time_slot: "", description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [materialsConfirmed, setMaterialsConfirmed] = useState(false);

  function refreshDates() {
    fetch("/api/available-dates")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAvailableDates(data); setLoadingDates(false); })
      .catch(() => setLoadingDates(false));
  }

  useEffect(() => { refreshDates(); }, []);

  const selectedDateObj = availableDates.find((d) => d.date === form.preferred_date);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.service_address.trim()) {
      setFormError("Please enter a pickup address to continue.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMessage("Request received! We'll confirm your booking within 2 hours via call or text. If you provided your email, check your spam folder if you don't see a confirmation shortly.");
        setForm({ customer_name: "", customer_phone: "", customer_email: "", service_address: "", load_size: "", preferred_date: "", time_slot: "", description: "" });
        setMaterialsConfirmed(false);
        refreshDates();
      } else {
        setFormError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-xl font-bold text-green-700">WC Hauling Polk</span>
          <a href={PHONE_HREF} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors">
            Call {PHONE}
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 bg-gradient-to-br from-green-700 to-green-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <p className="text-green-300 font-semibold text-sm uppercase tracking-widest mb-3">Winter Haven & Polk County, FL</p>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Junk Removed.<br className="hidden md:block" /> Fast. Affordable. Done.
          </h1>
          <p className="text-xl text-green-100 mb-10 max-w-2xl mx-auto">
            Schedule your pickup in minutes. No hidden fees. We load it, haul it, and dump it — you just point.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#book" className="bg-white text-green-700 font-bold px-8 py-4 rounded-xl text-lg hover:bg-green-50 transition-colors">
              Book a Pickup
            </a>
            <a href={PHONE_HREF} className="border-2 border-white text-white font-bold px-8 py-4 rounded-xl text-lg hover:bg-white/10 transition-colors">
              Call {PHONE}
            </a>
          </div>
          <p className="mt-8 text-green-300 text-sm">Serving Winter Haven, Lakeland, Haines City, Bartow & surrounding areas</p>
        </div>
      </section>

      {/* Trust bar */}
      <section className="bg-gray-900 text-white py-5">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap justify-center gap-8 text-sm text-gray-300 text-center">
          <span>No Hidden Fees</span>
          <span>|</span>
          <span>Scheduled Pickups</span>
          <span>|</span>
          <span>We Do All the Heavy Lifting</span>
          <span>|</span>
          <span>Locally Owned</span>
        </div>
      </section>

      {/* What we take */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-3">What We Take</h2>
          <p className="text-center text-gray-500 mb-12">If you can point to it, we can haul it.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {ITEMS.map((item) => (
              <div key={item} className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border border-gray-100">
                <span className="text-green-600 font-bold text-lg">✓</span>
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20 bg-white" id="pricing">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-3">Simple, Upfront Pricing</h2>
          <p className="text-center text-gray-500 mb-12">No surprise charges. You&apos;ll know the price before we start.</p>
          <div className="grid md:grid-cols-3 gap-6 items-start">
            {PRICING.map((p) => (
              <div key={p.label} className={`relative rounded-2xl border-2 p-7 flex flex-col ${p.popular ? "border-green-600 shadow-xl" : "border-gray-200"}`}>
                {p.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">Most Popular</span>
                )}
                <h3 className="text-xl font-bold mb-1">{p.label}</h3>
                <p className="text-4xl font-extrabold text-green-700 mb-1">{p.price}</p>
                <p className="text-gray-500 text-sm mb-4">{p.desc}</p>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">What this load size looks like</p>
                <p className="text-xs text-gray-400 italic mb-3">These are examples only — not a list of included items</p>
                <ul className="space-y-1 mb-4">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-gray-400 mt-0.5">—</span>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 italic mb-5">Best for: {p.bestFor}</p>
                <a href="#book" className={`block text-center py-3 rounded-xl font-semibold transition-colors mt-auto ${p.popular ? "bg-green-600 text-white hover:bg-green-700" : "bg-gray-100 text-gray-800 hover:bg-gray-200"}`}>
                  Book This
                </a>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-sm mt-6">Not sure what size you need? Call us — we&apos;ll help you figure it out in 2 minutes.</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-green-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Book Online or Call", desc: "Pick a date that works for you. We confirm within 2 hours." },
              { step: "2", title: "We Show Up On Time", desc: "Our crew arrives at your scheduled slot — 7 AM or 11:30 AM." },
              { step: "3", title: "We Load & Haul", desc: "You point, we load. Job done in 1-2 hours. Pay when we finish." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 bg-green-600 text-white rounded-full flex items-center justify-center text-2xl font-extrabold mx-auto mb-4">{s.step}</div>
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Booking form */}
      <section className="py-20 bg-white" id="book">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-3">Request a Pickup</h2>
          <p className="text-center text-gray-500 mb-10">Fill out the form below. We&apos;ll confirm via call or text within 2 hours.</p>

          {successMessage && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center mb-8">
              <p className="text-lg font-semibold text-green-700">{successMessage}</p>
              <button onClick={() => setSuccessMessage(null)} className="mt-4 text-green-600 underline text-sm">Submit another request</button>
            </div>
          )}
          {!successMessage && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-semibold mb-1">Full Name *</label>
                  <input required value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Phone Number *</label>
                  <input required type="tel" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="(863) 555-1234" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Email (optional)</label>
                <input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="john@email.com" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Pickup Address *</label>
                <AddressAutocomplete
                  value={form.service_address}
                  onChange={(v) => setForm({ ...form, service_address: v })}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Estimated Load Size *</label>
                <select required value={form.load_size} onChange={(e) => setForm({ ...form, load_size: e.target.value })}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Select a size...</option>
                  <option value="Half Load – $350">Half Load – $350 (small items, minor cleanout)</option>
                  <option value="Three-Quarter Load – $500">¾ Load – $500 (medium load, garage, furniture)</option>
                  <option value="Full Load – $725">Full Load – $725 (large haul, estate cleanout)</option>
                  <option value="Not Sure">Not Sure – I need help deciding</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Preferred Date *</label>
                {loadingDates ? (
                  <div className="border border-gray-200 rounded-xl px-4 py-3 text-gray-400">Loading available dates...</div>
                ) : availableDates.length === 0 ? (
                  <div className="border border-orange-200 bg-orange-50 rounded-xl px-4 py-3 text-orange-700 text-sm">
                    No dates are currently available online. Please call us at <a href={PHONE_HREF} className="font-bold underline">{PHONE}</a> to schedule.
                  </div>
                ) : (
                  <select required value={form.preferred_date} onChange={(e) => { setForm({ ...form, preferred_date: e.target.value, time_slot: "" }); }}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Select a date...</option>
                    {availableDates.map((d) => (
                      <option key={d.date} value={d.date}>{formatDate(d.date)} — {d.slots.join(" or ")} ({d.slotsRemaining} slot{d.slotsRemaining > 1 ? "s" : ""} open)</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedDateObj && (
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Preferred Time Slot {selectedDateObj.slots.length === 1 && <span className="text-gray-400 font-normal">(only one slot available)</span>}
                  </label>
                  <select value={form.time_slot} onChange={(e) => setForm({ ...form, time_slot: e.target.value })}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500">
                    {selectedDateObj.slots.length > 1 && <option value="">No preference</option>}
                    {selectedDateObj.slots.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1">What needs to go? (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="e.g. old sofa, broken AC unit, garage cleanout..." />
              </div>

              {/* Unacceptable materials disclaimer */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-sm font-bold text-red-700 mb-2">Items we cannot accept:</p>
                <p className="text-sm text-red-600 mb-3">Bulk liquids · Pressurized tanks · Ammunition or explosives · Biological waste · Asbestos · Radioactive waste</p>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" required checked={materialsConfirmed} onChange={(e) => setMaterialsConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <span className="text-sm text-gray-700">I confirm that none of my items fall into the unacceptable categories listed above.</span>
                </label>
              </div>

              {formError && (
                <p className="text-red-600 text-sm font-semibold text-center bg-red-50 border border-red-200 rounded-xl px-4 py-3">{formError}</p>
              )}

              <button type="submit" disabled={submitting || !materialsConfirmed}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl text-lg transition-colors">
                {submitting ? "Submitting..." : "Request Pickup"}
              </button>
              <p className="text-center text-gray-400 text-sm">We&apos;ll confirm your booking within 2 hours. No charge until the job is done.</p>
            </form>
          )}
        </div>
      </section>

      {/* Service area */}
      <section className="py-16 bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Service Area</h2>
          <p className="text-gray-400 mb-6">We serve Winter Haven and all of Polk County, FL including:</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            {["Winter Haven", "Lakeland", "Haines City", "Bartow", "Auburndale", "Polk City", "Lake Wales", "Davenport"].map((city) => (
              <span key={city} className="bg-gray-800 px-4 py-2 rounded-full">{city}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-gray-400 py-8 text-center text-sm">
        <p className="font-semibold text-white mb-1">WC Hauling Polk</p>
        <p>Winter Haven, FL | Polk County</p>
        <p className="mt-2"><a href={PHONE_HREF} className="text-green-400 hover:underline">{PHONE}</a></p>
        <p className="mt-4 text-xs text-gray-600">A Wealth Catchers LLC company · All rights reserved</p>
      </footer>
    </div>
  );
}
