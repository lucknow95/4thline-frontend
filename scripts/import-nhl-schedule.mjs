#!/usr/bin/env node

/**
 * Import and validate NHL regular-season schedules from the official NHL API.
 *
 * Requirements:
 *   - Node.js 18+ (built-in fetch)
 *   - No third-party packages
 *
 * Example:
 *   node scripts/import-nhl-schedule.mjs \
 *     --season 20262027 \
 *     --output src/data/nhlSchedule.json \
 *     --start-date 2026-09-29 \
 *     --end-date 2027-04-10 \
 *     --expected-games-per-team 84 \
 *     --expected-home 42 \
 *     --expected-away 42 \
 *     --expected-unique-games 1344
 */

import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import process from "node:process";

const TEAM_ORDER = [
  "ANA", "BOS", "BUF", "CGY", "CAR", "CHI", "COL", "CBJ",
  "DAL", "DET", "EDM", "FLA", "LAK", "MIN", "MTL", "NSH",
  "NJD", "NYI", "NYR", "OTT", "PHI", "PIT", "SJS", "SEA",
  "STL", "TBL", "TOR", "UTM", "VAN", "VGK", "WSH", "WPG",
];

const INTERNAL_TO_API = {
  ANA: "ANA", BOS: "BOS", BUF: "BUF", CGY: "CGY", CAR: "CAR", CHI: "CHI",
  COL: "COL", CBJ: "CBJ", DAL: "DAL", DET: "DET", EDM: "EDM", FLA: "FLA",
  LAK: "LAK", MIN: "MIN", MTL: "MTL", NSH: "NSH", NJD: "NJD", NYI: "NYI",
  NYR: "NYR", OTT: "OTT", PHI: "PHI", PIT: "PIT", SJS: "SJS", SEA: "SEA",
  STL: "STL", TBL: "TBL", TOR: "TOR", UTM: "UTA", VAN: "VAN", VGK: "VGK",
  WSH: "WSH", WPG: "WPG",
};

const API_TO_INTERNAL = Object.fromEntries(
  Object.entries(INTERNAL_TO_API).map(([internal, api]) => [api, internal]),
);
// Accept either code if the NHL changes Utah's external abbreviation.
API_TO_INTERNAL.UTM = "UTM";

const FULL_NAMES = {
  ANA: "Anaheim Ducks", BOS: "Boston Bruins", BUF: "Buffalo Sabres",
  CGY: "Calgary Flames", CAR: "Carolina Hurricanes", CHI: "Chicago Blackhawks",
  COL: "Colorado Avalanche", CBJ: "Columbus Blue Jackets", DAL: "Dallas Stars",
  DET: "Detroit Red Wings", EDM: "Edmonton Oilers", FLA: "Florida Panthers",
  LAK: "Los Angeles Kings", MIN: "Minnesota Wild", MTL: "Montreal Canadiens",
  NSH: "Nashville Predators", NJD: "New Jersey Devils", NYI: "New York Islanders",
  NYR: "New York Rangers", OTT: "Ottawa Senators", PHI: "Philadelphia Flyers",
  PIT: "Pittsburgh Penguins", SJS: "San Jose Sharks", SEA: "Seattle Kraken",
  STL: "St. Louis Blues", TBL: "Tampa Bay Lightning", TOR: "Toronto Maple Leafs",
  UTM: "Utah Mammoth", VAN: "Vancouver Canucks", VGK: "Vegas Golden Knights",
  WSH: "Washington Capitals", WPG: "Winnipeg Jets",
};

const SHORT_NAMES = {
  ANA: "Anaheim", BOS: "Boston", BUF: "Buffalo", CGY: "Calgary",
  CAR: "Carolina", CHI: "Chicago", COL: "Colorado", CBJ: "Columbus",
  DAL: "Dallas", DET: "Detroit", EDM: "Edmonton", FLA: "Florida",
  LAK: "Los Angeles", MIN: "Minnesota", MTL: "Montreal", NSH: "Nashville",
  NJD: "New Jersey", NYI: "New York Islanders", NYR: "New York Rangers",
  OTT: "Ottawa", PHI: "Philadelphia", PIT: "Pittsburgh", SJS: "San Jose",
  SEA: "Seattle", STL: "St. Louis", TBL: "Tampa Bay", TOR: "Toronto",
  UTM: "Utah", VAN: "Vancouver", VGK: "Vegas", WSH: "Washington",
  WPG: "Winnipeg",
};

