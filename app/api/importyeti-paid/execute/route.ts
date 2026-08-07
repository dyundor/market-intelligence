import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({status:"execution_disabled",error:"ImportYeti paid transport is intentionally not configured; no credits were spent."},{status:501});
}
