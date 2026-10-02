/**
 * Property-based tests for advise() and wmoToCondition() using fast-check.
 *
 * Properties:
 *  1. Rain condition → advice always mentions "傘"
 *  2. precipitationProbability ≥ 60 → advice always mentions "傘"
 *  3. Cold conditions (< 10 °C) → advice never contains light-clothing phrases
 *  4. All outputs are ≤ 40 Unicode code points
 *  5. advise() is deterministic: same input → same output
 *  6. wmoToCondition() never throws for any integer 0–200
 *  (Bonus) Warm non-rain conditions do not advise heavy coats
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { advise, wmoToCondition, type WeatherData } from "../src/advise.js";

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
  precipitationProbability: fc.option(fc.integer({ min: 0, max: 100 }), {
    nil: undefined,
  }),
});

/** Dry weather but high precipitation probability (≥ 60). */
const highPrecipArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...DRY_CONDITIONS),
  tempCelsius: fc.integer({ min: -10, max: 40 }),
  precipitationProbability: fc.integer({ min: 60, max: 100 }),
});

/** Clear/cloudy weather in the cold range (< 10 °C), low precip. */
const coldWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...DRY_CONDITIONS),
  tempCelsius: fc.integer({ min: -20, max: 9 }),
  precipitationProbability: fc.option(fc.integer({ min: 0, max: 59 }), {
    nil: undefined,
  }),
});

/** Warm weather (≥ 20 °C), dry, low precip. */
const warmWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...DRY_CONDITIONS),
  tempCelsius: fc.integer({ min: 20, max: 45 }),
  precipitationProbability: fc.option(fc.integer({ min: 0, max: 59 }), {
    nil: undefined,
  }),
});

/** Any valid weather across all conditions and temperatures. */
const anyWeatherArb: fc.Arbitrary<WeatherData> = fc.record({
  condition: fc.constantFrom(...ALL_CONDITIONS),
  tempCelsius: fc.integer({ min: -20, max: 45 }),
  precipitationProbability: fc.option(fc.integer({ min: 0, max: 100 }), {
    nil: undefined,
  }),
});

// ---------------------------------------------------------------------------
// Helper
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
        expect(advise(weather)).toContain("傘");
      }),
      { numRuns: 200 }
    );
  });

  it("Property 2: precipitationProbability ≥ 60 always produces umbrella advice", () => {
    fc.assert(
      fc.property(highPrecipArb, (weather) => {
        expect(advise(weather)).toContain("傘");
      }),
      { numRuns: 200 }
    );
  });

  it("Property 3: cold conditions (< 10 °C, low precip) never produce light-clothing advice", () => {
    fc.assert(
      fc.property(coldWeatherArb, (weather) => {
        expect(isLightClothingAdvice(advise(weather))).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("Property 4: all outputs are ≤ 40 Unicode code points", () => {
    fc.assert(
      fc.property(anyWeatherArb, (weather) => {
        expect([...advise(weather)].length).toBeLessThanOrEqual(40);
      }),
      { numRuns: 500 }
    );
  });

  it("Property 5: advise() is deterministic (same input → same output)", () => {
    fc.assert(
      fc.property(anyWeatherArb, (weather) => {
        expect(advise(weather)).toBe(advise(weather));
      }),
      { numRuns: 200 }
    );
  });

  it("Property 6: wmoToCondition never throws for any integer 0–200", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (code) => {
        expect(() => wmoToCondition(code)).not.toThrow();
      }),
      { numRuns: 201 }
    );
  });

  // -------------------------------------------------------------------------
  // Bonus: warm non-rain conditions do not advise heavy outerwear
  // -------------------------------------------------------------------------
  it("Property 7: warm dry conditions (≥ 20 °C, low precip) do not advise heavy coats", () => {
    const HEAVY_PHRASES = ["コート", "防寒", "厚手"] as const;
    fc.assert(
      fc.property(warmWeatherArb, (weather) => {
        const result = advise(weather);
        const hasHeavy = HEAVY_PHRASES.some((p) => result.includes(p));
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
      ["high precip + mild", { condition: "Clouds", tempCelsius: 18, precipitationProbability: 70 }, "傘"],
      ["high precip + warm", { condition: "Clear", tempCelsius: 22, precipitationProbability: 80 }, "傘"],
      ["snow + cold", { condition: "Snow", tempCelsius: -2 }, "防寒"],
      ["cold clear", { condition: "Clear", tempCelsius: 3 }, "コート"],
      ["mild", { condition: "Clouds", tempCelsius: 14 }, "ジャケット"],
      ["warm", { condition: "Clear", tempCelsius: 28 }, "軽装"],
    ];

    it.each(examples)("%s", (_label, weather, expected) => {
      expect(advise(weather)).toContain(expected);
    });
  });

  // -------------------------------------------------------------------------
  // wmoToCondition mapping checks
  // -------------------------------------------------------------------------
  describe("wmoToCondition — spot checks", () => {
    const mapping: [number, string][] = [
      [0, "Clear"],
      [1, "Clouds"],
      [3, "Clouds"],
      [45, "Fog"],
      [51, "Drizzle"],
      [57, "Drizzle"],
      [61, "Rain"],
      [67, "Rain"],
      [71, "Snow"],
      [77, "Snow"],
      [80, "Rain"],
      [82, "Rain"],
      [85, "Snow"],
      [86, "Snow"],
      [95, "Thunderstorm"],
      [99, "Thunderstorm"],
      [100, "Unknown"],
    ];
    it.each(mapping)("WMO %d → %s", (code, expected) => {
      expect(wmoToCondition(code)).toBe(expected);
    });
  });
});
