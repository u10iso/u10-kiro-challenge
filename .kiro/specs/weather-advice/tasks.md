# Tasks — Weather Outfit Advisor CLI

Execution order: tasks are sequential unless marked **(parallel)**.

---

## Task 1 — Project Scaffold ✅

- [x] `mkdir -p weather-advice-cli/src weather-advice-cli/test`
- [x] Create `package.json` with:
  - `name`, `version`, `type: "module"`
  - `bin`: points to compiled `dist/index.js`
  - `scripts`: `build`, `test`, `start`
  - Dependencies: `@modelcontextprotocol/sdk`
  - Dev deps: `typescript`, `fast-check`, `vitest`, `@types/node`
- [x] Create `tsconfig.json` (target ES2022, moduleResolution bundler, strict)

**Acceptance**: `npm install` completes without errors.

---

## Task 2 — `WeatherData` type + `advise()` pure function ✅

File: `src/advise.ts`

- [x] Define and export `WeatherData` interface (`condition: string`, `tempCelsius: number`)
- [x] Implement and export `advise(weather: WeatherData): string` following the rule table in design.md
- [x] Assert at runtime that the returned string is ≤ 40 chars
- [x] Add JSDoc documenting the contract

**Acceptance**: Each rule-table row covered by at least one example-based check.

---

## Task 3 — Property-Based Tests ✅

File: `test/advise.test.ts`

- [x] Property: **Rain → advice includes "傘"**
- [x] Property: **Cold (< 10 °C) → no light-clothing phrases**
- [x] Property: **All outputs ≤ 40 characters**
- [x] Property: **Determinism**

**Acceptance**: `npm test` exits 0; all properties pass.

---

## Task 4 — MCP Client Wrapper (Updated) ✅→🔄

File: `src/mcp-client.ts`

- [x] Basic MCP client with `@modelcontextprotocol/sdk`
- [ ] **Replace** single `get_current_weather` call with 2-step flow:
  1. `openmeteo_search_locations({ name: location })` → extract lat/lon from `structuredContent.results[0]`
  2. `openmeteo_get_forecast({ latitude, longitude, timezone: "auto", forecast_days: 1, current_variables: [...], daily_variables: [...] })` → extract from `structuredContent`
- [ ] Use `structuredContent` exclusively (not text body)
- [ ] Map `weather_code` via `wmoToCondition()` to `condition`
- [ ] Map `precipitation_probability_max` to `precipitationProbability`
- [ ] Throw Japanese error if `temperature_2m` or `weather_code` is missing
- [ ] Default server: `npx -y @cyanheads/open-meteo-mcp-server`

---

## Task 5 — CLI Entry Point ✅

File: `src/index.ts`

- [x] Parse `--location` flag (fallback: env `WEATHER_LOCATION` → `"Tokyo"`)
- [x] Call `fetchWeather(location)` → `advise(weather)` → stdout
- [x] Catch errors → Japanese message to stderr + exit 1

---

## Task 6 — advise() / WeatherData Updates

File: `src/advise.ts`

- [ ] Add `precipitationProbability?: number` to `WeatherData`
- [ ] Export `wmoToCondition(code: number): string` — pure, never throws
- [ ] Update umbrella predicate: trigger on rain condition **OR** `precipitationProbability >= 60`

---

## Task 7 — Extended Property Tests

File: `test/advise.test.ts`

- [ ] Property: **precipitationProbability ≥ 60 → includes "傘"**
- [ ] Property: **wmoToCondition never throws for any integer 0–200**
- [ ] Keep existing 4 properties (rain/cold/40chars/determinism)

---

## Task 8 — Build & Smoke Test

- [ ] `npm run build` — compiles TypeScript to `dist/`
- [ ] `npm test` — all property-based tests pass
- [ ] `node dist/index.js --location Tokyo` — prints a Japanese advice string

---

## Dependencies Summary

| Package | Role | Prod/Dev |
|---------|------|----------|
| `@modelcontextprotocol/sdk` | MCP client | prod |
| `typescript` | Compiler | dev |
| `fast-check` | Property-based testing | dev |
| `vitest` | Test runner | dev |
| `@types/node` | Node type stubs | dev |
