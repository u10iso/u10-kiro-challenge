/**
 * MCP client wrapper — fetches current weather from an MCP server and
 * maps the response to the WeatherData shape consumed by advise().
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { WeatherData } from "./advise.js";

/** Configuration for the MCP weather server process. */
export interface McpServerConfig {
  /** Executable to run, e.g. "uvx" or "npx". */
  command: string;
  /** Arguments passed to the executable, e.g. ["mcp-server-weather"]. */
  args: string[];
}

/**
 * Default MCP server: Open-Meteo based weather MCP server available via uvx.
 * Override via environment variables WEATHER_MCP_CMD / WEATHER_MCP_ARGS.
 */
function defaultConfig(): McpServerConfig {
  const cmd = process.env["WEATHER_MCP_CMD"] ?? "uvx";
  const argsEnv = process.env["WEATHER_MCP_ARGS"];
  const args = argsEnv ? argsEnv.split(",") : ["mcp-server-weather"];
  return { command: cmd, args };
}

/**
 * Fetches current weather for `location` from the MCP weather server.
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
  });

  const client = new Client(
    { name: "weather-advice-cli", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "get_current_weather",
      arguments: { location },
    });

    // The MCP SDK returns content as an array of content blocks.
    const content = result.content;
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("MCPサーバーから空のレスポンスが返されました。");
    }

    // Extract text content and parse JSON.
    const textBlock = content.find(
      (c): c is { type: "text"; text: string } => c.type === "text"
    );
    if (!textBlock) {
      throw new Error("MCPサーバーのレスポンスにテキストが含まれていません。");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(textBlock.text) as Record<string, unknown>;
    } catch {
      // Some servers return a plain text description; wrap it.
      return mapPlainText(textBlock.text);
    }

    return mapParsed(parsed);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`天気情報の取得に失敗しました: ${msg}`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// Response mapping helpers
// ---------------------------------------------------------------------------

/** Maps a parsed JSON response (various MCP server shapes) to WeatherData. */
function mapParsed(obj: Record<string, unknown>): WeatherData {
  // Shape A: { weather: "Rain", temperature: 8 }
  const condition =
    typeof obj["weather"] === "string"
      ? obj["weather"]
      : typeof obj["condition"] === "string"
        ? obj["condition"]
        : typeof obj["description"] === "string"
          ? obj["description"]
          : "Unknown";

  const rawTemp =
    obj["temperature"] ?? obj["temp"] ?? obj["temperature_celsius"] ?? obj["tempCelsius"];
  const tempCelsius = typeof rawTemp === "number" ? rawTemp : parseFloat(String(rawTemp));

  if (isNaN(tempCelsius)) {
    throw new Error(
      `MCPレスポンスから気温を読み取れませんでした: ${JSON.stringify(obj)}`
    );
  }

  return { condition, tempCelsius };
}

/** Fallback: extract weather info from a plain text MCP response. */
function mapPlainText(text: string): WeatherData {
  // Heuristic: look for temperature pattern like "15°C" or "15 C" or "15 degrees"
  const tempMatch = text.match(/([-\d.]+)\s*(?:°C|°c|℃|degrees?\s*C)/i);
  const tempCelsius = tempMatch ? parseFloat(tempMatch[1]!) : 20;

  // Detect rain keywords
  const condition = /rain|drizzle|shower|storm/i.test(text)
    ? "Rain"
    : /snow/i.test(text)
      ? "Snow"
      : /cloud/i.test(text)
        ? "Clouds"
        : "Clear";

  return { condition, tempCelsius };
}
