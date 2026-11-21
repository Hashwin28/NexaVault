# NexaVault — Architecture Decision Records (ADR) Revision 2.0

**Status**: APPROVED BASELINE FOR PHASE 0  
**Date**: 2026-11-21  
**Scope**: Core Architecture, Governance, Persistence, Event Delivery, Security, and Domain Boundaries

---

## Executive Summary of ADR Changes from Initial Blueprint to ADR 2.0

| Decision Area | Initial Blueprint Proposal | ADR Revision 2.0 Decision | Rationale |
|---|---|---|---|
| **ADR-001: Architectural Style** | Generic Clean/Hexagonal Monolith | **Hexagonal Architecture + DDD + Event-Driven Modular Monolith + Selective CQRS** | Single deployable backend. Strictly forbids microservices, Kubernetes, and Kafka at this stage. |
| **ADR-002: Administrator Scope** | Dual-tier (Super-Admin + Dept-Admin) | **Strict Department-Scoped Administrator by Default** | Super-admin deferred. `NULL` department NEVER grants global access; untagged workspaces are hidden from department admins. Admins cannot evaluate or publish marks. |
| **ADR-003: Core Transactions** | Generic ACID claims | **Explicit Synchronous Transaction Boundaries** | Evaluation scoring, individual results, and mandatory audit records must commit atomically in the same database transaction. Pessimistic locking (`FOR UPDATE`) preserved for submission claiming. |
| **ADR-004: Event Delivery & Outbox** | Generic Outbox description | **PostgreSQL Transactional Outbox with At-Least-Once Delivery & Worker Crash Recovery** | Full schema specified with status, attempts, retry backoff, last error, and `SELECT FOR UPDATE SKIP LOCKED`. Notifications and reporting projections are decoupled asynchronous side effects. |
| **ADR-005: Audit & Compliance** | Mixed procedural audit & hypothetical Merkle root | **Two-Tier Audit Architecture (Mandatory Transactional vs. Asynchronous Activity)** | Grade changes and permission updates commit in-transaction. Merkle tree checkpoints deferred until key management and operational verification exist. |
| **ADR-006: Identity & Authentication** | Bearer JWT with mutable email in `localStorage` | **Immutable User ID Subject, Refresh Token Rotation with Hash Storage & Reuse Detection** | Passwords must not be silently truncated. Cookie vs. Bearer decision conditioned on deployment topology. Argon2id migration path prepared. |
| **ADR-007: Group & Workspace Invariant** | Assumed multi-course groups worked | **Workspace-Scoped Group Membership Invariant Identified** | Global unique constraint on `group_memberships.user_id` verified as defective. Relational migration model designed for workspace-scoped groups without breaking active groups. |
| **ADR-008: Bounded Contexts** | 8 loosely separated domains | **9 Explicit Bounded Contexts with Strict Zero-Direct-ORM Rules** | Added "Search and Read Projections" context. Strict law: no cross-context aggregate manipulation or ORM traversals. |
| **ADR-009: Selective CQRS** | Generic CQRS concept | **Single-Database Selective CQRS** | Command handlers enforce invariants via aggregates; high-volume read views (Results Dashboard, Review Queue, Search, CSV) query optimized SQL projections directly. No duplicate read DB. |

---

## ADR-001: Architectural Style

### Context
NexaVault is an enterprise academic evaluation and project management platform. The application currently suffers from "Fat Controllers" where route handlers directly execute ORM queries, cache mutations, business validation, and response formatting in single files exceeding 1,000–1,800 lines of code.

### Decision
Adopt a **Modular Monolith** organized under **Hexagonal Architecture (Ports and Adapters)**, **Domain-Driven Design (DDD)**, and **Selective CQRS**, with **In-Process Domain Events backed by a PostgreSQL Transactional Outbox**.

