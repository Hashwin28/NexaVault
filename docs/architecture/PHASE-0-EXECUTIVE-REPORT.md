# NexaVault — Phase 0: Executive Architecture & Verification Report

**Role**: Senior Software Architect  
**Date**: 2026-11-21  
**Status**: PHASE 0 COMPLETE — AWAITING EXPLICIT APPROVAL BEFORE IMPLEMENTATION  

---

## 1. What Is Actually Implemented Today

NexaVault is a functional, single-process web application with a decoupled client-server architecture:
* **Backend**: FastAPI 0.110+ serving synchronous endpoints connected to PostgreSQL (Neon Serverless Pooler / local) via SQLAlchemy 2.0 ORM.
* **Frontend**: React 18.3 SPA styled with Tailwind CSS, utilizing Vite 6, custom hash routing (`#tab?query`), context-based authentication, and DOM-mounted view retention.
* **Current Execution State**: **132 automated backend tests passing** in `pytest` (113.58s runtime on Python 3.13 against in-memory SQLite).
* **Core Implemented Domains**:
  * Student group formation with alphanumeric join codes.
  * Academic workspace creation with co-staff access delegation.
  * 24-hour expiring notices with Pillow WebP image processing.
  * Review round milestone pipeline with weight and max score validation.
  * Milestone deliverable uploads with immutable `roster_snapshot` freezing.
  * Review queue with PostgreSQL `FOR UPDATE` row locking during claiming.
  * Individualized student scoring (averting flat group marks).
  * Released results dashboard with UTF-8 BOM CSV export and audited grade corrections.
  * Structured audit logging with sensitive data scrubbing (`[REDACTED]`).

---

## 2. What the Previous Blueprint Got Right vs. What It Got Wrong

### What the Previous Blueprint Got Right
1. **Accurate Assessment Model Identification**: Correctly highlighted individual student grading, immutable frozen roster snapshots on submission, and row-level locking during review claiming.
2. **Controller Bloat Detection**: Accurately called out massive controller sizes in `workspaces.py` (1,864 LOC), `admin.py` (1,724 LOC), and `projects.py` (1,007 LOC).
3. **Pillow & Audit Scrubbing**: Accurately documented direct image validation and recursive sanitization of passwords and tokens.

