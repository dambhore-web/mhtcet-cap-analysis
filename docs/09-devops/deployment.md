# Deployment

Status: nothing deployed. Target flow (Phase 6 onward):

1. Work on a task branch → pull request → CI green.
2. Merge → deploy to **staging** automatically (`DECISION REQUIRED`: merge target branch name).
3. Verify on staging (smoke checklist, created in Phase 6).
4. **The user approves** → promote the same build to **production**.
5. Roll back by redeploying the previous build; DB migrations are additive only (new columns with
   defaults), so the previous build stays compatible.

Data releases (new year, new round) follow the same path: pipeline run → run report reviewed →
load to staging → check → load to production.
