# NexaVault — Phase 0: Bounded-Context Ownership Map

**Architecture Paradigm**: Domain-Driven Design (DDD) + Hexagonal Architecture  
**Date**: 2026-11-21  

---

## 1. Candidate Context Inventory & Ownership Matrix

| Candidate Context | Primary Aggregate Root | Owned Tables & ORM Models | Current Endpoint Handlers | Current Services / Repositories | Primary Cross-Context Inbound Dependencies |
|---|---|---|---|---|---|
| **1. Identity & Access** | `User` | `users`, `refresh_tokens`, `email_tokens` | `app/api/v1/endpoints/auth.py`, Admin user routes in `admin.py` | `app/core/security.py`, `app/api/deps.py` | Consumed by all contexts for user identity and authorization |
| **2. Department Governance** | `Department` | `departments` (to be created), `workspaces.department` scope | `app/api/v1/endpoints/admin.py` (Dashboard, Staff list) | Inline queries in `admin.py`, `app/core/permissions.py` | Enforces tenant scope on Workspace Management |
| **3. Workspace Management** | `Workspace` | `workspaces`, `workspace_staff`, `workspace_staff_requests` | `app/api/v1/endpoints/workspaces.py:70-650` | Inline queries in `workspaces.py` | Identity (Staff), Department (Scope) |
| **4. Group Management** | `StudentGroup` | `groups`, `group_memberships`, `workspace_groups` | `app/api/v1/endpoints/groups.py` | Inline queries in `groups.py` | Identity (Student), Workspace (Enrollment target) |
| **5. Assessment & Submission** | `Project`, `ReviewRound`, `Submission` | `review_rounds`, `projects`, `project_updates`, `update_comments`, `github_links`, `github_commits`, `submissions`, `submission_versions` | `workspaces.py` (Rounds), `projects.py`, `submissions.py` | `app/services/project_service.py` | Group (Ownership), Workspace (Milestones), Evaluation (Consumes versions) |
| **6. Evaluation & Results** | `Review`, `ResultEntry` | `reviews`, `result_entries`, `result_corrections` | `app/api/v1/endpoints/reviews.py`, `results.py` | Inline queries in `reviews.py`, `results.py` | Assessment (SubmissionVersion & roster_snapshot), Workspace (Staff permissions) |
| **7. Audit & Compliance** | `AuditLog` | `audit_logs`, `audit_merkle_roots` | `app/api/v1/endpoints/audit.py`, Admin audit routes in `admin.py` | `app/services/audit_service.py` | Subscribed to all contexts |
| **8. Notifications** | `WorkspaceNotice` | `workspace_notices` | `app/api/v1/endpoints/workspaces.py:800-1200` | `app/services/storage_service.py` | Workspace (Binding), Identity (Author) |
| **9. Search & Read Projections** | None (Read Models) | Direct query access to read-only projections | `app/api/v1/endpoints/search.py` | Inline queries in `search.py`, `cache.py` | All contexts (read-only projections) |

---

## 2. Detailed Context Profiles

### 2.1 Context 1: Identity & Access
* **Owned Models & Tables**: `User` (`users`), `RefreshToken` (`refresh_tokens`), `EmailToken` (`email_tokens`).
* **Current API Endpoints**:
  * `POST /api/v1/auth/register` (`auth.py:11`)
  * `POST /api/v1/auth/login` (`auth.py:71`)
  * `GET /api/v1/auth/me` (`auth.py:148`)
  * `PATCH /api/v1/admin/users/{user_id}/status` (`admin.py:840`)
  * `POST /api/v1/admin/provision` (`admin.py:910`)
* **Current Services**: `app/core/security.py` (bcrypt hashing, JWT generation), `app/api/deps.py` (`get_current_user`, `get_current_student`, `get_current_staff`, `get_current_admin`).
* **Business Rules**:
  1. Registration is restricted to students.
  2. Inactive accounts (`is_active = False`) are rejected on login and token decoding.
  3. Administrator provisioning is constrained to the administrator's assigned department.
* **Cross-Context Dependencies**: All other contexts depend on Identity for authentication dependencies.
* **Direct ORM Access from Other Contexts**:
  * `workspaces.py` and `admin.py` query `User` directly to fetch owner/author names.
  * `results.py` queries `User` directly to build student roll number lists.
