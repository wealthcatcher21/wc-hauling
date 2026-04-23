import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const OWNER_EMAIL = "tmonecla93@gmail.com";

function isAdminAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("bookings")
    .select("*")
    .order("preferred_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customer_name, customer_phone, customer_email, service_address, load_size, preferred_date, time_slot, description } = body;

  if (!customer_name || !customer_phone || !service_address || !load_size || !preferred_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db = getServiceClient();

  // Check capacity before inserting
  const { count } = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferred_date)
    .in("status", ["pending", "confirmed"]);

  const { data: schedRow } = await db.from("work_schedule").select("shift_start, shift_end").eq("date", preferred_date).maybeSingle();
  const { computeDayAvailability } = await import("@/lib/schedule-logic");
  const avail = computeDayAvailability(preferred_date, schedRow?.shift_start ?? null, schedRow?.shift_end ?? null);

  if ((count ?? 0) >= avail.jobsAllowed) {
    return NextResponse.json({ error: "That date is now fully booked. Please choose another date." }, { status: 409 });
  }

  const { data, error } = await db
    .from("bookings")
    .insert({ customer_name, customer_phone, customer_email: customer_email || null, service_address, load_size, preferred_date, time_slot: time_slot || null, description: description || null, status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send email notification to owner
  await resend.emails.send({
    from: "WC Hauling <onboarding@resend.dev>",
    to: OWNER_EMAIL,
    subject: `New Booking Request – ${preferred_date}`,
    html: `
      <h2>New Job Request</h2>
      <p><strong>Name:</strong> ${customer_name}</p>
      <p><strong>Phone:</strong> ${customer_phone}</p>
      <p><strong>Email:</strong> ${customer_email || "Not provided"}</p>
      <p><strong>Address:</strong> ${service_address}</p>
      <p><strong>Date:</strong> ${preferred_date}</p>
      <p><strong>Time Slot:</strong> ${time_slot || "Flexible"}</p>
      <p><strong>Load Size:</strong> ${load_size}</p>
      <p><strong>Details:</strong> ${description || "None"}</p>
      <hr/>
      <p>Log in to your <a href="https://wchaulingpolk.com/admin">admin panel</a> to confirm or update this booking.</p>
    `,
  }).catch(() => {}); // Don't fail the booking if email fails

  // Send confirmation email to customer if they provided one
  if (customer_email) {
    await resend.emails.send({
      from: "WC Hauling <onboarding@resend.dev>",
      to: customer_email,
      subject: "We received your junk removal request – WC Hauling",
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
          <h2 style="color:#16a34a;">Request Received!</h2>
          <p>Hi ${customer_name},</p>
          <p>Thanks for reaching out to WC Hauling. We've received your pickup request and will confirm your booking within 2 hours via call or text.</p>
          <table style="width:100%;border-collapse:collapse;margin:20px 0;">
            <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;width:140px;">Date Requested</td><td style="padding:8px;">${preferred_date}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Time Slot</td><td style="padding:8px;">${time_slot || "Flexible"}</td></tr>
            <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Load Size</td><td style="padding:8px;background:#f9fafb;">${load_size}</td></tr>
            <tr><td style="padding:8px;font-weight:bold;">Pickup Address</td><td style="padding:8px;">${service_address}</td></tr>
          </table>
          <p>Have questions? Call or text us at <strong>(863) 271-7896</strong>.</p>
          <p style="color:#6b7280;font-size:13px;">No payment is due until the job is complete.<br/>WC Hauling · Winter Haven, FL · Polk County</p>
        </div>
      `,
    }).catch((err) => console.error("Customer email error:", err));
  }

  return NextResponse.json({ success: true, booking: data });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { id, status, gross_revenue, notes } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getServiceClient();
  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (gross_revenue !== undefined) updates.gross_revenue = gross_revenue;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await db.from("bookings").update(updates).eq("id", id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const db = getServiceClient();
  const { error } = await db.from("bookings").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
