# Company Boundary Implementation Checkpoint

## Design and evidence ownership

The complete target is [Integrated System Design](../architecture/SYSTEM_DESIGN.md): app, autonomous
firm, product/private source, main-only trunk, environments, Package/Verification/Deployment,
company data, artifact history/retention and recovery. Shared meanings belong to
[Contracts and State](../architecture/CONTRACTS_AND_STATE.md#company-source-package-verification-and-selected-use).
This file records implementation and limitations; it is not a competing architecture or a claim
that the target is deployed. Earlier app-source imports of actual Company code are retired.

## Current implementation

The [2026-09-15 Company flow review](COMPANY_FLOW_REVIEW.md) is a dated boundary audit.
Its original failure evidence is retained; the [Mac implementation record](MAC_APP.md) tracks
subsequent connection binding, notification routing, exact file discussion, original-call recovery
and owner-stop corrections. Full Company deployment/schema transitions, retention, scoped recovery,
autonomous operation and operating end remain separate work.

| Area | Current working-tree behavior | Remaining target |
| --- | --- | --- |
| Product source | Fixed shell, controls, design system, SDK distribution and native Company host; private module bootstrap is empty | Formal external compatibility/type/tooling surface and clean private-repository workflow |
| Company code/evidence | 89 prior source/evidence files archived outside the product checkout with SHA-256 verification before removing checkout copies | Actual private repository and registered durable company store; the archive is not either one |
| Profile | Versioned `company-profile.json` parser and name lookup; actual personal literals removed from reusable UI | Independent profile discovery; current loader reads profile through the selected UI configuration workspace |
| Composition | Versioned `company-ui.json`, namespace/reserved-route validation, Catalog publication with revision checks and readback | Separate composition updates from protected executable selection |
| Package | Native manifest/asset/SDK/digest and current-scope checks; bounded child WebView host and released component SDK | Environment-neutral package with source/build/dependency provenance; independent verification and target/data bindings |
| Bridge | Context, declared JSON artifact read, exact artifact open/discuss; no arbitrary URL/SQL/shell/owner/trading command | Typed permitted domain projections and complete selected-use lifetime enforcement |
| Artifact UI | Latest observed publications, exact native reads, integrity/size checks, escaped text preview, copy save | Historical discovery, creator vs publisher, evaluation/use/retention and disposal observations |
| Operation | Existing execution/control/conversation/resource primitives | Complete autonomous CEO/assignment/handover, integrated financial control/economic records, recovery and whole-product acceptance |
| Symmetric Company host | UI host foundations and managed service/execution primitives exist; unused investment draft removed from Cargo and preserved outside the product checkout | Company UI Host / Company Service Host; move financial UI, semantics/enforcement and Binance adapter source into private packages; implement selected service dispatch and mandatory final-operation validation before protected sending |

Product ignore/import/tracked-file/distribution checks complement each other; `.gitignore` alone
is not the boundary. The fixed owner capability targets only WebView `main`, not its parent window.
Private surfaces use separate incognito WebViews, fixed verified assets, navigation/CSP/bridge
restrictions, bounds, current authority checks and connection-change cleanup. Runtime failure
isolation still requires actual native evidence below.

## Existing package tooling, not the completed release contract

- `npm run build:sdk` in `apps/mac` builds the public component/style distribution from product UI.
- `scripts/package-company-ui.mjs <compiled-directory> <definition.json> <new-output-directory>`
  packages already-built files. Its product root is derived from the script location; company input/output live outside the checkout.
  The script hashes/copies assets and rejects symlinks/bounds violations. It does not compile company
  code, run tests, publish, acquire operating authority or select a release.
- The current native manifest is schema 1 with `companyId`, `id`, `version`, `sdkVersion`, `name`,
  hashed files, pages/widgets and bindings containing `path/revision`. It is **not** the proposed
  environment-neutral Package: company and same-workspace data bindings are still coupled to bytes.
- The current composition supports schema 2 package references `{id,path,revision,sha256}`. External
  publication plus refresh prepares referenced packages. Hash/scope verification is not independent
  technical acceptance or the full protected Deployment contract.
- Importing a candidate introducing an unprepared package does not yet form a complete install flow.
  The importer validates against the currently prepared registry. A successful upload/readback must
  not be labeled qualified installation, operating activation or actual native rendering.

The migration separates Package content from target company/environment/config/data bindings,
connects retained Verification and owning protected selected-use records, and loads profiles
independently. Existing v1 manifests/configurations need an explicit versioned compatibility path;
do not reinterpret old publication as prior acceptance. Retention holds, qualified previous release
selection, schema-aware rollback and independent main admission are not implemented by this loader.

## Retained verification checkpoint

These results are from the preceding implementation run, not newly executed by the integrated
architecture documentation update. They establish only their stated scope.

- Private source/evidence: 89 files copied outside the product checkout; SHA-256 compared before
  originals were removed; a private archive manifest remains. No real company repository was created.
- Frontend: 87 tests passed, including profile scope, pinned package references, reserved routes
  and existing configuration/notification behavior.
- Native: 9 tests passed for schema/path/package/bridge/capability and existing file constraints;
  one opt-in live Gateway test was not run in that suite.
- Frontend lint, production build, distribution scan, public SDK build and Tauri debug bundle passed.
  The local debug app was ad-hoc signed and signature verification passed; this is not notarized release.
- Packager checks verified exact asset digests and symlink rejection. A CI job was added but remote
  CI was not run for that checkpoint.
- Browser sample rendered data-backed fictional profile and fixed navigation. Its capture is outside
  product Git; it is not native Company WebView acceptance.
- Actual native rendering, hostile/hanging Company code, protected control usability, package version
  replacement, file dialogs and window close/reopen were **NOT VERIFIED** because the Mac was locked
  during that run. This documentation task does not change those results.

No new model calls, private repository/publication, live trading or Git publication were performed
for that refactor or this integrated documentation update. Earlier provider proof is private historical
evidence, not proof of complete app isolation, autonomous company operation or financial acceptance.

## Integrated design documentation verification — 2026-09-14

The integrated design update changed 15 Markdown documents. Scoped validation checked 280 local
links/anchors, table widths, code-fence pairing and diff whitespace. Independent read-only reviews
covered app/private-package boundaries, main-only release/artifact contracts, and autonomous
operation/economic accountability. Their substantive findings were incorporated.

The repository-wide `tests.support.check_integrity.check` attempt stopped with a UTF-8 decoding
error on existing generated Tauri assets under `apps/mac/src-tauri/target/`; it did not produce a
PASS result. The scoped document checks are separate evidence. No runtime suite was rerun, and
Mermaid diagrams were not render-tested in that documentation pass. Prior implementation counts
and native acceptance gaps above remain unchanged.

## Symmetric Company boundary correction — 2026-09-15

The owner clarified that the common operating environment must also exclude a built-in investment
domain. Fourteen documentation files now align Company UI Host and Company Service Host with
Company-owned financial UI/services/enforcement/adapters. Current source locations are retained as
migration evidence; no application/backend code was moved or executed in this correction.

Scoped document validation passed for 284 local links/anchors, table widths, code fences and diff
whitespace. Independent app and service/release reviews were incorporated, including Gateway
routing for service host calls and an explicit protected owner-operation handoff. Runtime tests,
native interaction and Mermaid rendering were not run; previous whole-repository check limits
and implementation acceptance gaps remain unchanged.

## Protected connection extension design

The [connection extension checkpoint](CONNECTION_EXTENSION_DESIGN.md) adds the accepted target for
secretless Company adapters and independently qualified Auth Modules under Resources. Source
ownership and protected execution trust are distinct. Ordinary Company acceptance cannot load
secret-consuming code; existing current delegation can cover new connections without a new human
gate. Module runtime, general enrollment/refresh/session/ingress and the Mac connection journey
remain implementation/qualification work, not evidence supplied by this design revision.
