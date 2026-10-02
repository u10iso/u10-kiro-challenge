# Design — Weather Outfit Advisor CLI

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  src/index.ts  (CLI entry point)                        │
│                                                         │
│  1. Call fetchWeather(location) → WeatherData           │
│  2. Call advise(weather) → string                       │
│  3. console.log(advice)                                 │
└──────────────────┬──────────────────────────────────────┘
                   │ WeatherData
┌──────────────────▼──────────────────────────────────────┐
│  src/advise.ts  (pure domain logic)                     │
│                                                         │
│  wmoToCondition(code): string   — pure, no I/O          │
│  advise(weather: WeatherData): string — pure, ≤40 chars │
└─────────────────────────────────────────────────────────┘
```

---

## MCP Server

**Server command**: `npx -y @cyanheads/open-meteo-mcp-server` (stdio)

Override via env vars:
- `WEATHER_MCP_CMD` — executable (default: `npx`)
- `WEATHER_MCP_ARGS` — comma-separated args (default: `-y,@cyanheads/open-meteo-mcp-server`)

---

## 2-Step MCP Call Flow

### Step 1 — Location search

```
Tool    : openmeteo_search_locations
Input   : { "name": "<location string>" }
Extract : structuredContent.results[0].latitude
          structuredContent.results[0].longitude
```

If `results` is empty or missing, throw a Japanese error and exit with code 1.

### Step 2 — Forecast fetch

```
Tool  : openmeteo_get_forecast
Input : {
  "latitude": <number>,
  "longitude": <number>,
  "timezone": "auto",
  "forecast_days": 1,
  "current_variables": ["temperature_2m", "weather_code"],
  "daily_variables": ["precipitation_probability_max"]
}
Extract:
  temperature  → structuredContent.current.temperature_2m   (°C)
  weatherCode  → structuredContent.current.weather_code     (WMO integer)
  precipProb   → structuredContent.daily[0].precipitation_probability_max  (%)
```

**Always use `structuredContent`, not the text body.**

If `temperature_2m` or `weather_code` is missing/null, throw a Japanese error — do not substitute a default value.

---

## Data Model

```typescript
/** Weather snapshot consumed by advise(). */
export interface WeatherData {
  /** Mapped condition string derived from WMO code, e.g. "Rain", "Clear". */
  condition: string;
  /** Current temperature in degrees Celsius. */
  tempCelsius: number;
  /** Today's max precipitation probability in % (0–100). Optional. */
  precipitationProbability?: number;
}
```

---

## WMO Code → Condition Mapping

Implemented as pure function `wmoToCondition(code: number): string` in `src/advise.ts`.

| WMO code range | Condition string |
|---------------|-----------------|
| 0             | `"Clear"`        |
| 1, 2, 3       | `"Clouds"`       |
| 45, 48        | `"Fog"`          |
| 51–57         | `"Drizzle"`      |
| 61–67         | `"Rain"`         |
| 71–77         | `"Snow"`         |
| 80–82         | `"Rain"` (showers) |
| 85–86         | `"Snow"` (snow showers) |
| 95–99         | `"Thunderstorm"` |
| other         | `"Unknown"`      |

The function must never throw for any integer input.

---

## `advise(weather: WeatherData): string` — Logic

Umbrella is triggered by **either**:
- `condition` matches rain/drizzle/thunderstorm (case-insensitive), **or**
- `precipitationProbability >= 60`

Rule table evaluated top-to-bottom; first match wins:

| Priority | Condition | Advice |
|----------|-----------|--------|
| 1 | umbrella AND temp < 10 | 「傘を持って、厚手のコートで防寒を。」 |
| 2 | umbrella AND temp < 20 | 「傘を忘れずに。上着もあると安心です。」 |
| 3 | umbrella | 「傘を持って出かけましょう。」 |
| 4 | snow AND temp < 10 | 「防寒対策をしっかりして、足元に気をつけて。」 |
| 5 | snow | 「雪です。防寒と足元に注意しましょう。」 |
| 6 | temp < 10 | 「厚手のコートが必要です。防寒を万全に。」 |
| 7 | temp < 20 | 「カーディガンか薄手のジャケットが快適です。」 |
| 8 | catch-all | 「軽装でも大丈夫な陽気です。」 |

All advice strings are pre-validated at module load to be ≤ 40 chars and emoji-free.

---

## Module Structure

```
weather-advice-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # CLI entry: parseArgs → fetchWeather → advise → stdout
│   ├── advise.ts         # wmoToCondition(), advise(), WeatherData
│   └── mcp-client.ts     # 2-step MCP call, returns WeatherData
└── test/
    └── advise.test.ts    # fast-check property-based tests
```

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Location not found (empty results) | Japanese error to stderr, exit 1 |
| MCP server not found / timeout | Japanese error to stderr, exit 1 |
| `temperature_2m` missing | Japanese error to stderr, exit 1 |
| `weather_code` missing | Japanese error to stderr, exit 1 |
| `advise()` returns > 40 chars | Runtime assertion throws (programming bug) |

---

## Property-Based Test Design (fast-check)

```typescript
// Property 1 — Rain condition → umbrella
fc.property(rainWeatherArb, (w) => advise(w).includes("傘"))

// Property 2 — precipitationProbability ≥ 60 → umbrella
fc.property(highPrecipArb, (w) => advise(w).includes("傘"))

// Property 3 — Cold (< 10°C) → no light-clothing phrases
fc.property(coldWeatherArb, (w) => !isLightClothing(advise(w)))

// Property 4 — All outputs ≤ 40 chars
fc.property(anyWeatherArb, (w) => [...advise(w)].length <= 40)

// Property 5 — Determinism
fc.property(anyWeatherArb, (w) => advise(w) === advise(w))

// Property 6 — wmoToCondition never throws
fc.property(fc.integer({ min: 0, max: 200 }), (code) => {
  expect(() => wmoToCondition(code)).not.toThrow();
})
```