const DISPLAY_NAME_TO_CODE = new Map();
for (const code of TEAM_ORDER) {
  for (const name of [FULL_NAMES[code], SHORT_NAMES[code]]) {
    const existing = DISPLAY_NAME_TO_CODE.get(name);
    if (existing && existing !== code) {
      throw new Error(`Display-name collision: ${name} maps to ${existing} and ${code}`);
    }
    DISPLAY_NAME_TO_CODE.set(name, code);
  }
}

function parseArgs(argv) {
  const options = {
    season: "20262027",
    output: "nhlSchedule.json",
    backup: null,
    startDate: "2026-09-29",
    endDate: "2027-04-10",
    expectedGamesPerTeam: 84,
    expectedHome: 42,
    expectedAway: 42,
    expectedUniqueGames: 1344,
    retries: 4,
    timeoutMs: 20_000,
    dryRun: false,
    validateOnly: null,
  };

  const valueOptions = new Map([
    ["--season", "season"],
    ["--output", "output"],
    ["--backup", "backup"],
    ["--start-date", "startDate"],
    ["--end-date", "endDate"],
    ["--expected-games-per-team", "expectedGamesPerTeam"],
    ["--expected-home", "expectedHome"],
    ["--expected-away", "expectedAway"],
    ["--expected-unique-games", "expectedUniqueGames"],
    ["--retries", "retries"],
    ["--timeout-ms", "timeoutMs"],
    ["--validate-only", "validateOnly"],
  ]);

  const numericKeys = new Set([
    "expectedGamesPerTeam", "expectedHome", "expectedAway",
    "expectedUniqueGames", "retries", "timeoutMs",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
    const key = valueOptions.get(token);
    if (!key) {
      throw new Error(`Unknown argument: ${token}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${token}`);
    }
    options[key] = numericKeys.has(key) ? Number(value) : value;
    index += 1;
  }

  for (const key of numericKeys) {
    if (!Number.isInteger(options[key]) || options[key] < 1) {
      throw new Error(`${key} must be a positive integer`);
    }
  }
  if (!/^\d{8}$/.test(options.season)) {
    throw new Error("--season must be an 8-digit NHL season identifier such as 20262027");
  }
  validateIsoDate(options.startDate, "--start-date");
  validateIsoDate(options.endDate, "--end-date");
  if (options.startDate > options.endDate) {
    throw new Error("--start-date must be before or equal to --end-date");
  }
  return options;
}

function printHelp() {
  console.log(`Usage: node import-nhl-schedule.mjs [options]\n\n` +
    `Options:\n` +
    `  --season 20262027\n` +
    `  --output path/to/nhlSchedule.json\n` +
    `  --backup path/to/backup.json\n` +
    `  --start-date 2026-09-29\n` +
    `  --end-date 2027-04-10\n` +
    `  --expected-games-per-team 84\n` +
    `  --expected-home 42\n` +
    `  --expected-away 42\n` +
    `  --expected-unique-games 1344\n` +
    `  --retries 4\n` +
    `  --timeout-ms 20000\n` +
    `  --dry-run\n` +
    `  --validate-only path/to/nhlSchedule.json\n`);
}

function validateIsoDate(value, label = "date") {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${label} is not YYYY-MM-DD: ${value}`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} is not a real calendar date: ${value}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, { retries, timeoutMs }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "4th-Line-Fantasy-Schedule-Importer/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = 500 * (2 ** (attempt - 1));
        console.warn(`Attempt ${attempt}/${retries} failed for ${url}: ${error.message}; retrying in ${delay} ms`);
        await sleep(delay);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${url}: ${lastError?.message ?? "unknown error"}`);
}

function apiCodeToInternal(apiCode) {
  const internal = API_TO_INTERNAL[apiCode];
  if (!internal) {
    throw new Error(`Unknown NHL API team abbreviation: ${apiCode}`);
  }
  return internal;
}

function canonicalKey(game) {
  return `${game.id}|${game.date}|${game.home}|${game.away}`;
}

