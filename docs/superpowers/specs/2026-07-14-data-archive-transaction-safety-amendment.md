# Data Archive Transaction Safety Amendment

## Scope

This amendment replaces Task 5's non-atomic import design. Archive inspection must not mutate live data, and confirmation must update `notes.json` and `assets` as one recoverable transaction.

## Responsibilities

- `DataArchiveService` creates deterministic allowlisted exports and performs central-directory, path, type, limit, manifest, digest, media, notes-schema, and asset-reference validation while streaming into a random staging directory.
- `ImportTransactionService` owns inspection leases, confirmation serialization, protected bundles, the durable journal, asset directory switching, note replacement, rollback, startup recovery, and retention cleanup.
- `AssetService` owns canonical asset filenames, safe reference collection, image MIME/magic validation, and the minimal live-asset snapshot operations needed by archive transactions.

## Import Lifecycle

Inspection writes only beneath a random, strictly prefixed directory in `userData`. A successful inspection is represented externally by a random 32-byte base64url identifier; the in-memory lease map never exposes its path. Leases expire after one hour and are consumed exactly once before confirmation. Unknown, expired, reused, and concurrently consumed identifiers fail.

Before confirmation, every staged file is rechecked with `lstat`, streamed size and SHA-256 verification, strict notes validation, media verification, and asset-reference closure. Confirmation then creates and verifies a complete protected bundle containing the old notes snapshot, all live assets, and a hash manifest. No live asset may be removed or replaced until that bundle is durably published.

The durable journal records `protected`, `assets-swapped`, `notes-replaced`, and `committed` phases using atomic same-directory replacement. Assets switch by same-volume directory renames, followed by `NoteStore.replaceSnapshot(imported, 'import')`. Any runtime failure immediately restores both notes and assets from protected data. On startup, every phase before `committed` is rolled back; `committed` only finishes cleanup. Recovery runs before notes/config warmup.

## Archive Contract

Exports contain only sorted explicit entries: `manifest.json`, `notes.json`, and canonical `assets/<uuid>.<png|jpg|jpeg|gif|webp>` files. Manifest version 1 records format, export time, notes version and counts, notes SHA-256, and each asset's filename, MIME type, size, and SHA-256. Configuration, backups, trash, staging, journals, and protected bundles are never exported.

Import rejects unsafe Windows or POSIX paths, duplicate or conflicting names, unsupported ZIP entry types or algorithms, encryption, undeclared entries, malformed manifests, schema failures, digest/size/media mismatches, limit violations, and missing referenced assets. Valid unreferenced assets are retained and reported as orphans.

## Retention And Failure Policy

Startup cleanup only touches entries with exact service-owned prefixes. Staging older than one hour and protected bundles older than seven days are removed after type and containment checks. Partial export files, failed staging trees, expired leases, completed imports, and failed confirmations are cleaned without touching unrelated files. Protected-bundle or journal publication failure is fail-closed.

## Verification

Tests cover round trips, path and ZIP metadata attacks, duplicate and prefix conflicts, all limits, manifest/digest/media consistency, missing and orphan assets, zero live mutation during inspection, lease expiry and concurrency, failure injection at every transaction phase, journal recovery at every phase, startup ordering, cleanup boundaries, type checking, and production build.
