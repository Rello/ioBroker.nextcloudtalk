# Repository Guidance

## Adapter behavior

- This is a CommonJS ioBroker adapter for sending messages to Nextcloud Talk. `main.js` contains the runtime; Node.js >= 22 is required.
- Instance settings are `server`, `username`, and `token`. The token is protected and encrypted in `io-package.json`; keep credentials out of logs and tests.
- The legacy send interface is `roomID` followed by a write to `text`. Preserve it for existing scripts and Blockly rules.
- The atomic send interface is a write to `send` with a JSON string such as `{"roomId":"abc123","text":"Hello"}`. Both fields must be non-empty strings. It must use the supplied room without changing `roomID`.
- Only unacknowledged (`ack=false`) writes trigger sending. Both interfaces call `sendMessage`, which posts to Talk's OCS chat endpoint with the configured account and app token.
- The adapter does not currently receive Talk messages or execute ioBroker actions from them. Do not document proposed receive behavior as implemented.

## Changes and compatibility

- Keep existing state IDs and their behavior stable. Add new states or settings rather than repurposing `roomID` or `text`.
- Create runtime states in `onReady` and subscribe to command states explicitly. Validate external state values before making API requests.
- When adding instance settings, update `io-package.json` defaults, `admin/jsonConfig.json`, and the corresponding `admin/i18n/*/translations.json` files. Protect and encrypt new secrets as appropriate.
- For Nextcloud API questions or changes, use the `nextcloud_developer_documentation` MCP server and check the official Talk API documentation. The GitHub MCP server is available for repository and PR operations.

## Tests and checks

- Keep focused runtime tests in `test/main.test.js`; mock Nextcloud HTTP calls. Cover both the new and legacy send paths when changing dispatch logic.
- Run `npm test -- --runInBand`, `npm run lint`, and `npm run check` for code changes. Run `npm run test:package` for package metadata changes and `npm run test:integration` for startup or adapter lifecycle changes.
- CI runs checks on Node.js 24 and adapter tests on Node.js 22, 24, and 26 across Linux, macOS, and Windows (`.github/workflows/test-and-release.yml`). Wait for relevant CI checks before merging.
- If Node.js/npm is unavailable on the host, use the existing Docker-based Node.js 24 environment for local checks. Do not treat a missing host runtime as a test failure.

## Documentation and releases

- Document user-visible state and behavior changes in `README.md` alongside the code change.
- Maintain the changelog in `README.md` by release, not by commit. Add user-facing changes under `Unreleased`, then move them to a versioned section when preparing that release. `CHANGELOG_OLD.md` is an archive, not the active changelog.
- For a release, add a translated entry for that version in `io-package.json` `common.news` and keep the versions in `package.json`, `package-lock.json`, and `io-package.json` aligned. Do not bump versions for routine feature commits.
- `npm run release` uses `.releaseconfig.json` with the ioBroker, license, and manual-review plugins. The GitHub workflow deploys on semantic-version tags (including prereleases) after checks pass; do not create a release or tag as part of an ordinary feature change.

## Git workflow

- Make focused changes on a dedicated branch, review the diff, and commit only task-related files. Preserve unrelated work in the checkout.
- Commit, push, and merge when requested. Use the configured Rello author identity and include `Signed-off-by: Rello <Rello@users.noreply.github.com>` in every commit.
- Prefer a PR for merging into `main`; confirm the required checks pass and verify the merged PR and remote `main` afterward.