1. **Single Deployable Unit**: The application runs as a single deployable FastAPI application.
2. **Infrastructure Simplicity**: Microservices, Kubernetes orchestration, distributed message brokers (Kafka, RabbitMQ), and multi-database replication are **strictly rejected**.
3. **Pure Domain Core**: Domain aggregates, entities, value objects, and domain exceptions must be written in pure Python with **zero dependencies** on FastAPI, SQLAlchemy, PostgreSQL, Pydantic, HTTPX, or Bcrypt.

### Consequences
* **Positive**: High development velocity, simple single-container deployment, local ACID transaction guarantees, millisecond-level unit test execution for domain models.
* **Negative**: Requires strict discipline to prevent cross-module direct ORM imports within the single repository. Enforced via import linter rules.

---

## ADR-002: Administrator and Department Governance

### Context
In the existing codebase (`app/core/permissions.py:85-94` and `app/api/v1/endpoints/admin.py:105-107`), administrators with `department IS NULL` are granted global super-admin access, and workspaces with `department IS NULL` are visible to *all* department administrators. Furthermore, `admin.py` duplicates over 1,700 lines of workspace inspection logic.

### Decision
1. **Department-Scoped Administrator by Default**:
   * The default Administrator role is strictly department-scoped.
   * An Administrator may only view and manage resources explicitly belonging to their assigned department (`user.department == resource.department`).
2. **Fail-Closed Isolation**:
   * A `NULL` department on an Administrator account **never** implicitly grants global access. An administrator with no department assigned has zero operational scope.
   * Workspaces with `department IS NULL` are **strictly invisible** to department-scoped Administrators.
3. **Operational vs. Academic Authority**:
   * Administrators are authorized to manage department operational workflows: workspace lifecycle (creation, archiving, unarchiving), staff co-management assignments, student directory status, and department audit log inspection.
   * Administrators are **strictly forbidden** from claiming submissions, scoring deliverables, publishing marks, altering evaluation results, or overriding student grades.
4. **Super-Administrator Status**:
   * A platform-level super-administrator is **deferred**. If multi-tenant university deployment requires cross-department governance, it will be introduced via an explicit, audited role (`system_super_admin`) with multi-factor authentication, not through null-department fallback heuristics.

---

## ADR-003: Transactional Business Operations

### Context
Academic operations (team formation, submission roster freezing, evaluation scoring, result publication, and grade corrections) require strict ACID guarantees. Moving state changes into eventual-consistency message consumers risks orphaned grades, race conditions, or unrecorded grade tampering.

### Decision
The following operations must execute inside **atomic database transactions**:

1. **Student Group Membership Changes**:
   * Code generation, membership row creation/deletion, leader reassignment, and group soft-deletion must execute atomically.
2. **Submission Creation & Roster Snapshot Freezing**:
   * Validating open round status, checking minimum 2-member group size, freezing `roster_snapshot` JSON, creating `Submission` and `SubmissionVersion` records must commit in a single transaction.
3. **Review Claiming**:
   * Must use pessimistic row-level locking (`SELECT ... FOR UPDATE`) on the `SubmissionVersion` record to prevent dual-staff claiming collisions.
4. **Evaluation & Individual Result Creation**:
   * The authoritative evaluation (`Review`), all individual student score records (`ResultEntry`), and mandatory audit entries must commit **in the exact same database transaction**. Core academic marks must never depend on asynchronous queues.
5. **Results Publication**:
   * Toggling `ResultEntry.is_released = True`, setting `released_at`, updating submission status, and committing the publication audit entry must be atomic.
6. **Grade Corrections**:
   * Updating `ResultEntry.score`, inserting `ResultCorrection` with mandatory justification, and recording the audit log must be atomic.
7. **Staff & Administrator Permission Changes**:
   * Assignment/revocation of staff roles and user active status changes must commit atomically with their respective audit records.

---

## ADR-004: Transactional Outbox and Event Delivery

### Context
Cross-context communication (such as updating review queues, sending notifications, and publishing non-critical activity feeds) needs reliable event publishing without coupling primary business transactions to external brokers or network calls.

