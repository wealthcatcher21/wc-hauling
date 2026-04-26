import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import nodemailer from "nodemailer";

const PHONE = "(863) 271-7896";

function getMailer() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
}

export async function GET(req: NextRequest) {
  // Vercel sends this header on cron invocations; also allow manual trigger via CRON_SECRET
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tomorrow = tomorrowStr();
  const db = getServiceClient();

  const { data: bookings, error } = await db
    .from("bookings")
    .select("customer_name, customer_email, preferred_date, time_slot, load_size, service_address")
    .eq("preferred_date", tomorrow)
    .in("status", ["confirmed", "pending"])
    .not("customer_email", "is", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!bookings || bookings.length === 0) {
    return NextResponse.json({ sent: 0, message: "No reminders needed for tomorrow." });
  }

  const mailer = getMailer();
  let sent = 0;

  for (const b of bookings) {
    try {
      await mailer.sendMail({
        from: `"WC Hauling Polk" <${process.env.GMAIL_USER}>`,
        to: b.customer_email,
        subject: `Reminder: Your junk removal is tomorrow – WC Hauling Polk`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;">
            <h2 style="color:#16a34a;">See You Tomorrow!</h2>
            <p>Hi ${b.customer_name},</p>
            <p>This is a friendly reminder that your junk removal pickup is scheduled for <strong>tomorrow</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0;">
              <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;width:140px;">Date</td><td style="padding:8px;">${formatDate(b.preferred_date)}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Time Slot</td><td style="padding:8px;">${b.time_slot || "Flexible – we'll be in touch to confirm a time"}</td></tr>
              <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Load Size</td><td style="padding:8px;background:#f9fafb;">${b.load_size}</td></tr>
              <tr><td style="padding:8px;font-weight:bold;">Pickup Address</td><td style="padding:8px;">${b.service_address}</td></tr>
            </table>
            <p><strong>A few things to have ready:</strong></p>
            <ul style="color:#374151;line-height:1.8;">
              <li>Items staged near the entrance or driveway if possible</li>
              <li>Payment ready (we accept cash, card, or Venmo)</li>
              <li>Someone present at the address during the pickup window</li>
            </ul>
            <p>Questions or need to make a change? Call or text us at <strong>${PHONE}</strong>.</p>
            <p style="color:#6b7280;font-size:13px;">No payment is due until the job is complete.<br/>WC Hauling Polk · Winter Haven, FL · Polk County</p>
          </div>
        `,
      });
      sent++;
    } catch (err) {
      console.error(`Reminder failed for ${b.customer_email}:`, err);
    }
  }

  return NextResponse.json({ sent, total: bookings.length });
}
