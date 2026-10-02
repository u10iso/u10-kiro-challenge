# Requirements — Weather Outfit Advisor CLI
> EARS (Easy Approach to Requirements Syntax) format

---

## Functional Requirements

### FR-01 — Weather Acquisition (Event-Driven)
**WHEN** the CLI is invoked,  
**THE SYSTEM SHALL** retrieve the current weather conditions and temperature for the user's location via an MCP server.

### FR-02 — Outfit Advice Generation (Ubiquitous)
**THE SYSTEM SHALL** produce a Japanese outfit advice string of 40 characters or fewer based solely on the retrieved weather data.

### FR-03 — Rain Advice (Event-Driven)
**WHEN** the retrieved weather condition includes rain (e.g., `Rain`, `Drizzle`, `Thunderstorm`),  
**THE SYSTEM SHALL** include a reference to carrying an umbrella in the advice string.

### FR-04 — Temperature-Aware Advice (State-Driven)
**WHILE** the retrieved temperature is lower than 10 °C,  
**THE SYSTEM SHALL** include a reference to warm clothing (e.g., coat, layers) in the advice string.

**WHILE** the retrieved temperature is between 10 °C (inclusive) and 20 °C (exclusive),  
**THE SYSTEM SHALL** recommend a light jacket or cardigan in the advice string.

**WHILE** the retrieved temperature is 20 °C or above,  
**THE SYSTEM SHALL NOT** recommend heavy outerwear in the advice string.

### FR-05 — Pure Advice Function (Ubiquitous)
**THE SYSTEM SHALL** implement outfit advice generation in a side-effect-free pure function `advise(weather)` that is independent of I/O.

### FR-06 — Character Limit (Ubiquitous)
**THE SYSTEM SHALL** guarantee that every string returned by `advise(weather)` is 40 characters or fewer.

### FR-07 — Language (Ubiquitous)
**THE SYSTEM SHALL** output the advice in Japanese and SHALL NOT include emoji characters.

### FR-08 — CLI Output (Event-Driven)
**WHEN** advice is successfully generated,  
**THE SYSTEM SHALL** print the advice string to standard output followed by a newline.

### FR-09 — Error Handling (Event-Driven)
**WHEN** the MCP weather server is unreachable or returns an error,  
**THE SYSTEM SHALL** print a human-readable Japanese error message to standard error and exit with a non-zero exit code.

---

## Non-Functional Requirements

### NFR-01 — Determinism
**THE SYSTEM SHALL** return the same advice string for identical `weather` inputs (deterministic, no randomness).

### NFR-02 — Test Coverage
**THE SYSTEM SHALL** include property-based tests written with `fast-check` that verify:
- Rain conditions always produce advice mentioning an umbrella.
- Lower temperatures do not produce advice for lighter clothing than higher temperatures.
- All outputs are 40 characters or fewer.
- The function is deterministic (same input → same output across multiple calls).

### NFR-03 — No External API in Pure Function
**THE SYSTEM SHALL NOT** perform any network I/O or filesystem access inside `advise(weather)`.