### Decision
1. **PostgreSQL-Backed Transactional Outbox**:
   * A dedicated `outbox_events` table is created in PostgreSQL.
   * All domain events produced by aggregates are written to `outbox_events` within the **exact same ACID transaction** as the aggregate mutation.
2. **Outbox Schema Requirements**:
   * `id`: UUID (Primary Key).
   * `aggregate_type`: VARCHAR(100).
   * `aggregate_id`: VARCHAR(100).
   * `event_type`: VARCHAR(100).
   * `event_version`: INTEGER (Default 1).
   * `payload`: JSONB.
   * `created_at`: TIMESTAMPTZ (UTC).
   * `status`: VARCHAR(20) (`PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`).
   * `attempt_count`: INTEGER (Default 0).
   * `next_retry_at`: TIMESTAMPTZ (Nullable).
   * `processed_at`: TIMESTAMPTZ (Nullable).
   * `last_error`: TEXT (Nullable).
3. **Worker Claiming & Crash Recovery**:
   * A background worker polls for events using `SELECT ... FOR UPDATE SKIP LOCKED` where `status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= now())`.
   * Events in `PROCESSING` status for longer than 5 minutes without completion are reclaimed as crashed jobs.
4. **Delivery Semantics & Idempotency**:
   * Delivery is **at-least-once**.
   * Event consumers must record processed event IDs in an `idempotent_consumer_log` table.
   * A consumer marks an event as processed **only after** its handler completes durably.
   * Exponential backoff: `next_retry_at = now() + (2 ^ attempt_count * 10 seconds)` up to 5 attempts before marking `FAILED`.
5. **Decoupling Rule**:
   * Notifications, analytics, and reporting projections are **asynchronous side effects**. They must never block or cause rollback of submission creation or evaluation scoring.

---

## ADR-005: Audit and Compliance

### Context
NexaVault records operational, security, and academic events. Currently, audit logging is called procedurally via `log_audit()`, and the `AuditMerkleRoot` model exists in the database without any operational calculation code.

### Decision
1. **Two-Tier Audit Architecture**:
   * **Tier A: Mandatory Transactional Audit**:
     * Grade corrections, result releases, evaluation submissions, permission changes, staff assignments, account status toggles, and login security failures.
     * Committed synchronously within the primary database transaction.
   * **Tier B: Asynchronous Activity Tracking**:
     * Notice publishing, update comments, non-sensitive read feeds, and background telemetry.
     * Dispatched via the Transactional Outbox.
2. **Immutability & Tamper Resistance**:
   * Audit tables (`audit_logs`) are append-only. No `UPDATE` or `DELETE` endpoints will exist in any API route.
   * In production database roles, `UPDATE` and `DELETE` privileges on `audit_logs` are revoked from the application user.
3. **Cryptographic Checkpoints**:
   * The claim of "Merkle model cryptographic audit verification" is **DEFERRED**. The existing `AuditMerkleRoot` table remains dormant until an operational hashing schedule, digital signature scheme, and key-management design are formally specified.

---

## ADR-006: Identity, Authentication & Session Security

### Context
Current JWT tokens store the mutable user email in the `sub` claim (`security.py:44`), access tokens are valid for 24 hours without revocation, passwords are truncated at 72 bytes via bcrypt without notifying users, and default administrator credentials exist in startup code.

### Decision
1. **Immutable JWT Subject**:
   * The JWT `sub` claim must contain the immutable `user.id` (integer or UUID converted to string), not the mutable user email.
2. **Password Hashing Strategy**:
   * Passwords must **not** be silently truncated. The application must enforce password length limits (minimum 8 characters, maximum 128 characters) via schema validation.
   * Maintain current `bcrypt` hash verification for existing users.
   * Plan a transparent upgrade path to **Argon2id** (via `passlib` or `argon2-cffi`) upon successful user login.