### What the Previous Blueprint Got Wrong / Overlooked
1. **Smart Search Defect**: The blueprint claimed Smart Search was role-isolated for all three roles. In reality, [search.py:32,166](file:///d:/SEM_3/23AID204-A_DSA/PROJECT/NexaVault/backend/app/api/v1/endpoints/search.py#L32) **lacks administrator search logic completely**; administrators fall into the student branch and always receive empty results.
2. **Untagged Workspace Leakage**: The blueprint overlooked that `app/core/permissions.py:94` and `admin.py:105` explicitly allow department administrators to access workspaces where `department IS NULL`, leaking untagged workspaces across departments.
3. **Hardcoded Startup Credentials**: The blueprint did not identify that `app/main.py:85-138` re-provisions and reactivates default administrator accounts on **every server reboot** with hardcoded password `AdminVault2026!`.
4. **Dormant Persistence Models**: The blueprint treated `RefreshToken`, `EmailToken`, and `AuditMerkleRoot` as functioning features, whereas codebase inspection proves **zero operational code** interacts with these models.
5. **Caching Reality**: The blueprint praised in-memory caching for sub-millisecond responses, but missed that it uses an in-process `OrderedDict` with `copy.deepcopy` that will desynchronize under multi-worker Uvicorn configurations.

---

## 3. ADR Decisions: Resolved vs. Dependent on Further Evidence

### Resolved Decisions (ADR 2.0)
* **ADR-001 (Architectural Style)**: Resolved to adopt Hexagonal Architecture + DDD + Modular Monolith + Selective CQRS in a single deployable backend. Microservices, Kafka, and Kubernetes are formally rejected.
* **ADR-002 (Administrator Scope)**: Resolved to enforce department-scoped administrators by default. `NULL` department never grants global access; untagged workspaces are hidden; administrators cannot grade or publish marks. Super-admin is deferred.
* **ADR-003 (Core Transactions)**: Resolved that evaluations, individual results, and audit entries must commit atomically in synchronous transactions. Core academic state is never relegated to eventual consistency.
* **ADR-004 (Transactional Outbox)**: Resolved to use a PostgreSQL `outbox_events` table with `SELECT ... FOR UPDATE SKIP LOCKED`, exponential retry backoff, and at-least-once delivery.
* **ADR-005 (Audit Architecture)**: Resolved to establish two tiers: mandatory in-transaction audit for sensitive actions vs. asynchronous outbox activity for non-critical feeds. Merkle root checkpointing is formally deferred.
* **ADR-008 (Bounded Contexts)**: Resolved to partition into 9 explicit bounded contexts with strict zero-direct-ORM rules across context boundaries.
* **ADR-009 (Selective CQRS)**: Resolved to use command handlers for writes and optimized SQL joins for reads within a single PostgreSQL database.

### Decisions Dependent on Further Evidence
* **Token Transport (Cookies vs. Bearer)**: Dependent on whether production deployment runs frontend and backend on the same origin (enabling `HttpOnly` `SameSite=Lax` cookies) or across decoupled domains (e.g. Vercel + Render).
* **Argon2id Upgrade Timeline**: Dependent on inspecting user password migration load during live sessions.
* **Audit Merkle Checkpointing**: Dependent on institutional key management and digital verification requirements.

---

## 4. Critical Security and Data-Integrity Risks

| Risk Level | Finding | Source Reference | Impact | Remediation in Phase 1 |
|---|---|---|---|---|
| **CRITICAL** | Hardcoded administrator credentials in startup code and migrations | `app/main.py:104,122`, `alembic/.../h8i9j0k1l2m3.py:57` | Default static password `AdminVault2026!` active in every environment | Remove auto-provisioning from startup; require environment-provided secrets |
| **CRITICAL** | Default fallback JWT secret | `app/core/config.py:21` | If `JWT_SECRET` is unset, static default key enables arbitrary token forgery | Fail startup in production if `JWT_SECRET` is unset or equals fallback |
| **HIGH** | Global single-group constraint on students | `app/models/group.py:38` (`UniqueConstraint("user_id")`) | Students cannot join different project groups for different enrolled courses | Scope group memberships per workspace in Phase 4 migration |
| **HIGH** | Unauthenticated static media directory | `app/main.py:56` (`app.mount("/uploads", ...)`) | Uploaded notice media served publicly without tenant or role checks | Replace with authenticated attachment streaming endpoint |
| **MEDIUM** | In-process cache desynchronization | `app/core/cache.py:26-59` | Multi-worker Uvicorn serves stale review queues and released marks | Introduce Redis cache provider adapter in Phase 1 |
| **MEDIUM** | Missing Administrator search branch | `app/api/v1/endpoints/search.py:32,166` | Administrators cannot search department workspaces or projects | Add dedicated department-isolated admin search branch in Phase 8 |

---

## 5. Verified Database Relationships & Workflows Summary

* **Database Reality**: 20 tables verified in ORM; 10 Alembic migrations verified.
* **Relational Isolation**:
  * `groups` and `workspaces` are completely unlinked except through the associative table `workspace_groups`.
  * `group_memberships` contains only `(group_id, user_id)` and has **no foreign key to `workspaces`**.
  * `submissions` binds strictly to `(project_id, round_id)` with a unique constraint.
  * `submission_versions` contains the immutable `roster_snapshot` JSON array.
  * `reviews` has a 1-to-1 unique foreign key to `submission_versions.id`.
  * `result_entries` has a unique constraint on `(review_id, student_id)` and a check constraint `score >= 0`.
* **Workflows Verified**:
  * 8 Student workflows traced end-to-end (Registration $\to$ Group Join $\to$ Enrollment $\to$ Project $\to$ Submission $\to$ Results).
  * 6 Staff workflows traced end-to-end (Workspace $\to$ Round Config $\to$ Queue Claim $\to$ Scoring $\to$ Release $\to$ Correction).
  * 3 Administrator workflows traced end-to-end (Dashboard $\to$ Workspace Lifecycle $\to$ Status/Provisioning).

---

## 6. Recommended Implementation Sequence

```
Phase 0 (Completed & Verified)
    └── Phase 1: Security Hardening & Outbox Schema
            └── Phase 2: Notifications Context Extraction
                    └── Phase 3: Identity & Access Context Extraction
                            └── Phase 4: Group Management (Workspace Invariant Migration)
                                    └── Phase 5: Workspace Management Extraction
                                            └── Phase 6: Assessment & Submission Extraction
                                                    └── Phase 7: Evaluation & Results Extraction
                                                            └── Phase 8: Department Governance & Outbox Relay
                                                                    └── Phase 9: Router Cutover & Legacy Sunset
```

---

## 7. Exact Blockers Before Phase 1

1. **Formal Approval of ADR Revision 2.0**: The architectural decisions in `docs/architecture/ADR-REVISION-2.0.md` must be formally accepted.
2. **Environment Secret Provisioning Policy**: Confirmation that production deployment platforms will supply `JWT_SECRET`, `INITIAL_ADMIN_EMAIL`, and `INITIAL_ADMIN_PASSWORD` as mandatory environment variables.
3. **Frontend Origin Clarification**: Confirmation of whether production deployment is same-origin (Nginx container hosting both frontend and API) or decoupled cross-origin (Vercel + Render), to finalize cookie vs. bearer token transport.

---

**STOPPING POINT**: Phase 0 investigation and documentation are 100% complete. No source files, database migrations, dependencies, or runtime configurations have been modified. Standing by for your review and explicit approval to proceed with Phase 1.
