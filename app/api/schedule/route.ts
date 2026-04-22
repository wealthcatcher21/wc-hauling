import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

function isAdminAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("x-admin-token");
  return token === process.env.ADMIN_SECRET;
}

export async function GET() {
  const db = getServiceClient();
  const { data, error } = await db
    .from("work_schedule")
    .select("*")
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { date, shift_start, shift_end, notes } = body;

  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = getServiceClient();
  const { data, error } = await db
    .from("work_schedule")
    .upsert({ date, shift_start: shift_start || null, shift_end: shift_end || null, notes: notes || null }, { onConflict: "date" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await req.json();
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const db = getServiceClient();
  const { error } = await db.from("work_schedule").delete().eq("date", date);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
