# Maintainr Workflow Verification

## Technician selection alignment

The technician portal derives `selectedTicketId` from the selected live assigned job. The displayed title, unit, category, priority, and status read from that same selected job object. The proof-photo mutation and completion mutation both receive `selectedTicketId`, so changing the selected job changes the visible detail and both mutation targets together. The implementation no longer uses a fixed ticket identifier for proof upload or completion.

The recommended manual check is to sign in as a technician with at least two assigned jobs, select the second job, confirm that its title and unit appear in the detail card, upload a proof image, and complete the job. The resulting media record and `RESOLVED` TicketLog should reference the selected job, not the first job.

## Tenant ticket plus multi-file workflow

Tenant submission creates the ticket first through `tickets.create`. Each selected file is then uploaded independently through `tickets.attachMedia` using `Promise.allSettled`, so one attachment failure does not discard a successfully created ticket or successful sibling attachments. The tenant UI retains the created ticket ID and reports the names of failed files.

The recommended manual check is to authenticate as a tenant, select two or more supported image/video files, submit a valid request, and confirm that the ticket is created before attachment results are displayed. The browser should show per-file `Uploading`, `Uploaded`, or `Failed` states.

## Partial failure and retry

The tenant flow stores failed `File` objects separately from successful uploads. The `Retry failed files` action reuses the persisted created ticket ID and retries only the failed files. A successful retry changes the per-file state to `Uploaded`; a second failure remains visible as `Failed` and keeps the retry action available. The client-side helper is covered by the existing media-upload test, while the backend attachment path is protected by organization-scoped ticket lookup.

## Automated evidence

The project’s final validation commands are `pnpm check` and `pnpm test`. The current suite includes direct tRPC caller coverage for ticket creation plus `TicketLog`, invalid direct-close and `RESOLVED` bypass rejection, valid `RESOLVED` to `CLOSED`, cross-organization status rejection, technician completion proof and notes, wrong-organization completion rejection, and first-time tenant unit binding.
