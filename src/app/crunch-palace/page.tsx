import { getCrunchPalaceRows, CURRENT_SEASON } from '@/lib/crunchPalace';
import FanaticsCallout from '@/components/affiliate/FanaticsCallout';
import AffiliateDisclosure from '@/components/AffiliateDisclosure';
import CrunchPalaceClient from './CrunchPalaceClient';

export const dynamic = 'force-dynamic';

export default async function CrunchPalacePage() {
  const rows = await getCrunchPalaceRows(CURRENT_SEASON);

  // Optional dev fallback: show a tiny sample locally if DB is empty
  const devFallbackEnabled = process.env.NEXT_PUBLIC_CP_DEV_SAMPLE === '1';
  const data =
    rows.length > 0
      ? rows
      : devFallbackEnabled
        ? [
            {
              season: CURRENT_SEASON,
              team_abbr: 'FLA',
              team_full: 'Florida Panthers',
              arena_name: 'Amerant Bank Arena',
              home_games: 2,
              total_hits: 42,
              hits_per_game: 21,
            },
            {
              season: CURRENT_SEASON,
              team_abbr: 'VGK',
              team_full: 'Vegas Golden Knights',
              arena_name: 'T-Mobile Arena',
              home_games: 2,
              total_hits: 39,
              hits_per_game: 19.5,
            },
          ]
        : [];

  return (
    <main className="max-w-4xl mx-auto py-10 px-4">
      <CrunchPalaceClient initialRows={data} hasData={rows.length > 0} />
      <div className="mt-10">
        <FanaticsCallout className="mt-8" />
        <AffiliateDisclosure />
      </div>
    </main>
  );
}