function scheduleKey(game) {
  return `${game.date}|${game.home}|${game.away}`;
}

function normalizeApiGame(rawGame, requestedInternalCode, options) {
  if (rawGame?.gameType !== 2) {
    return null;
  }
  if (!Number.isInteger(rawGame.id)) {
    throw new Error(`${requestedInternalCode}: game is missing an integer id`);
  }
  validateIsoDate(rawGame.gameDate, `${requestedInternalCode} gameDate`);
  if (rawGame.gameDate < options.startDate || rawGame.gameDate > options.endDate) {
    throw new Error(
      `${requestedInternalCode}: regular-season game ${rawGame.id} has out-of-range date ${rawGame.gameDate}`,
    );
  }
  const homeApi = rawGame?.homeTeam?.abbrev;
  const awayApi = rawGame?.awayTeam?.abbrev;
  if (typeof homeApi !== "string" || typeof awayApi !== "string") {
    throw new Error(`${requestedInternalCode}: game ${rawGame.id} is missing home/away abbreviations`);
  }
  const home = apiCodeToInternal(homeApi);
  const away = apiCodeToInternal(awayApi);
  if (home === away) {
    throw new Error(`${requestedInternalCode}: game ${rawGame.id} has the same home and away team`);
  }
  if (requestedInternalCode !== home && requestedInternalCode !== away) {
    throw new Error(
      `${requestedInternalCode}: endpoint returned unrelated game ${rawGame.id}: ${away} at ${home}`,
    );
  }
  return { id: rawGame.id, date: rawGame.gameDate, home, away };
}

async function fetchAllTeams(options) {
  const sourceByTeam = new Map();
  for (const internalCode of TEAM_ORDER) {
    const apiCode = INTERNAL_TO_API[internalCode];
    const url = `https://api-web.nhle.com/v1/club-schedule-season/${apiCode}/${options.season}`;
    console.log(`Fetching ${internalCode} from ${url}`);
    const payload = await fetchJsonWithRetry(url, options);
    if (!Array.isArray(payload?.games)) {
      throw new Error(`${internalCode}: response does not contain a games array`);
    }
    const games = payload.games
      .map((game) => normalizeApiGame(game, internalCode, options))
      .filter(Boolean)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    sourceByTeam.set(internalCode, games);
  }
  return sourceByTeam;
}

function validateCanonicalSource(sourceByTeam, options) {
  if (sourceByTeam.size !== TEAM_ORDER.length) {
    throw new Error(`Expected 32 team responses, received ${sourceByTeam.size}`);
  }

  const occurrences = new Map();
  for (const code of TEAM_ORDER) {
    const games = sourceByTeam.get(code);
    if (!games) {
      throw new Error(`Missing source schedule for ${code}`);
    }
    if (games.length !== options.expectedGamesPerTeam) {
      throw new Error(`${code}: expected ${options.expectedGamesPerTeam} regular-season games, found ${games.length}`);
    }
    const ownKeys = new Set();
    for (const game of games) {
      const key = canonicalKey(game);
      if (ownKeys.has(key)) {
        throw new Error(`${code}: duplicate source game ${key}`);
      }
      ownKeys.add(key);
      const previous = occurrences.get(key) ?? { game, teams: [] };
      previous.teams.push(code);
      occurrences.set(key, previous);
    }
  }

  if (occurrences.size !== options.expectedUniqueGames) {
    throw new Error(`Expected ${options.expectedUniqueGames} unique games, found ${occurrences.size}`);
  }

  const byTeam = new Map(TEAM_ORDER.map((code) => [code, []]));
  const scheduleKeys = new Set();
  for (const [key, { game, teams }] of occurrences) {
    if (teams.length !== 2) {
      throw new Error(`Game ${key} appeared under ${teams.length} teams: ${teams.join(", ")}`);
    }
    const expectedTeams = new Set([game.home, game.away]);
    if (!teams.every((code) => expectedTeams.has(code)) || new Set(teams).size !== 2) {
      throw new Error(`Game ${key} is filed under the wrong team endpoints: ${teams.join(", ")}`);
    }
    const outputKey = scheduleKey(game);
    if (scheduleKeys.has(outputKey)) {
      throw new Error(`Duplicate date/home/away combination: ${outputKey}`);
    }
    scheduleKeys.add(outputKey);
    byTeam.get(game.home).push(game);
    byTeam.get(game.away).push(game);
  }

  for (const code of TEAM_ORDER) {
    const games = byTeam.get(code).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
    const home = games.filter((game) => game.home === code).length;
    const away = games.filter((game) => game.away === code).length;
    if (games.length !== options.expectedGamesPerTeam) {
      throw new Error(`${code}: canonical schedule contains ${games.length} games`);
    }
    if (home !== options.expectedHome || away !== options.expectedAway) {
      throw new Error(
        `${code}: expected ${options.expectedHome} home / ${options.expectedAway} away, found ${home} / ${away}`,
      );
    }
  }

  const expectedTeamRecords = options.expectedUniqueGames * 2;
  const actualTeamRecords = [...byTeam.values()].reduce((sum, games) => sum + games.length, 0);
  if (actualTeamRecords !== expectedTeamRecords) {
    throw new Error(`Expected ${expectedTeamRecords} team-game records, found ${actualTeamRecords}`);
  }

  return byTeam;
}

