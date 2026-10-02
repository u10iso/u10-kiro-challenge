#!/usr/bin/env node
/**
 * Weather Outfit Advisor CLI
 *
 * Usage:
 *   weather-advice [--location <city>]
 *
 * Environment variables:
 *   WEATHER_LOCATION     Default location (overridden by --location)
 *   WEATHER_MCP_CMD      MCP server executable (default: uvx)
 *   WEATHER_MCP_ARGS     Comma-separated MCP server args (default: mcp-server-weather)
 */

import { fetchWeather } from "./mcp-client.js";
import { advise } from "./advise.js";

function parseArgs(argv: string[]): { location: string } {
  const args = argv.slice(2);
  const idx = args.indexOf("--location");
  const location =
    idx !== -1 && args[idx + 1]
      ? args[idx + 1]!
      : (process.env["WEATHER_LOCATION"] ?? "Tokyo");
  return { location };
}

async function main(): Promise<void> {
  const { location } = parseArgs(process.argv);

  let weather;
  try {
    weather = await fetchWeather(location);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`エラー: ${msg}\n`);
    process.exit(1);
  }

  const advice = advise(weather);
  process.stdout.write(advice + "\n");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`予期しないエラー: ${msg}\n`);
  process.exit(1);
});