3. **Token Lifecycle & Rotation**:
   * Access tokens: Short-lived (15 minutes).
   * Refresh tokens: Long-lived (7 days), stored exclusively as **cryptographic SHA-256 hashes** in the database.
   * Implement **Refresh Token Rotation**: each refresh request issues a new refresh token and revokes the previous token family member.
   * **Reuse Detection**: If an already-revoked refresh token is presented, the entire token family is immediately revoked, forcing re-authentication.
4. **Token Transport**:
   * In containerized / same-origin deployments, tokens should use `HttpOnly`, `SameSite=Lax`, `Secure` cookies with CSRF double-submit protection.
   * For decoupled cross-origin deployments (e.g., Vercel frontend + Render backend), Bearer authorization in memory with refresh cookies is supported.
   * No migration of storage mechanism will occur until frontend deployment topology is fully confirmed in Phase 1.

---

## ADR-007: Group Membership and Workspace Enrollment

### Context
In `app/models/group.py:38`, `GroupMembership` enforces `UniqueConstraint("user_id", name="uq_user_single_active_group")`. This creates a critical system defect: a student enrolled in two courses cannot join distinct project teams.

### Decision
1. **Domain Invariant**:
   * A student can belong to **at most one active project group per workspace**, but can participate in different groups across different workspaces.
2. **Target Relational Model**:
   * Group membership must be scoped per workspace.
   * The database model will evolve to include `workspace_id` in group membership:
     `UniqueConstraint("workspace_id", "user_id", name="uq_workspace_user_active_group")`.
3. **Zero-Breaking-Change Transition**:
   * No database migration will be generated during Phase 0.
   * The existing global group structure remains the baseline until the dedicated Phase 2 Group Domain migration is executed.

---

## ADR-008: Bounded Context Ownership

### Context
Current endpoint files interleave logic from multiple domains (e.g., `workspaces.py` contains notice file uploads, round configurations, and group enrollments).

### Decision
Define 9 strictly separated Bounded Contexts:

1. **Identity & Access**: User credentials, password verification, token issuance/rotation, profile retrieval.
2. **Department Governance**: Department boundaries, department administrator dashboard, staff assignment policies.
3. **Workspace Management**: Workspace lifecycle (creation, archival), co-staff delegation, staff requests.
4. **Group Management**: Team formation, join code regeneration, workspace-scoped membership, curriculum enrollment.
5. **Assessment & Submission**: Review rounds, project milestones, progress calculation, GitHub commit sync, deliverable submissions, roster freezing.
6. **Evaluation & Results**: Submission queue, row-locked claiming, individual student grading, grade corrections, marks publication, universal CSV export.
7. **Audit & Compliance**: Append-only activity ledger, sensitive field sanitization, compliance rollups.
8. **Notifications**: 24-hour notice board, Pillow image validation/compression, image file lifecycle.
9. **Search & Read Projections**: Role-isolated smart search, denormalized read views, reporting projections.

**Rule**: Contexts communicate exclusively via Application Ports (Use Cases), naked primitive IDs (e.g., `workspace_id: str`), and Domain Events. Direct ORM model traversals across context boundaries are forbidden.

---

## ADR-009: Selective CQRS

### Context
Heavy analytical and administrative endpoints (Results Dashboard, Review Queue, Smart Search, Audit Activity) suffer from ORM hydration overhead when assembling complex multi-table graphs.

### Decision
Adopt **Single-Database Selective CQRS**:

1. **Command Path (Writes)**:
   * Requests flow through Inbound Ports $\to$ Command Handlers $\to$ Aggregate Roots.
   * Invariants are enforced in memory.
   * Aggregate state is persisted via Repository, emitting Outbox Events within the same transaction.
2. **Query Path (Reads)**:
   * Read requests bypass aggregate roots entirely.
   * Query Handlers execute direct, optimized SQL joins (`joinedload`, explicit select projections) returning immutable Pydantic read DTOs.
3. **Persistence Simplicity**:
   * Both paths use the same PostgreSQL database. No separate read database, Elasticsearch, or eventual replication is introduced.
