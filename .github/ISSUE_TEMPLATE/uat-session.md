---
name: UAT Session
about: Record results of a manual UAT session
title: "UAT — Week [X] — [YYYY-MM-DD]"
labels: uat
assignees: ""
---

## Environment

| Field | Value |
|---|---|
| Date | |
| Build commit | |
| Reasoning model | claude-sonnet-4-5 |
| App | |
| iOS version | |
| Supabase migrations | 001, 002, 003 |
| ADAS mock running | Yes / No |

---

## Results

- [ ] Test 1 — Basic round trip
- [ ] Test 2 — Identity extraction (name)
- [ ] Test 3 — Identity extraction (vehicle)
- [ ] Test 4 — Temporal statement (emotional_state, not preference_routing)
- [ ] Test 5 — Habitual preference (auto-promoted)
- [ ] Test 6 — UUID persistence across sessions
- [ ] Test 7 — Weather query
- [ ] Test 8 — Route query
- [ ] Test 9 — ADAS proactive alert (no numeric values)
- [ ] Test 10 — Memory cross-session

---

## Supabase state

- [ ] `users` — same UUID, no duplicates
- [ ] `sessions` — rows created, `ended_at` populated on close
- [ ] `messages` — turns logged, no FK errors
- [ ] `memory_candidates` — correct categories and statuses
- [ ] `memory_chunks` — auto-promoted facts present
- [ ] `feedback` — feedback events logged

---

## Issues found

<!-- Link to any issues opened from this session -->

---

## EVA response quality

**Good:**

**Needs work:**

---

## Overall

- [ ] PASS — all tests passed, ready for next week
- [ ] PARTIAL — most passed, minor issues noted above
- [ ] FAIL — blocking issues, need fixing before proceeding
