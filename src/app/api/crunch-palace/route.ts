import { NextResponse } from 'next/server';
import { getCrunchPalaceRows } from '@/lib/crunchPalace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await getCrunchPalaceRows();
  return NextResponse.json({ season: '2025-26', count: rows.length, rows });
}
