# Tasks — Weather Outfit Advisor CLI

Execution order: tasks are sequential unless marked **(parallel)**.

---

## Task 1 — Project Scaffold

- [ ] `mkdir -p weather-advice-cli/src weather-advice-cli/test`
- [ ] Create `package.json` with:
  - `name`, `version`, `type: "module"`
  - `bin`: points to compiled `dist/index.js`
  - `scripts`: `build`, `test`, `start`
  - Dependencies: `@modelcontextprotocol/sdk`
  - Dev deps: `typescript`, `fast-check`, `vitest`, `@types/node`
- [ ] Create `tsconfig.json` (target ES2022, moduleResolution bundler, strict)

**Acceptance**: `npm install` completes without errors.

---

## Task 2 — `WeatherData` type + `advise()` pure function

File: `src/advise.ts`

- [ ] Define and export `WeatherData` interface (`condition: string`, `tempCelsius: number`)
- [ ] Implement and export `advise(weather: WeatherData): string` following the rule table in design.md
- [ ] Assert at runtime that the returned string is ≤ 40 chars (throw `Error` if violated — indicates a programming error)
- [ ] Add a JSDoc comment documenting the contract (pure, deterministic, no I/O)

**Acceptance**: Each rule-table row is covered by at least one example-based unit check (can be inline `// @ts-expect-error` or a separate describe block).

---

## Task 3 — Property-Based Tests

File: `test/advise.test.ts`

- [ ] Import `advise` and `WeatherData` from `../src/advise`
- [ ] Define arbitraries:
  - `rainWeatherArb` — condition ∈ `["Rain","Drizzle","Thunderstorm"]`, tempCelsius ∈ [-10, 40]
  - `coldWeatherArb` — condition ∈ `["Clear","Clouds"]`, tempCelsius ∈ [-20, 9]
  - `anyWeatherArb` — all conditions, tempCelsius ∈ [-20, 45]
- [ ] Write property: **Rain → advice includes "傘"**
- [ ] Write property: **Cold (< 10 °C) → advice does NOT include light-clothing phrases** (e.g., 「軽装」)
- [ ] Write property: **All outputs ≤ 40 characters** (count Unicode code points with `[...s].length`)
- [ ] Write property: **Determinism** — `advise(w) === advise(w)` for same input

**Acceptance**: `npm test` exits 0; all four properties pass with default 100 runs each.

---

## Task 4 — MCP Client Wrapper

File: `src/mcp-client.ts`

- [ ] Import `Client` and stdio/SSE transport from `@modelcontextprotocol/sdk`
- [ ] Export `async function fetchWeather(location: string): Promise<WeatherData>`
  - Spawn / connect to the configured MCP server
  - Call tool `get_current_weather` with `{ location }`
  - Map response fields to `WeatherData` (`condition`, `tempCelsius`)
  - Disconnect after the call
- [ ] Throw a descriptive `Error` (Japanese message) on connection failure or malformed response

**Acceptance**: The function returns a valid `WeatherData` when a real or stub MCP server is running.

---

## Task 5 — CLI Entry Point

File: `src/index.ts`

- [ ] Parse `--location` flag (fallback: `process.env.WEATHER_LOCATION ?? "Tokyo"`)
- [ ] Call `fetchWeather(location)`
- [ ] Pass result to `advise(weather)`
- [ ] `console.log(advice)` (stdout, followed by newline)
- [ ] Catch all errors:
  - Print Japanese error message to `process.stderr`
  - `process.exit(1)`
- [ ] Add shebang `#!/usr/bin/env node` to compiled output (via `build` script or `tsconfig`)

**Acceptance**: Running `node dist/index.js` prints a Japanese advice string to stdout and exits 0.

---

## Task 6 — Build & Smoke Test

- [ ] `npm run build` — compiles TypeScript to `dist/`
- [ ] `npm test` — all property-based tests pass
- [ ] `node dist/index.js` — prints a Japanese advice string (manual verification)
- [ ] `node dist/index.js --location Osaka` — works with explicit location

**Acceptance**: All of the above complete without errors.

---

## Dependencies Summary

| Package | Role | Prod/Dev |
|---------|------|----------|
| `@modelcontextprotocol/sdk` | MCP client | prod |
| `typescript` | Compiler | dev |
| `fast-check` | Property-based testing | dev |
| `vitest` | Test runner | dev |
| `@types/node` | Node type stubs | dev |