* **Potential Aggregate Root**: `User` entity managing authentication credentials and active status.
* **Current Ownership Conflicts**:
  * `User.department` is stored as an unvalidated string, coupling Identity to Department Governance.

---

### 2.2 Context 2: Department Governance
* **Owned Models & Tables**: Currently unrepresented as a relational entity; relies on `users.department` and `workspaces.department`.
* **Current API Endpoints**:
  * `GET /api/v1/admin/dashboard` (`admin.py:227`)
  * `GET /api/v1/admin/workspaces` (`admin.py:337`)
  * `GET /api/v1/admin/workspaces/{id}` (`admin.py:409`)
  * `PATCH /api/v1/admin/workspaces/{id}` (`admin.py:437`)
  * `POST /api/v1/admin/workspaces/{id}/archive` (`admin.py:530`)
  * `POST /api/v1/admin/workspaces/{id}/unarchive` (`admin.py:585`)
  * `GET /api/v1/admin/staff` (`admin.py:700`)
  * `GET /api/v1/admin/students` (`admin.py:770`)
  * `POST /api/v1/admin/workspaces/{id}/staff` (`admin.py:650`)
  * `DELETE /api/v1/admin/workspaces/{id}/staff/{uid}` (`admin.py:675`)
* **Current Services**: None (embedded SQL queries in `admin.py`).
* **Business Rules**:
  1. Department administrators are strictly isolated to their department.
  2. A null department on an administrator grants zero access (fail-closed).
  3. Untagged workspaces are hidden from department administrators.
* **Cross-Context Dependencies**: Enforces tenancy rules over Workspace Management.
* **Direct ORM Access from Other Contexts**: Procedural permission functions in `app/core/permissions.py:77-111` query `Workspace` directly.
* **Potential Aggregate Root**: `Department` aggregate root managing department staff assignments.
* **Current Ownership Conflicts**: Massive controller bloat; `admin.py` re-implements workspace inspection queries that should be shared read models.

---

### 2.3 Context 3: Workspace Management
* **Owned Models & Tables**: `Workspace` (`workspaces`), `WorkspaceStaff` (`workspace_staff`), `WorkspaceStaffRequest` (`workspace_staff_requests`).
* **Current API Endpoints**:
  * `POST /api/v1/workspaces/` (`workspaces.py:71`)
  * `GET /api/v1/workspaces/` (`workspaces.py:155`)
  * `GET /api/v1/workspaces/{id}` (`workspaces.py:375`)
  * `POST /api/v1/workspaces/{id}/staff-request` (`workspaces.py:455`)
  * `GET /api/v1/workspaces/{id}/staff-requests` (`workspaces.py:495`)
  * `POST /api/v1/workspaces/{id}/staff-request/{req_id}/resolve` (`workspaces.py:535`)
  * `POST /api/v1/workspaces/{id}/costaff/{uid}` (`workspaces.py:580`)
  * `DELETE /api/v1/workspaces/{id}/costaff/{uid}` (`workspaces.py:615`)
  * `POST /api/v1/workspaces/{id}/archive` (`workspaces.py:640`)
* **Current Services**: None (embedded in `workspaces.py`).
* **Business Rules**:
  1. Workspace ID is an immutable string identifier (e.g. `CS204-DSA`).
  2. Workspace owner has exclusive rights to approve co-staff requests.
  3. Archiving locks all submissions and disables milestone editing.
* **Cross-Context Dependencies**: Relies on Identity for user profiles; enforces curriculum bounds for Groups.
* **Direct ORM Access from Other Contexts**: `projects.py`, `submissions.py`, `reviews.py`, and `results.py` all join and query `workspaces` directly.
* **Potential Aggregate Root**: `Workspace` aggregate root managing staff list and open/closed state.
* **Current Ownership Conflicts**: `workspaces.py` currently houses Notice Board and Review Round logic.

---

### 2.4 Context 4: Group Management
* **Owned Models & Tables**: `Group` (`groups`), `GroupMembership` (`group_memberships`), `WorkspaceGroup` (`workspace_groups`).
* **Current API Endpoints**:
  * `POST /api/v1/groups/` (`groups.py:53`)
  * `GET /api/v1/groups/me` (`groups.py:85`)
  * `GET /api/v1/groups/{id}` (`groups.py:100`)
  * `POST /api/v1/groups/join` (`groups.py:114`)
  * `PATCH /api/v1/groups/{id}/code` (`groups.py:180`)
  * `POST /api/v1/groups/{id}/leave` (`groups.py:215`)
  * `POST /api/v1/groups/{id}/enroll` (`groups.py:279`)
  * `GET /api/v1/workspaces/{id}/groups` (`groups.py:325`)