function legacyName(viewingTeam, representedTeam) {
  return viewingTeam === representedTeam ? FULL_NAMES[representedTeam] : SHORT_NAMES[representedTeam];
}

function buildLegacyOutput(byTeam) {
  return TEAM_ORDER.map((code) => ({
    team: code,
    schedule: byTeam.get(code).map((game) => ({
      date: game.date,
      home_team: legacyName(code, game.home),
      away_team: legacyName(code, game.away),
    })),
  }));
}

function decodeLegacyEntry(viewingTeam, entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`${viewingTeam}[${index}]: entry is not an object`);
  }
  validateIsoDate(entry.date, `${viewingTeam}[${index}].date`);
  const home = DISPLAY_NAME_TO_CODE.get(entry.home_team);
  const away = DISPLAY_NAME_TO_CODE.get(entry.away_team);
  if (!home || !away) {
    throw new Error(`${viewingTeam}[${index}]: unknown team display name`);
  }
  if (home !== viewingTeam && away !== viewingTeam) {
    throw new Error(`${viewingTeam}[${index}]: viewing team is not present in the game`);
  }
  const expectedHomeName = legacyName(viewingTeam, home);
  const expectedAwayName = legacyName(viewingTeam, away);
  if (entry.home_team !== expectedHomeName || entry.away_team !== expectedAwayName) {
    throw new Error(
      `${viewingTeam}[${index}]: display-name contract mismatch; expected ${expectedAwayName} at ${expectedHomeName}`,
    );
  }
  return { date: entry.date, home, away };
}

function validateLegacyOutput(data, options) {
  if (!Array.isArray(data) || data.length !== TEAM_ORDER.length) {
    throw new Error("Schedule JSON must be an array containing exactly 32 team objects");
  }
  if (data.map((item) => item?.team).join(",") !== TEAM_ORDER.join(",")) {
    throw new Error("Schedule team codes/order do not match the existing application contract");
  }

  const canonicalOccurrences = new Map();
  const rows = [];
  for (const item of data) {
    const code = item.team;
    if (!Array.isArray(item.schedule) || item.schedule.length !== options.expectedGamesPerTeam) {
      throw new Error(`${code}: expected ${options.expectedGamesPerTeam} schedule entries`);
    }
    let previousDate = "";
    const ownKeys = new Set();
    let homeCount = 0;
    let awayCount = 0;
    for (let index = 0; index < item.schedule.length; index += 1) {
      const game = decodeLegacyEntry(code, item.schedule[index], index);
      if (game.date < options.startDate || game.date > options.endDate) {
        throw new Error(`${code}: date ${game.date} is outside the expected season range`);
      }
      if (game.date < previousDate) {
        throw new Error(`${code}: schedule is not chronological at ${game.date}`);
      }
      previousDate = game.date;
      const key = scheduleKey(game);
      if (ownKeys.has(key)) {
        throw new Error(`${code}: duplicate schedule entry ${key}`);
      }
      ownKeys.add(key);
      const record = canonicalOccurrences.get(key) ?? { game, teams: [] };
      record.teams.push(code);
      canonicalOccurrences.set(key, record);
      if (game.home === code) homeCount += 1;
      if (game.away === code) awayCount += 1;
    }
    if (homeCount !== options.expectedHome || awayCount !== options.expectedAway) {
      throw new Error(`${code}: expected ${options.expectedHome}/${options.expectedAway} home/away, found ${homeCount}/${awayCount}`);
    }
    rows.push({
      team: code,
      total: item.schedule.length,
      home: homeCount,
      away: awayCount,
      first: item.schedule[0].date,
      final: item.schedule.at(-1).date,
    });
  }

  if (canonicalOccurrences.size !== options.expectedUniqueGames) {
    throw new Error(`Expected ${options.expectedUniqueGames} unique games, found ${canonicalOccurrences.size}`);
  }
  for (const [key, record] of canonicalOccurrences) {
    if (record.teams.length !== 2 || new Set(record.teams).size !== 2) {
      throw new Error(`Cross-team symmetry failed for ${key}: ${record.teams.join(", ")}`);
    }
    if (!record.teams.includes(record.game.home) || !record.teams.includes(record.game.away)) {
      throw new Error(`Cross-team assignments failed for ${key}: ${record.teams.join(", ")}`);
    }
  }
  return rows;
}

