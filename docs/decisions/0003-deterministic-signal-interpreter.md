# ADR 0003 — Deterministic Signal Interpreter

**Status:** Accepted  
**Date:** 2026-05-14

## Context

Raw ADAS signals (steering angle, lateral acceleration, yaw rate, obstacle distances) could be fed directly to the reasoning LLM. The LLM could then interpret them.

This creates two problems:

1. **Cheating**: If signal values are passed with any labelling (even context like "this is from a braking scenario"), the LLM will pattern-match on the label, not reason over the physics. The interpretation will look correct but won't be.

2. **Safety-adjacent decisions**: LLMs can hallucinate or over-reason. Allowing the LLM to classify `longitudinal_acceleration = -7.2 m/s²` as "emergency braking" puts a probabilistic reasoner in a deterministic role.

## Decision

A deterministic `signal_interpreter` layer sits between raw VSS signals and the reasoning LLM.

- **Input**: raw `AdasSignalFrame` (array of VSS signals)
- **Output**: `InterpretedMetrics` (6 derived values: harshBrakingScore, fatigueRisk, lateralStabilityScore, forwardClearanceMeters, overtakeLikelihood, gapFitMarginMeters)
- **Properties**: pure functions, no LLM, no async, no I/O, fully unit-testable
- **Thresholds**: published automotive safety literature (Euro NCAP AEB protocol, Williamson 2001 SDLP)

The reasoning LLM receives `InterpretedMetrics`, not raw signals. It uses these to communicate with the driver, not to make safety decisions.

In dev/eval mode, scenario labels are known to the scenario runner but never included in any LLM input. The LLM must infer what is happening from the metric values.

## Consequences

- Signal interpreter is unit-tested independently of the LLM.
- Threshold changes are code changes with git history — auditable.
- LLM behaviour on ADAS signals is predictable and testable.
- The interpreter is the correct place to add new signal derivations as new scenarios are added.
- Threshold calibration will be refined when real OEM data is available.

## Rejected alternative

Raw signals directly to LLM. Rejected because of hallucination risk on safety-adjacent metrics and the LLM cheating problem with labelled test data.
