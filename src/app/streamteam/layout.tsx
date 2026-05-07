// Route layout for /streamteam
// Loads route-scoped global CSS for the Stream Team table.

import "./rankings-table.css"; // still valid if file is in same folder

export default function StreamTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}