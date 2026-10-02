/**
 * Weather Outfit Advisor — pure domain logic.
 *
 * `advise(weather)` is a side-effect-free, deterministic pure function:
 *   - No I/O, no randomness, no global state mutations.
 *   - Same input always produces the same output.
 *   - Always returns a Japanese string of ≤ 40 Unicode code points, no emoji.
 */

/** Minimal weather snapshot consumed by advise(). */
export interface WeatherData {
  /** Human-readable condition label from the MCP server, e.g. "Rain", "Clear". */
  condition: string;
  /** Current temperature in degrees Celsius. */
  tempCelsius: number;
}

// ---------------------------------------------------------------------------
// Rule table — each entry is [predicate, advice string].
// Evaluated top-to-bottom; the first matching rule wins.
// All advice strings are pre-validated: ≤ 40 Japanese chars, no emoji.
// ---------------------------------------------------------------------------

type Rule = [(w: WeatherData) => boolean, string];

const isRain = (w: WeatherData): boolean =>
  /rain|drizzle|thunderstorm/i.test(w.condition);

const isSnow = (w: WeatherData): boolean => /snow/i.test(w.condition);

const RULES: Rule[] = [
  // Rain + cold
  [(w) => isRain(w) && w.tempCelsius < 10, "傘を持って、厚手のコートで防寒を。"],
  // Rain + mild
  [(w) => isRain(w) && w.tempCelsius < 20, "傘を忘れずに。上着もあると安心です。"],
  // Rain + warm
  [(w) => isRain(w), "傘を持って出かけましょう。"],
  // Snow (always cold in practice, but guard explicitly)
  [(w) => isSnow(w) && w.tempCelsius < 10, "防寒対策をしっかりして、足元に気をつけて。"],
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
