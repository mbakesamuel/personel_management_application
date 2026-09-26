---
name: Reorder General cards
overview: Reorder PERSONNEL_CHILD_TABLES so General tab cards follow the requested 3-row layout; place Contracts after Employments as the only table not named in the request.
todos:
  - id: reorder-cards
    content: Reorder PERSONNEL_CHILD_TABLES to match requested 3x3 + Contracts last
    status: completed
isProject: false
---

# Reorder General employee-table cards

## Target order (3 columns)

Row 1: Employments, Movements, Classifications  
Row 2: Departures, Family infos, Marital statuses  
Row 3: Insurances, Next of kin, Identifications  
Row 4: **Contracts** (appended — not in your list; kept so the feature remains reachable)

## Change

Reorder entries in [`personnelChildTables.ts`](packages/desktop/src/renderer/src/components/personnel/personnelChildTables.ts) `PERSONNEL_CHILD_TABLES` array to match above. No UI or API changes — the General grid already maps this array in order.

## File

- [`packages/desktop/src/renderer/src/components/personnel/personnelChildTables.ts`](packages/desktop/src/renderer/src/components/personnel/personnelChildTables.ts)
