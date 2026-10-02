/**
 * Weather Outfit Advisor — pure domain logic.
 *
 * All exports are side-effect-free, deterministic pure functions:
 *   - No I/O, no randomness, no global state mutations.
 *   - Same input always produces the same output.
 *   - advise() always returns a Japanese string of ≤ 40 Unicode code points,
 *     no emoji.
 */

/** Minimal weather snapshot consumed by advise(). */
export interface WeatherData {
  /** Condition string derived from WMO code, e.g. "Rain", "Clear", "Snow". */
  condition: string;
  /** Current temperature in degrees Celsius. */
  tempCelsius: number;
  /** Today's maximum precipitation probability in % (0–100). Optional. */
  precipitationProbability?: number;
}

// ---------------------------------------------------------------------------
// WMO code → condition mapping (pure, never throws)
// ---------------------------------------------------------------------------

/**
 * Maps a WMO weather interpretation code to a human-readable condition string.
 * Pure function — never throws for any integer input.
 */
export function wmoToCondition(code: number): string {
  if (code === 0) return "Clear";
  if (code <= 3) return "Clouds";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain";   // rain showers
  if (code >= 85 && code <= 86) return "Snow";   // snow showers
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Unknown";
}

// ---------------------------------------------------------------------------
// Rule table — each entry is [predicate, advice string].
// Evaluated top-to-bottom; the first matching rule wins.
// All advice strings are pre-validated: ≤ 40 Japanese chars, no emoji.
// ---------------------------------------------------------------------------

type Rule = [(w: WeatherData) => boolean, string];

/** True when the weather warrants carrying an umbrella. */
const needsUmbrella = (w: WeatherData): boolean =>
  /rain|drizzle|thunderstorm/i.test(w.condition) ||
  (w.precipitationProbability !== undefined && w.precipitationProbability >= 60);

const isSnow = (w: WeatherData): boolean => /snow/i.test(w.condition);

const RULES: Rule[] = [
  // Umbrella + cold
  [(w) => needsUmbrella(w) && w.tempCelsius < 10, "傘を持って、厚手のコートで防寒を。"],
  // Umbrella + mild
  [(w) => needsUmbrella(w) && w.tempCelsius < 20, "傘を忘れずに。上着もあると安心です。"],
  // Umbrella + warm
  [(w) => needsUmbrella(w), "傘を持って出かけましょう。"],
  // Snow + cold
  [(w) => isSnow(w) && w.tempCelsius < 10, "防寒対策をしっかりして、足元に気をつけて。"],
  // Snow (mild, rare)
  [(w) => isSnow(w), "雪です。防寒と足元に注意しましょう。"],
  // Cold / clear
  [(w) => w.tempCelsius < 10, "厚手のコートが必要です。防寒を万全に。"],
  // Mild
  [(w) => w.tempCelsius < 20, "カーディガンか薄手のジャケットが快適です。"],
  // Warm — catch-all
  [() => true, "軽装でも大丈夫な陽気です。"],
];

// Compile-time length assertion helper (runs at module load, throws on bug).
function assertLength(s: string): string {
  const len = [...s].length;
  if (len > 40) {
    throw new Error(
      `[advise] BUG: advice string is ${len} chars (> 40): "${s}"`
    );
  }
  return s;
}

// Eagerly validate every static string at module load time.
for (const [, advice] of RULES) {
  assertLength(advice);
}

/**
 * Returns a Japanese outfit advice string (≤ 40 chars, no emoji) based on
 * the current weather. Pure function — no I/O, deterministic.
 *
 * Umbrella is advised when:
 *  - condition matches rain/drizzle/thunderstorm, OR
 *  - precipitationProbability >= 60
 */
export function advise(weather: WeatherData): string {
  for (const [predicate, advice] of RULES) {
    if (predicate(weather)) {
      return assertLength(advice);
    }
  }
  // Unreachable: the last rule is a catch-all.
  return assertLength("今日の天気に合わせてお出かけください。");
}