async function pathExists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function defaultBackupPath(outputPath) {
  const parsed = path.parse(outputPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(parsed.dir, `${parsed.name}.backup-${timestamp}${parsed.ext || ".json"}`);
}

async function transactionalWrite(outputPath, backupPath, contents) {
  const absoluteOutput = path.resolve(outputPath);
  const absoluteBackup = path.resolve(backupPath);
  if (absoluteOutput === absoluteBackup) {
    throw new Error("Backup path must differ from output path");
  }
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  await mkdir(path.dirname(absoluteBackup), { recursive: true });
  if (await pathExists(absoluteBackup)) {
    throw new Error(`Refusing to overwrite existing backup: ${absoluteBackup}`);
  }

  const tempPath = `${absoluteOutput}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tempPath, contents, { encoding: "utf8", flag: "wx" });

  const outputExisted = await pathExists(absoluteOutput);
  try {
    if (outputExisted) {
      await rename(absoluteOutput, absoluteBackup);
    }
    await rename(tempPath, absoluteOutput);
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    if (outputExisted && !(await pathExists(absoluteOutput)) && await pathExists(absoluteBackup)) {
      await rename(absoluteBackup, absoluteOutput).catch(() => {});
    }
    throw error;
  }
  return { output: absoluteOutput, backup: outputExisted ? absoluteBackup : null };
}

function printValidation(rows, options) {
  console.log("\nValidation summary");
  console.log("Team  Total  Home  Away  First       Final");
  for (const row of rows) {
    console.log(
      `${row.team.padEnd(5)} ${String(row.total).padStart(5)} ${String(row.home).padStart(5)} ` +
      `${String(row.away).padStart(5)}  ${row.first}  ${row.final}`,
    );
  }
  console.log(`\nLeague totals: ${TEAM_ORDER.length} teams, ${options.expectedUniqueGames} unique games, ${options.expectedUniqueGames * 2} team-game records`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.validateOnly) {
    const data = JSON.parse(await readFile(options.validateOnly, "utf8"));
    const rows = validateLegacyOutput(data, options);
    printValidation(rows, options);
    console.log(`\nValidation passed: ${path.resolve(options.validateOnly)}`);
    return;
  }

  const sourceByTeam = await fetchAllTeams(options);
  const byTeam = validateCanonicalSource(sourceByTeam, options);
  const output = buildLegacyOutput(byTeam);
  const rows = validateLegacyOutput(output, options);
  printValidation(rows, options);

  if (options.dryRun) {
    console.log("\nDry run complete. No files were written.");
    return;
  }

  const backupPath = options.backup ?? defaultBackupPath(options.output);
  const result = await transactionalWrite(
    options.output,
    backupPath,
    `${JSON.stringify(output, null, 2)}\n`,
  );
  console.log(`\nWrote: ${result.output}`);
  if (result.backup) {
    console.log(`Backup: ${result.backup}`);
  } else {
    console.log("No previous output file existed, so no backup was necessary.");
  }
}

main().catch((error) => {
  console.error(`ERROR: ${error.stack ?? error.message}`);
  process.exitCode = 1;
});
