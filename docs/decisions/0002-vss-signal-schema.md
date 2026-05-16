# ADR 0002 — COVESA VSS Signal Schema

**Status:** Accepted  
**Date:** 2026-05-14

## Context

ADAS data is not available from any public OEM API. No OEM exposes raw ADAS signal streams at the developer layer — only diagnostic health flags (OK/ALERT). For EVA-1 development, mock data is required.

A signal schema must be chosen for the mock server and signal interpreter. This schema becomes the integration contract when real OEM data arrives in EVA-2.

## Decision

Use **COVESA Vehicle Signal Specification (VSS) v7.0** as the signal path vocabulary.

Reference: https://github.com/COVESA/vehicle_signal_specification

The mock server emits `VssSignal` objects with VSS-format paths (`Vehicle.Acceleration.Longitudinal`), SI units, and numeric/boolean values.

## Consequences

- The signal_interpreter uses VSS paths for all signal lookups.
- The `packages/adas-mock` signal catalogue (`signals.ts`) defines ~15 VSS paths needed for the four initial scenarios.
- When OEM ADAS data arrives in EVA-2, the adapter maps OEM proprietary signal names to VSS paths. The interpreter and orchestrator are untouched.
- Eclipse KUKSA.val (the most capable open ADAS simulation platform) uses VSS natively — future integration is straightforward.
- COVESA VSS is the only cross-OEM vocabulary that exists. OEM adoption is voluntary but growing.

## Rejected alternative

Custom signal schema. Rejected because it creates a proprietary vocabulary that must be manually mapped to any real OEM data, defeating the purpose of having a clean adapter interface.
