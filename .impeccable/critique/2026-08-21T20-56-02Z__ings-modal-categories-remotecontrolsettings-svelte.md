---
target: remote control panel
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-21T20-56-02Z
slug: ings-modal-categories-remotecontrolsettings-svelte
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
| --- | --- | --- | --- |
| 1 | Visibility of System Status | 3 | Active state is visible, but copy confirmation is only transient. |
| 2 | Match System / Real World | 3 | The empty-folder instruction is easy to miss beside a long token. |
| 3 | User Control and Freedom | 2 | Revocation is available but its immediate consequence is unclear. |
| 4 | Consistency and Standards | 3 | The visual system is consistent; the nested title repeats the category heading. |
| 5 | Error Prevention | 1 | The credential-like command is exposed without concise handling guidance. |
| 6 | Recognition Rather Than Recall | 2 | Users must remember where to put the target folder path. |
| 7 | Flexibility and Efficiency | 3 | Copy is efficient, though the terminal handoff is not guided. |
| 8 | Aesthetic and Minimalist Design | 3 | Calm and compact, but the raw token dominates the panel. |
| 9 | Error Recovery | 2 | The panel does not explain how revocation affects an existing mount. |
| 10 | Help and Documentation | 1 | No compact explanation of patch scope or command handling. |
| **Total** |  | **23/40** | **Needs focused hardening** |

## Design Specificity Verdict

The ink, zinc, Ember, semantic green/red, and mono command treatment fit the
Patchies editor. The enabled-service card is otherwise a generic developer-tool
pattern and does not make the patch-scoped handoff clear enough.

The deterministic scan reported one `gray-on-color` warning at
`RemoteControlSettings.svelte:90`. It is a false positive: the persistent
command field is near-black; the orange utility only styles text selection.

## Priority Issues

1. **[P1] The mount step is not executable from recognition alone.** The
   target folder placeholder sits after a long opaque value, so users cannot
   immediately see what to replace. Make the flow Copy command, then paste in
   Terminal and replace the path placeholder.
2. **[P1] The raw token has too much visual weight.** It reads as secret
   transport rather than a guided setup. Make Copy the primary action and
   reveal the full command only on demand.
3. **[P2] The nested title repeats the category header.** Replace it with
   active patch-scoped status so the next action starts higher in the panel.
4. **[P2] Revocation is visually strong but behaviorally vague.** Say that
   revocation immediately invalidates the mount command and existing local
   client access.

## Persona Red Flags

- **Alex, power user:** can copy quickly but must visually hunt through a long
  command to understand the required path argument.
- **Jordan, first-timer:** has to learn Remote Control, CLI, mount, token, and
  the terminal handoff at once.
- **Sam, accessibility-dependent:** tiny status and helper text make the
  important copy/run/revoke sequence harder to scan.

## Minor Observations

- The read-only textarea still presents a resize affordance.
- The status cluster is crowded against the destructive action.
- The command is a privileged handoff and benefits from a concise privacy note.

## Questions Skipped

The issues are straightforward and the user explicitly requested critique plus
polish in the same task.
