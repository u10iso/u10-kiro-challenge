/**
 * MCP client wrapper — fetches current weather via a 2-step call to the
 * Open-Meteo MCP server and maps the response to WeatherData.
 *
 * Step 1: openmeteo_search_locations({ name }) → lat/lon
 * Step 2: openmeteo_get_forecast({ latitude, longitude, ... }) → weather snapshot
 *
 * Always reads from structuredContent, never from the text body.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { wmoToCondition, type WeatherData } from "./advise.js";

/** Configuration for the MCP weather server process. */
export interface McpServerConfig {
  /** Executable to run, e.g. "npx". */
  command: string;
  /** Arguments passed to the executable. */
  args: string[];
}

/**
 * Default MCP server: @cyanheads/open-meteo-mcp-server via npx.
 * Override via environment variables WEATHER_MCP_CMD / WEATHER_MCP_ARGS.
 */
function defaultConfig(): McpServerConfig {
  const cmd = process.env["WEATHER_MCP_CMD"] ?? "npx";
  const argsEnv = process.env["WEATHER_MCP_ARGS"];
  const args = argsEnv
    ? argsEnv.split(",")
    : ["-y", "@cyanheads/open-meteo-mcp-server"];
  return { command: cmd, args };
}

// ---------------------------------------------------------------------------
// Typed helpers for structuredContent shapes
// ---------------------------------------------------------------------------

interface LocationResult {
  latitude: number;
  longitude: number;
  name?: string;
}

interface SearchLocationsContent {
  results?: LocationResult[];
}

interface CurrentWeather {
  temperature_2m?: number | null;
  weather_code?: number | null;
}

interface DailyEntry {
  precipitation_probability_max?: number | null;
}

interface ForecastContent {
  current?: CurrentWeather;
  daily?: DailyEntry[];
}

/** Safely extract structuredContent from an MCP tool result. */
function getStructuredContent(result: unknown): Record<string, unknown> {
  if (
    result !== null &&
    typeof result === "object" &&
    "structuredContent" in result &&
    result.structuredContent !== null &&
    typeof result.structuredContent === "object"
  ) {
    return result.structuredContent as Record<string, unknown>;
  }
  return {};
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Fetches current weather for `location` from the MCP server.
 * Returns a WeatherData object for use with advise().
 * Throws a descriptive Error (Japanese message) on failure.
 */
export async function fetchWeather(
  location: string,
  config: McpServerConfig = defaultConfig()
): Promise<WeatherData> {
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args,
    // Suppress child-process stderr so the CLI only outputs the advice line.
    stderr: "ignore",
  });

  const client = new Client(
    { name: "weather-advice-cli", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    // ------------------------------------------------------------------
    // Step 1: location search → lat/lon
    // ------------------------------------------------------------------
    const searchResult = await client.callTool({
      name: "openmeteo_search_locations",
      arguments: { name: location },
    });

    const searchContent = getStructuredContent(searchResult) as SearchLocationsContent;
    const results = searchContent.results;

    if (!Array.isArray(results) || results.length === 0) {
      throw new Error(
        `地名「${location}」が見つかりませんでした。別の地名を試してください。`
      );
    }

    const first = results[0]!;
    const latitude = first.latitude;
    const longitude = first.longitude;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new Error(
        `地名「${location}」の座標情報を取得できませんでした。`
      );
    }

    // ------------------------------------------------------------------
    // Step 2: forecast fetch → temperature, weather_code, precip prob
    // ------------------------------------------------------------------
    const forecastResult = await client.callTool({
      name: "openmeteo_get_forecast",
      arguments: {
        latitude,
        longitude,
        timezone: "auto",
        forecast_days: 1,
        current_variables: ["temperature_2m", "weather_code"],
        daily_variables: ["precipitation_probability_max"],
      },
    });

    const forecastContent = getStructuredContent(forecastResult) as ForecastContent;
    const current = forecastContent.current;

    if (!current) {
      throw new Error(
        "天気予報サーバーから現在の天気データを取得できませんでした。"
      );
    }

    const temperature = current.temperature_2m;
    const weatherCode = current.weather_code;

    // Missing or null values are hard errors — no silent defaults.
    if (temperature === undefined || temperature === null) {
      throw new Error(
        "天気予報サーバーから気温データ (temperature_2m) を取得できませんでした。"
      );
    }
    if (weatherCode === undefined || weatherCode === null) {
      throw new Error(
        "天気予報サーバーから天気コード (weather_code) を取得できませんでした。"
      );
    }

    const precipitationProbability =
      forecastContent.daily?.[0]?.precipitation_probability_max ?? undefined;

    return {
      condition: wmoToCondition(weatherCode),
      tempCelsius: temperature,
      precipitationProbability:
        typeof precipitationProbability === "number"
          ? precipitationProbability
          : undefined,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Re-throw as Japanese error, avoiding double-wrapping our own messages.
    if (msg.startsWith("地名") || msg.startsWith("天気予報")) {
      throw new Error(msg);
    }
    throw new Error(`天気情報の取得に失敗しました: ${msg}`);
  } finally {
    await client.close();
  }
}
