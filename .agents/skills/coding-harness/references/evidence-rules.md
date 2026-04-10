# Evidence Rules

AutoKairos coding work closes with evidence, not intuition.

## Minimum Rule

At least one concrete verification artifact must exist:

- test output
- build output
- lint output
- typecheck output
- runtime verification output

If none can be produced, state that explicitly and explain why.

## Choose The Strongest Available Proof

- behavior change
  prefer tests and runtime verification
- build or wiring change
  prefer build and typecheck output
- static or style-only change
  prefer lint or explicit no-behavior-change note
- bug fix
  prefer reproduction evidence plus regression verification

## AutoKairos-Specific Expectation

When a change touches live-trading logic, stronger evidence is expected.
Relevant proof may include:

- unit or integration test coverage
- invariant checks
- simulated runtime verification
- explicit statement that live-path validation was intentionally not run

## Bad Evidence

These do not count by themselves:

- "looks correct"
- "small change"
- "same pattern as elsewhere"
- "the model is confident"

## Completion Language

When verification is partial, say so directly:

- what was verified
- what was not verified
- why it could not be verified now
- what risk remains
