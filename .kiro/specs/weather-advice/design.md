# Design — Weather Outfit Advisor CLI

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  src/index.ts  (CLI entry point)                        │
│                                                         │
│  1. Call MCP tool: get_current_weather({ location })    │
│  2. Parse WeatherData from MCP response                 │
│  3. Call advise(weather) → string                       │
│  4. console.log(advice)                                 │
└──────────────────┬──────────────────────────────────────┘
                   │ WeatherData
┌──────────────────▼──────────────────────────────────────┐
│  src/advise.ts  (pure domain logic)                     │
│                                                         │
│  advise(weather: WeatherData): string                   │
│  • No I/O, no side effects, deterministic               │
│  • Returns ≤ 40 Japanese characters, no emoji           │
└─────────────────────────────────────────────────────────┘
```

---

## Data Model

```typescript
/** Minimal shape consumed by advise(). Sourced from MCP response. */
interface WeatherData {
  /** Human-readable condition label: e.g. "Rain", "Clear", "Clouds", "Snow" */
  condition: string;
  /** Current temperature in degrees Celsius */
  tempCelsius: number;
}
```

The MCP tool used is **`get_current_weather`** (OpenWeatherMap MCP or compatible).  
The CLI passes a location (city name or lat/lon) and maps the response to `WeatherData`.

---

## `advise(weather: WeatherData): string` — Logic

The function uses a rule table evaluated top-to-bottom; first match wins.

| Priority | Condition | Advice fragment |
|----------|-----------|-----------------|
| 1 | rain-like AND temp < 10 | 「傘を持って、厚手のコートで防寒を。」 |
| 2 | rain-like AND 10 ≤ temp < 20 | 「傘を忘れずに。上着もあると安心です。」 |
| 3 | rain-like AND temp ≥ 20 | 「傘を持って出かけましょう。」 |
| 4 | snow-like AND temp < 10 | 「防寒対策をしっかりして、足元に気をつけて。」 |
| 5 | temp < 10 (clear/clouds) | 「厚手のコートが必要です。防寒を万全に。」 |
| 6 | 10 ≤ temp < 20 | 「カーディガンか薄手のジャケットが快適です。」 |
| 7 | temp ≥ 20 | 「軽装でも大丈夫な陽気です。」 |

**Rain-like**: condition contains any of `rain`, `drizzle`, `thunderstorm` (case-insensitive).  
**Snow-like**: condition contains `snow` (case-insensitive).

All advice strings are pre-validated to be ≤ 40 chars and contain no emoji.

---

## Module Structure

```
weather-advice-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts          # CLI entry: MCP call → advise() → stdout
│   ├── advise.ts         # Pure function + WeatherData type
│   └── mcp-client.ts     # Thin wrapper: calls MCP tool, returns WeatherData
└── test/
    └── advise.test.ts    # fast-check property-based tests
```

---

## MCP Integration

The CLI uses the **`@modelcontextprotocol/sdk`** client (stdio or SSE transport) to call the weather MCP server. The server is expected to expose:

```
Tool name : get_current_weather
Input     : { location: string }
Output    : { weather: string, temperature: number, ... }
```

The `mcp-client.ts` module:
1. Spawns / connects to the MCP server process.
2. Calls `get_current_weather` with the location.
3. Maps the raw response to `WeatherData`.
4. Disconnects and returns.

Location defaults to `Tokyo` and can be overridden via `--location` CLI flag or `WEATHER_LOCATION` env var.

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| MCP server not found / timeout | Print Japanese error to stderr, exit code 1 |
| Tool returns unexpected shape | Print Japanese error to stderr, exit code 1 |
| advise() returns string > 40 chars | TypeScript compile-time unit test catches it; runtime assertion throws |

---

## Property-Based Test Design (fast-check)

```typescript
// Property 1 — Rain → umbrella
fc.property(rainWeatherArb, (w) => advise(w).includes("傘"))

// Property 2 — Lower temp → no lighter clothing than higher temp
// (cold advice must not be dominated by warm-day phrasing)
fc.property(coldWeatherArb, (w) => !isLightClothingAdvice(advise(w)))

// Property 3 — Length ≤ 40
fc.property(anyWeatherArb, (w) => [...advise(w)].length <= 40)

// Property 4 — Determinism
fc.property(anyWeatherArb, (w) => advise(w) === advise(w))
```

Arbitraries:
- `rainWeatherArb`: condition ∈ `["Rain","Drizzle","Thunderstorm"]`, temp ∈ [-10, 40]
- `coldWeatherArb`: condition ∈ `["Clear","Clouds"]`, temp ∈ [-20, 9]
- `anyWeatherArb`: condition ∈ all labels above, temp ∈ [-20, 45]