* **Current Services**: None.
* **Business Rules**:
  1. Group join codes are alphanumeric (7 characters, no hyphens).
  2. Leader leaving triggers automatic succession to the next senior member.
  3. Last member leaving marks group as deleted (`is_deleted = True`).
* **Cross-Context Dependencies**: Relies on Identity for user attribution.
* **Direct ORM Access from Other Contexts**: `projects.py` queries `GroupMembership` directly to construct student member arrays. `submissions.py` queries `GroupMembership` to freeze rosters.
* **Potential Aggregate Root**: `StudentGroup` aggregate root managing membership lifecycle.
* **Current Ownership Conflicts**: `workspace_groups` is currently located in `workspace.py`, while group membership is in `group.py`.

---

### 2.5 Context 5: Assessment & Submission
* **Owned Models & Tables**:
  * `ReviewRound` (`review_rounds`)
  * `Project`, `ProjectUpdate`, `UpdateComment` (`projects`, `project_updates`, `update_comments`)
  * `GithubLink`, `GithubCommit` (`github_links`, `github_commits`)
  * `Submission`, `SubmissionVersion` (`submissions`, `submission_versions`)
* **Current API Endpoints**:
  * Rounds: `POST/GET /workspaces/{id}/rounds`, `PATCH /rounds/{id}`, `POST /rounds/{id}/toggle`, `DELETE /rounds/{id}` (`workspaces.py:1255-1550`)
  * Projects: `POST/GET /projects/`, `POST/GET /projects/{id}/updates`, `POST /projects/{id}/updates/{uid}/comments` (`projects.py:96-450`)
  * GitHub: `GET/POST/DELETE /projects/{id}/github`, `POST /projects/{id}/github/sync` (`projects.py:500-650`)
  * Submissions: `GET /projects/{id}/submissions`, `POST /projects/{id}/rounds/{rid}/submissions`, `PATCH /submissions/{id}/draft`, `POST /submissions/{id}/submit` (`submissions.py:51-300`)
* **Current Services**: `app/services/project_service.py` (`calculate_project_progress`).
* **Business Rules**:
  1. Minimum 2-member group validation before deliverable upload.
  2. Freezes immutable JSON snapshot of group members on submission (`roster_snapshot`).
  3. Automatic `is_late` calculation against `round.due_date`.
  4. Rounds with existing submissions cannot be deleted.
* **Cross-Context Dependencies**: Enrolled Groups (who submits), Workspaces (milestone container).
* **Direct ORM Access from Other Contexts**: `reviews.py` and `results.py` directly query `SubmissionVersion` and `ReviewRound`.
* **Potential Aggregate Roots**: `Project` aggregate; `Submission` aggregate; `ReviewRound` aggregate.
* **Current Ownership Conflicts**: Round endpoints are embedded in `workspaces.py`.

---

### 2.6 Context 6: Evaluation & Results
* **Owned Models & Tables**: `Review` (`reviews`), `ResultEntry` (`result_entries`), `ResultCorrection` (`result_corrections`).
* **Current API Endpoints**:
  * Review Queue: `GET /api/v1/reviews/queue` (`reviews.py:29`)
  * Claiming: `POST /api/v1/reviews/{vid}/claim` (`reviews.py:126`)
  * Release Claim: `POST /api/v1/reviews/{vid}/release-claim` (`reviews.py:180`)
  * Evaluate: `POST /api/v1/reviews/{vid}/evaluate` (`reviews.py:214`)
  * Release Marks: `POST /api/v1/reviews/{vid}/release-results` (`reviews.py:341`)
  * Dashboard: `GET /api/v1/results/workspace/{id}` (`results.py:53`)
  * Export CSV: `GET /api/v1/results/workspace/{id}/export-csv` (`results.py:115`)
  * Student Results: `GET /api/v1/results/me` (`results.py:157`)
  * Correction: `PATCH /api/v1/results/{entry_id}/correct` (`results.py:461`)
