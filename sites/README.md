# Style First — ChatGPT Sites migration package

This directory contains an **unpublished candidate**, not a live ChatGPT Site. The currently deployed Render application must stay online until migration, data import, and cross-browser verification are complete.

## App files
- `index.html`: the existing complete Style First app (all 12 stages / 15 exercises), updated answer comparison, original writing training UI and JSON import/export.
- `sites-sync-client.js`: Sign in with ChatGPT link, opt-in old-data import and cloud background syncing.
- `worker.mjs`: D1-backed API using Sites-provided signed-in identity.
- `icon.svg` and `manifest.webmanifest`: original app branding.

## Provision through ChatGPT Sites

Use Work/Sites to create a new Sites project from this folder. The desired runtime includes D1 named `DB`, a static assets binding `ASSETS`, the `worker.mjs` entry point, and Sign in with ChatGPT. Adapt the project structure if the current Sites starter requires it; **do not expose or guess identity headers in client code**. The server must authorize by the platform-provided `oai-authenticated-user-email` header only.

Publish to a **private test URL** first. Both build and publish must complete before claiming the migration is live. Do not remove or repoint Render until test acceptance.

## Data migration (first time)

1. **Open the current Render Style First in Arc**, where the Parental Pressure work and progress actually reside.
2. Choose **Settings → Export backup** and preserve the original JSON file in a safe location. Do not clear Arc's browser data.
3. Open the new ChatGPT Site (after it has been published) in Arc. **Sign in with ChatGPT**.
4. Choose **Settings → Import backup**, select the saved original Render JSON file, and verify the Parental Pressure essay and scores show correctly.
5. Select **☁ Sync → Merge this browser into cloud**. The merge is opt-in; local safety snapshot is saved before upload.
6. Open the new Site in Dia with the **same ChatGPT account**, verify identical essay collection and scoring history, and test adding and grading a new answer.
7. Reload both browsers and check that no scores/attempt histories disappear. Until all tests pass, retain the original Render deployment and all JSON backups.

## Data safety
- D1 state is scoped to the authenticated email.
- Conflict handling: a revision-based compare-and-swap retry loop for concurrent device merges.
- Merge preserves each essay's unique ID, previous attempts and saved alternative drafts.
- Before the first upload, user must explicitly opt in.
- Deletion tombstones prevent deleted essays from reappearing.
- No separate password storage on Sites: Sign in with ChatGPT is supplied by the hosting platform.
- Service-worker logic, cache, and the legacy offline practice features must be reviewed within the actual Sites preview; this folder is a migration starting point, **not a verified production deploy**.

## Corrected recall scoring
The correct target sentence contains **'children’s'**, while the learner may input **'children\'s'**. Their curly/straight apostrophes must be treated as equivalent and count 100% when all other words match. An optional `that` after `feel` (e.g., `where children feel that they must`) is a **minor wording difference**, not a substantive meaning error: it isn't exact reproduction, but should not be called a serious mistake. The feedback also lists words added by the learner, rather than highlighting the correct apostrophe.
