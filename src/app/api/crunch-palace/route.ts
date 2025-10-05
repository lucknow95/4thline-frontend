// src/app/api/crunch-palace/route.ts
// Public API: returns aggregated Crunch Palace data for a season.
// Shape is kept identical to your existing implementation:
//   { season: '2025-26', count: number, rows: CPAggregateRow[] }

import { CURRENT_SEASON, getCrunchPalaceRows } from '@/lib/crunchPalace';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const season = searchParams.get('season') ?? CURRENT_SEASON;

  try {
    const rows = await getCrunchPalaceRows(season);
    return NextResponse.json({ season, count: rows.length, rows });
  } catch (err: any) {
    // Defensive logging/response so the route doesn't crash deployments
    const message = err?.message ?? String(err);
    return NextResponse.json(
      { season, count: 0, rows: [], error: message },
      { status: 500 }
    );
  }
}