* **Current Services**: Inline helper `build_workspace_results` in `results.py:35`.
* **Business Rules**:
  1. Concurrency control via PostgreSQL `FOR UPDATE` lock on `SubmissionVersion`.
  2. Marks recorded per individual student, strictly bounded by configured max score.
  3. Every frozen roster member must receive an individual score entry.
  4. Grade corrections require mandatory non-empty reason string.
  5. Universal CSV export includes UTF-8 Byte Order Mark (`\ufeff`).
* **Cross-Context Dependencies**: Consumes `SubmissionVersion` and `roster_snapshot` from Assessment.
* **Direct ORM Access from Other Contexts**: `project_service.py` queries `ResultEntry` to evaluate approved marks.
* **Potential Aggregate Root**: `Review` aggregate managing `ResultEntry` scoring collection.
* **Current Ownership Conflicts**: `ResultEntry` has a direct foreign key to `review_rounds.id`.

---

### 2.7 Context 7: Audit & Compliance
* **Owned Models & Tables**: `AuditLog` (`audit_logs`), `AuditMerkleRoot` (`audit_merkle_roots`).
* **Current API Endpoints**:
  * `GET /api/v1/audit/activity` (`audit.py:50`)
  * `GET /api/v1/audit/stats` (`audit.py:180`)
  * `GET /api/v1/audit/filters` (`audit.py:240`)
  * `GET /api/v1/audit/logs` (`audit.py:310`)
* **Current Services**: `app/services/audit_service.py` (`log_audit`, `log_audit_event`, `sanitize_metadata`).
* **Business Rules**:
  1. Append-only ledger; updates and deletes forbidden.
  2. Passwords, secrets, tokens, API keys, and JWTs sanitized to `[REDACTED]`.
  3. Scoped by staff managed workspaces or admin department.
* **Cross-Context Dependencies**: Subscribes to events/calls from all contexts.
* **Direct ORM Access from Other Contexts**: `deps.py`, `auth.py`, `workspaces.py`, `groups.py`, `projects.py`, `submissions.py`, `reviews.py`, `results.py`, `admin.py` all import `log_audit`.
* **Potential Aggregate Root**: `AuditLogEntry` entity.
* **Current Ownership Conflicts**: Direct procedural calls scattered everywhere instead of event consumption.

---

### 2.8 Context 8: Notifications
* **Owned Models & Tables**: `WorkspaceNotice` (`workspace_notices`).
* **Current API Endpoints**:
  * `GET /api/v1/workspaces/{id}/notices` (`workspaces.py:815`)
  * `POST /api/v1/workspaces/{id}/notices` (`workspaces.py:875`)
  * `PATCH /api/v1/workspaces/{id}/notices/{nid}` (`workspaces.py:965`)
  * `POST /api/v1/workspaces/{id}/notices/{nid}/pin` (`workspaces.py:1015`)
  * `DELETE /api/v1/workspaces/{id}/notices/{nid}` (`workspaces.py:1050`)
  * `POST /api/v1/workspaces/notices/cleanup-expired` (`workspaces.py:1120`)
  * `GET /api/v1/workspaces/notices/images/{filename}` (`workspaces.py:1165`)
* **Current Services**: `app/services/storage_service.py` (Pillow processing, WebP compression, disk lifecycle).
* **Business Rules**:
  1. Notices expire after 24 hours (`expires_at = created_at + 24h`).
  2. Expired notices are filtered on read.
  3. Notice image delete purges file from disk storage.
* **Cross-Context Dependencies**: Bound to `Workspace`.
* **Direct ORM Access from Other Contexts**: `workspaces.py` loads notices via `joinedload`.
* **Potential Aggregate Root**: `Notice` aggregate root.
* **Current Ownership Conflicts**: Embedded directly inside `app/models/workspace.py` and `workspaces.py`.

---

### 2.9 Context 9: Search and Read Projections
* **Owned Models & Tables**: None (No write entities; pure read models).
* **Current API Endpoints**:
  * `GET /api/v1/search` (`search.py:16`)
* **Current Services**: `app/core/cache.py` (in-memory LRU cache with inverted tag index).
* **Business Rules**:
  1. Role-isolated search: staff sees managed workspaces, enrolled groups, submissions; student sees active group and enrolled workspaces.
  2. Join codes and workspace IDs excluded from searchable text.
* **Cross-Context Dependencies**: Queries across all domain tables.
* **Direct ORM Access from Other Contexts**: N/A (Reader).
* **Current Ownership Conflicts**: Lacks administrator search branch entirely.
