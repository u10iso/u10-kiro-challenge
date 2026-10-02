/**
 * Property-based tests for advise() using fast-check.
 *
 * Four properties verified:
 *  1. Rain conditions → advice always mentions "傘"
 *  2. Cold conditions (< 10 °C) → advice never contains light-clothing phrases
 *  3. All outputs are ≤ 40 Unicode code points
 *  4. advise() is deterministic: same input → same output
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { advise, type WeatherData } from "../src/advise.js";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const RAIN_CONDITIONS = ["Rain", "Drizzle", "Thunderstorm"] as const;
const SNOW_CONDITIONS = ["Snow"] as const;
const DRY_CONDITIONS = ["Clear", "Clouds", "Mist", "Fog", "Haze"] as const;
const ALL_CONDITIONS = [
  ...RAIN_CONDITIONS,
  ...SNOW_CONDITIONS,
  ...DRY_CONDITIONS,
] as const;

/** Rainy weather, temperature in a realistic range. */
const rainWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...RAIN_CONDITIONS),
  tempCelsius: fc.integer({ min: -10, max: 40 }),
});

/** Clear/cloudy weather in the cold range (< 10 °C). */
const coldWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...DRY_CONDITIONS),
  tempCelsius: fc.integer({ min: -20, max: 9 }),
});

/** Warm weather (≥ 20 °C), any non-rain condition. */
const warmWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...DRY_CONDITIONS),
  tempCelsius: fc.integer({ min: 20, max: 45 }),
});

/** Any valid weather across all conditions and temperatures. */
const anyWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...ALL_CONDITIONS),
  tempCelsius: fc.integer({ min: -20, max: 45 }),
});

// ---------------------------------------------------------------------------
// Helper: phrases that indicate light/summer clothing
// ---------------------------------------------------------------------------
const LIGHT_PHRASES = ["軽装", "薄着", "半袖"] as const;

function isLightClothingAdvice(advice: string): boolean {
  return LIGHT_PHRASES.some((phrase) => advice.includes(phrase));
}

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("advise() — property-based tests", () => {
  it("Property 1: rain conditions always mention umbrella (傘)", () => {
    fc.assert(
      fc.property(rainWeatherArb, (weather) => {
        const advice = advise(weather);
        expect(advice).toContain("傘");
      }),
      { numRuns: 200 }
    );
  });

  it("Property 2: cold conditions (< 10 °C) never produce light-clothing advice", () => {
    fc.assert(
      fc.property(coldWeatherArb, (weather) => {
        const advice = advise(weather);
        expect(isLightClothingAdvice(advice)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("Property 3: all outputs are ≤ 40 Unicode code points", () => {
    fc.assert(
      fc.property(anyWeatherArb, (weather) => {
        const advice = advise(weather);
        expect([...advice].length).toBeLessThanOrEqual(40);
      }),
      { numRuns: 500 }
    );
  });

  it("Property 4: advise() is deterministic (same input → same output)", () => {
    fc.assert(
      fc.property(anyWeatherArb, (weather) => {
        expect(advise(weather)).toBe(advise(weather));
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // Bonus: warm conditions do not advise heavy outerwear
  // -------------------------------------------------------------------------
  it("Property 5: warm conditions (≥ 20 °C, no rain) do not advise heavy coats", () => {
    const HEAVY_PHRASES = ["コート", "防寒", "厚手"] as const;
    fc.assert(
      fc.property(warmWeatherArb, (weather) => {
        const advice = advise(weather);
        const hasHeavy = HEAVY_PHRASES.some((p) => advice.includes(p));
        expect(hasHeavy).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  // -------------------------------------------------------------------------
  // Example-based smoke tests (one per rule-table row)
  // -------------------------------------------------------------------------
  describe("example-based rule coverage", () => {
    const examples: [string, WeatherData, string][] = [
      ["rain + cold", { condition: "Rain", tempCelsius: 5 }, "傘"],
      ["rain + mild", { condition: "Drizzle", tempCelsius: 15 }, "傘"],
      ["rain + warm", { condition: "Thunderstorm", tempCelsius: 25 }, "傘"],
      ["snow + cold", { condition: "Snow", tempCelsius: -2 }, "防寒"],
      ["cold clear", { condition: "Clear", tempCelsius: 3 }, "コート"],
      ["mild", { condition: "Clouds", tempCelsius: 14 }, "ジャケット"],
      ["warm", { condition: "Clear", tempCelsius: 28 }, "軽装"],
    ];

    it.each(examples)("%s", (_label, weather, expected) => {
      expect(advise(weather)).toContain(expected);
    });
  });
});
