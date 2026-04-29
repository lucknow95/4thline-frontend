// Route layout for /rankings
// Loads route-scoped global CSS for the rankings table.

import "./rankings-table.css"; // <-- your CSS beside page.tsx

export default function RankingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
