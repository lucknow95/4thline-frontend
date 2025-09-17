// src/types/json-modules.d.ts
import type { Player } from "@/types";

declare module "@/data/realPlayersWithSchedule.json" {
  const value: Player[];
  export default value;
}
