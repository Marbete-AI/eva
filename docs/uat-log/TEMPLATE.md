# UAT Session — [Week X] — [YYYY-MM-DD]

Copy this file, rename it to `YYYY-MM-DD-week-X.md`, fill in results, commit.

---

## Environment

| Field | Value |
|---|---|
| Date | |
| Build commit | `git log --oneline -1` |
| Reasoning model | claude-sonnet-4-5 |
| App | iPhone XX Simulator / Physical device |
| iOS version | |
| Supabase migrations applied | 001, 002, 003 |
| ADAS mock running | Yes / No |
| API keys active | Anthropic, OpenAI, Maps, Weather, Gemini |

---

## Results

Mark each test: PASS / FAIL / SKIP (with reason)

| # | Test | Result | Notes |
|---|---|---|---|
| 1 | Basic round trip | | |
| 2 | Identity extraction — name | | |
| 3 | Identity extraction — vehicle | | |
| 4 | Temporal statement — emotional_state not preference | | |
| 5 | Habitual preference — auto-promoted | | |
| 6 | UUID persistence across sessions | | |
| 7 | Weather query — tool called, no Markdown | | |
| 8 | Route query — tool called, 1-2 sentences | | |
| 9 | ADAS proactive alert — no numeric values | | |
| 10 | Memory cross-session — facts recalled | | |

---

## Supabase state

| Table | Expected | Actual |
|---|---|---|
| `users` | 1 row, same UUID | |
| `sessions` | 1+ rows, all same user_id | |
| `messages` | Turns logged, no FK errors | |
| `memory_candidates` | Correct categories and statuses | |
| `memory_chunks` | Auto-promoted facts present | |
| `memory_confirmations` | Confirmation questions logged | |
| `feedback` | Feedback events logged | |
| `behavioural_patterns` | Patterns after 3+ sessions | |

---

## Issues found

List any failures, unexpected behaviours, or things to fix.
Open a GitHub Issue for each one and link it here.

| Issue | Severity | GitHub Issue |
|---|---|---|
| | | |

---

## EVA response quality notes

Notes on tone, length, accuracy, phrasing. Things that worked well and things that felt off.

**Good:**

**Needs work:**

---

## Actions from this session

- [ ] Fix: ...
- [ ] Investigate: ...
- [ ] Next session: ...

---

## Sign-off

Tested by: Jas Singh
Session duration: ~ mins
Overall: PASS / FAIL / PARTIAL
