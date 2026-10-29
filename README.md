# NexaVault — Departmental Academic Workspace & Project Evaluation Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-6.0-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC.svg?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com)

NexaVault is an enterprise-grade academic project management and continuous evaluation platform built for university departments. It manages the complete lifecycle of student capstone and laboratory courses: from student team formation and workspace curriculum enrollment to milestone submissions, faculty review queues, rubric scoring, dynamic results aggregation, administrative audit logging, and notice distribution.

---

## Table of Contents

1. [Architecture & System Flow](#1-architecture--system-flow)
2. [Technology Stack](#2-technology-stack)
3. [Feature Implementation Status](#3-feature-implementation-status)
4. [Subsystem Deep Dive](#4-subsystem-deep-dive)
   - [Authentication & Access Control](#41-authentication--access-control)
   - [Student Groups & Team Formation](#42-student-groups--team-formation)
   - [Academic Workspaces & Co-Staffing](#43-academic-workspaces--co-staffing)
   - [Notice Board with 24-Hour Expiration & Direct Upload](#44-notice-board-with-24-hour-expiration--direct-upload)
   - [Project Workspaces & Live GitHub Integration](#45-project-workspaces--live-github-integration)
   - [Review Round Configuration Pipeline](#46-review-round-configuration-pipeline)
   - [Milestone Submissions & Roster Freezing](#47-milestone-submissions--roster-freezing)
   - [Staff Review Queue & Evaluation Workflow](#48-staff-review-queue--evaluation-workflow)
   - [Dedicated Results Dashboard & Universal CSV Export](#49-dedicated-results-dashboard--universal-csv-export)
   - [Administrative Activity Center & Merkle Model](#410-administrative-activity-center--merkle-model)
   - [Role-Isolated Smart Search](#411-role-isolated-smart-search)
5. [Database Architecture & Data Models](#5-database-architecture--data-models)
6. [API Specification](#6-api-specification)
7. [Security Architecture](#7-security-architecture)
8. [Performance & In-Memory Caching](#8-performance--in-memory-caching)
9. [Project Directory Structure](#9-project-directory-structure)
10. [Setup & Execution Guide](#10-setup--execution-guide)
11. [Testing & Verification](#11-testing--verification)
12. [Current Limitations & Roadmap](#12-current-limitations--roadmap)

---

## 1. Architecture & System Flow

NexaVault follows a decoupled client-server architecture. The frontend is a responsive Single-Page Application (SPA) built with React and Tailwind CSS, served via Vite in development or Nginx in containerized production. The backend is an asynchronous, high-throughput REST API powered by FastAPI, SQLAlchemy 2.0, and PostgreSQL.

```mermaid
flowchart TB
    Client([Web Browser / Student & Staff Clients])

    subgraph Frontend ["Frontend Layer (Vite + React 18 + Tailwind CSS)"]
        AuthContext["Auth Context (JWT in localStorage)"]
        UIState["UI Router State & Keep-Alive Tab Cache"]
        ApiClient["Axios / Fetch HTTP Client"]
    end

    subgraph Gateway ["Reverse Proxy & Static Files (Production)"]
        Nginx["Nginx Web Server (:80 / :3000)"]
        StaticAssets[("Compiled SPA Dist & Uploaded Media")]
    end

    subgraph Backend ["FastAPI Application Server (:8000)"]
        MW["Middleware (CORS, GZip, Cache-Control Headers)"]
        Router["API v1 Router (/api/v1/*)"]
        Security["Auth & Permissions (OAuth2 Bearer, Bcrypt, can_*)"]
        Services["Domain Services (Audit, Project, Storage)"]
        Cache["In-Memory LRU Cache (OrderedDict + Inverted Tag Index)"]
        ORM["SQLAlchemy 2.0 ORM"]
    end

    subgraph Database ["Persistence Layer"]
        Postgres[("PostgreSQL 16 Engine<br/>Local or Neon Serverless Pooler")]
        Alembic["Alembic Migrations Engine"]
    end

    subgraph External ["External Services"]
        GitHubAPI["GitHub REST API (Live Commits & Branches)"]
    end

    Client -->|HTTPS / HTTP| Nginx
    Nginx -->|Static Assets| StaticAssets
    Nginx -->|/api/v1 Reverse Proxy| MW
    Client -.->|Direct API Dev :8000| MW

    MW --> Router
    Router --> Security
    Security --> Services
    Services <--> Cache
    Services --> ORM
    ORM <--> Postgres
    Services -.->|Sync Commits| GitHubAPI
    Alembic -.->|Schema Versioning| Postgres
```

### Communication Flow
1. **Request Lifecycle**: Every request enters through FastAPI's middleware stack (`NoCacheMiddleware` enforcing `no-store` on private user data, `GZipMiddleware` for payloads $>1000$ bytes, and `CORSMiddleware`).
2. **Authentication Dependency**: Protected endpoints resolve the user via `get_current_user` in `app/api/deps.py`. Bearer JWT tokens are decoded and validated against `JWT_SECRET`.
3. **Role & Resource Authorization**: Granular rules in `app/core/permissions.py` (`can_access_workspace`, `can_manage_round`, `can_review_submission`, etc.) verify object-level ownership. Attempted unauthorized access to staff resources triggers automatic security audit logging.
4. **Caching Layer**: Read-heavy endpoints (workspace lists, review queues, results, notices) check the thread-safe `InMemoryCache`. Cache misses query PostgreSQL via SQLAlchemy and store the result with scoped tags.
5. **Targeted Invalidation**: Write operations automatically purge related cached entries across student and staff sessions using an inverted tag index.

---

## 2. Technology Stack

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 6.0.7
- **Styling**: Tailwind CSS 3.4.17 with PostCSS & Autoprefixer
- **UI Utilities**: Lucide React 0.469.0 (icons), `clsx`, `tailwind-merge`
- **State Management**: React Context API (`AuthContext`), React component state, and in-memory keep-alive tab caching
- **Routing**: Component-level view routing with URL hash synchronization

### Backend
- **Framework**: FastAPI $\ge 0.110.0$
- **ASGI Server**: Uvicorn $\ge 0.28.0$
- **ORM**: SQLAlchemy $\ge 2.0.0$ (synchronous engine with connection pooling)
- **Database Migrations**: Alembic $\ge 1.13.0$
- **Data Validation & Settings**: Pydantic $\ge 2.0.0$, Pydantic Settings $\ge 2.0.0$
- **Security & Cryptography**: direct `bcrypt` $\ge 4.1.2$ (`gensalt`, `hashpw`, `checkpw`), PyJWT $\ge 2.8.0$ (HMAC-SHA256)
- **Image Processing**: Pillow $\ge 10.0.0$
- **Database Drivers**: `psycopg2-binary` $\ge 2.9.9$, `psycopg[binary]`
- **HTTP Client**: HTTPX $\ge 0.27.0$ (GitHub live sync)
- **Testing**: pytest $\ge 8.0.0$

### Infrastructure & Deployment
- **Database**: PostgreSQL 16 (supports local Docker and Neon Serverless PostgreSQL with SSL)
- **Containerization**: Docker, Docker Compose
- **Web Server / Reverse Proxy**: Nginx Alpine

---

## 3. Feature Implementation Status

| Subsystem | Feature | Status | Implementation Details |
|---|---|---|---|
| **Auth** | User Registration & Login | **Fully Implemented** | Bcrypt hashing, JWT generation, Student/Staff role selection |
| **Auth** | User Profile (`/auth/me`) | **Fully Implemented** | Fetches authenticated user info, active role, roll number |
| **Auth** | Email Verification & Password Reset | **Partially Implemented** | `EmailToken` database model exists; email dispatch service is planned |
| **Auth** | Refresh Token Rotation | **Partially Implemented** | `RefreshToken` database model exists; session currently uses 24-hour access JWTs |
| **Groups** | Group Creation & Unique Codes | **Fully Implemented** | Alphanumeric unique join codes, leader assignment, single active group constraint |
| **Groups** | Join, Leave & Disband | **Fully Implemented** | Join via code, leader transfer upon departure, orphan group deletion |
| **Workspaces** | Workspace CRUD & Archival | **Fully Implemented** | Custom workspace IDs, academic terms, soft-archive toggle |
| **Workspaces** | Staff Request & Delegation | **Fully Implemented** | Staff co-management request, approval/rejection, co-staff addition/removal |
| **Workspaces** | Group Curriculum Enrollment | **Fully Implemented** | Enrolls student groups into academic workspaces |
| **Notice Board** | Direct Image Upload | **Fully Implemented** | Drag-and-drop file upload, JPG/PNG/WebP validation, 5MB limit |
| **Notice Board** | 24-Hour Automated Expiration | **Fully Implemented** | Strict backend timestamp filtering (`expires_at`), background sweep cleanup |
| **Notice Board** | Notice Pinning & Archival | **Fully Implemented** | Pinned notices surface at top; unpinned upon expiration |
| **Projects** | Project Creation & Workspace Binding | **Fully Implemented** | One project per group per workspace, unique constraint |
| **Projects** | Updates & Timeline Comments | **Fully Implemented** | Progress update posts with threaded author comments |
| **Projects** | GitHub Repository Integration | **Fully Implemented** | Repository linking, live commit history sync, contributor tracking |
| **Review Rounds** | Configuration Pipeline | **Fully Implemented** | Dynamic round creation, sequential ordering, weights, max scores, due dates |
| **Review Rounds** | Edit Round UI Modal | **Fully Implemented** | Staff modal to update parameters, weight percentages, rubrics, and statuses |
| **Review Rounds** | Safe Round Deletion | **Fully Implemented** | Blocks deletion if submissions exist; logs `round_deleted` audit event |
| **Submissions** | Milestone Deliverables | **Fully Implemented** | Multi-round deliverables, minimum 2-member group validation |
| **Submissions** | Roster Freezing & Versioning | **Fully Implemented** | Freezes immutable JSON snapshot of group members on submission; tracks revisions |
| **Reviews** | Staff Review Queue | **Fully Implemented** | Submission claiming with row-level locks, filtered by managed workspaces |
| **Reviews** | Individual Student Grading | **Fully Implemented** | Scores validated against configured round max score; separate scores per student |
| **Reviews** | Result Release | **Fully Implemented** | Releases evaluation marks and feedback to enrolled students |
| **Results** | Results Dashboard | **Fully Implemented** | Dynamic round columns, group-level grouping, pass rates, average scores |
| **Results** | Universal CSV Export | **Fully Implemented** | UTF-8 CSV with BOM, one row per student, dynamic round headers, group grouping |
| **Results** | Grade Corrections | **Fully Implemented** | Staff grade adjustments with mandatory justification logging |
| **Audit Trail** | Administrative Activity Center | **Fully Implemented** | Structured event logging, 4 metric cards, 7 filter dimensions, JSON diff viewer |
| **Audit Trail** | Merkle Root Checkpointing | **Partially Implemented** | `AuditMerkleRoot` database model exists; automated tree generator is planned |
| **Search** | Role-Isolated Smart Search | **Fully Implemented** | Scoped search across workspaces, groups, projects, submissions, and students |
| **Performance** | In-Memory LRU Caching | **Fully Implemented** | Thread-safe `OrderedDict` with TTL, inverted tag index, `/cache/stats` telemetry |

---

## 4. Subsystem Deep Dive

### 4.1 Authentication & Access Control
- **Password Security**: Passwords are encrypted using direct `bcrypt` (`hash_password` in `app/core/security.py`) with automatic 72-byte truncation to prevent denial-of-service vulnerabilities.
- **Session Tokens**: Authentication returns a signed JWT access token (`HS256`, 24-hour expiration) storing the user email in the `sub` claim.
- **Client Storage**: The token is stored in `localStorage` under `nexavault_jwt_token` and automatically attached as a `Bearer` token in the `Authorization` header on all API calls.
- **Role Enforcement**:
  - `get_current_student`: Requires `role == "student"`.
  - `get_current_staff`: Requires `role in ["staff", "teacher"]`. Any student attempt to access a staff-only endpoint automatically creates a high-priority `ACCESS_DENIED` security audit entry before returning HTTP 403 Forbidden.

### 4.2 Student Groups & Team Formation
- Students form self-organized teams independent of specific workspaces.
- When a group is created, a unique alphanumeric join code (e.g., `GRP-A1B2C3`) is generated.
- Other students join using this code via `POST /api/v1/groups/join`.
- **Database Invariant**: A unique constraint on `group_memberships.user_id` guarantees that a student can belong to at most **one active group** at a time across the entire platform.
- **Leadership & Departure**: If a leader leaves, leadership transfers to the next senior member. If the last member leaves, the group is soft-deleted.

### 4.3 Academic Workspaces & Co-Staffing
- Faculty create workspaces specifying a title, academic term (e.g., "Fall 2026"), and optional custom workspace identifier.
- **Staff Access Delegation**: Other faculty members can submit a join request (`POST /api/v1/workspaces/{id}/staff-request`). The workspace owner approves or rejects requests.
- Workspace owners can directly add or remove co-staff members with delegated grading privileges.
- Workspaces can be archived, locking submissions and making review rounds read-only.

### 4.4 Notice Board with 24-Hour Expiration & Direct Upload
- **Direct Image Upload**: Replaces static image URLs with multipart file uploads (`POST /api/v1/workspaces/{id}/notices`). Validates MIME types (`image/jpeg`, `image/png`, `image/webp`) and enforces a 5MB size limit using Pillow.
- **Automated 24-Hour Expiration**:
  - Notices automatically record `created_at` and `expires_at = created_at + 24 hours`.
  - All read queries strictly filter `expires_at > datetime.now(timezone.utc)`.
  - Expired notices are excluded from both the main board and the pinned section.
  - Deleting a notice safely purges the associated image file from disk storage.

### 4.5 Project Workspaces & Live GitHub Integration
- Each enrolled group creates a project bound to the workspace.
- **Progress Updates**: Students post milestone updates with links and descriptions; staff and teammates add threaded comments.
- **GitHub Sync**: Projects can link a GitHub repository (`POST /api/v1/projects/{id}/github`). The backend communicates with GitHub's REST API to fetch live commit history, authors, commit SHAs, and repository branch details.

### 4.6 Review Round Configuration Pipeline
- Staff dynamically configure assessment milestones per workspace without code modifications:
  - Round Title (e.g., "Sprint 1 Architecture Review")
  - Sequential Order (`order_index`)
  - Weight Percentage (persisted in database, defaults to 20.0%)
  - Maximum Score (defaults to 100.0, validated $\ge 1.0$)
  - Due Date & Rubric Description
  - Active/Closed Toggle
- **Edit Modal**: Staff can edit existing round parameters via `PATCH /api/v1/workspaces/{id}/rounds/{round_id}`.
- **Deletion Protection**: Attempting to delete a round that contains student submissions is blocked with HTTP 400. Successful deletions log a `round_deleted` audit event.

### 4.7 Milestone Submissions & Roster Freezing
- **Submission Rules**:
  - Enforces a minimum group size of 2 members (`can_submit_to_round`).
  - Verifies workspace is active and review round is open.
  - Automatically flags late submissions if submitted after `round.due_date`.
- **Immutable Roster Freezing**: When a deliverable is submitted, the system captures a frozen snapshot of the group's current members (`roster_snapshot` JSONB column). This guarantees that subsequent changes to group membership cannot alter grading rosters for past submissions.

### 4.8 Staff Review Queue & Evaluation Workflow
- **Review Queue**: `GET /api/v1/reviews/queue` displays pending deliverables across all workspaces the staff member manages, ordered by round due date and submission timestamp.
- **Concurrency Control**: Staff claim submissions via `POST /api/v1/reviews/{version_id}/claim`. The backend uses PostgreSQL row-level locks to prevent two faculty members from grading the same submission simultaneously.
- **Individual Grading**:
  - Marks and feedback are recorded **per individual student**, not per group.
  - Scores are validated against the specific round's configured `max_score` (preventing out-of-range grades).
  - Every member in the frozen roster snapshot must receive an individual score entry.
- **Results Release**: Once evaluated, staff release marks to students via `POST /api/v1/reviews/{version_id}/release-results`.

### 4.9 Dedicated Results Dashboard & Universal CSV Export
- **Results Dashboard**: A dedicated staff view (`GET /api/v1/results/workspace/{id}`) presenting all enrolled groups, individual student scores across all dynamically configured rounds, completion status, total marks, percentage, and pass/fail indicators.
- **Grade Corrections**: Staff can correct awarded marks (`PATCH /api/v1/results/{entry_id}/correct`) with a mandatory reason, creating an immutable audit trail entry.
- **Universal CSV Export** (`GET /api/v1/results/workspace/{id}/export-csv`):
  - Generates a workspace-wide CSV file with dynamic review round headers (`Review Round N Marks`, `Review Round N Feedback`, `Review Round N Reviewer`, `Review Round N Date`).
  - One row per student, grouping students by group so group metadata appears cleanly on the first student row.
  - Prepends a UTF-8 Byte Order Mark (`\ufeff`) ensuring universal compatibility across Microsoft Excel, Google Sheets, and Apple Numbers without character corruption.

### 4.10 Administrative Activity Center & Merkle Model
- Centralized audit trail capturing security, access, workspace, assessment, and project events.
- **Overview Metrics**: Computes statistics for Total Events, Workspace Changes, Access Changes, and Security Events across 24h, 7d, 30d, and All Time.
- **Filtering & Search**: 7 filter dimensions including actor, category, action type, status, and date range.
- **Sensitive Data Scrubbing**: Automatically redacts passwords, tokens, API keys, and secrets from `old_value` and `new_value` JSON metadata before persistence.
- **Cryptographic Audit Model**: Includes the `AuditMerkleRoot` database model for checkpointing audit log ranges.

### 4.11 Role-Isolated Smart Search
- Fast multi-entity search (`GET /api/v1/search?q=...`):
  - **Staff**: Searches across managed workspaces, enrolled groups, projects, deliverables, and student rosters.
  - **Student**: Strictly isolated to the student's active group, enrolled workspaces, and team projects.
  - Excludes sensitive join codes and internal IDs from search text.

---

## 5. Database Architecture & Data Models

NexaVault uses PostgreSQL as its relational source of truth. All tables include primary keys, foreign key constraints with cascade rules, and relevant indices.

```mermaid
erDiagram
    users ||--o{ group_memberships : belongs_to
    users ||--o{ workspace_staff : manages
    users ||--o{ workspace_staff_requests : requests
    users ||--o{ workspace_notices : authors
    users ||--o{ project_updates : writes
    users ||--o{ update_comments : comments
    users ||--o{ submission_versions : submits
    users ||--o{ submission_versions : claims
    users ||--o{ reviews : evaluates
    users ||--o{ result_entries : receives
    users ||--o{ result_corrections : corrects
    users ||--o{ audit_logs : triggers

    workspaces ||--o{ workspace_staff : staff_list
    workspaces ||--o{ workspace_staff_requests : incoming_requests
    workspaces ||--o{ workspace_groups : enrolled_groups
    workspaces ||--o{ workspace_notices : notices
    workspaces ||--o{ review_rounds : rounds
    workspaces ||--o{ projects : contains

    groups ||--o{ group_memberships : members
    groups ||--o{ workspace_groups : enrollments
    groups ||--o{ projects : executes

    projects ||--o{ project_updates : updates
    projects ||--o{ submissions : submissions
    projects ||--o| github_links : links

    github_links ||--o{ github_commits : commits

    project_updates ||--o{ update_comments : comments

    review_rounds ||--o{ submissions : targets
    review_rounds ||--o{ result_entries : round_results

    submissions ||--o{ submission_versions : versions
    submission_versions ||--o| reviews : review_record

    reviews ||--o{ result_entries : awarded_scores
    result_entries ||--o{ result_corrections : history
```

### Relational Schema Summary

| Table | Primary Key | Foreign Keys & Constraints | Key Columns |
|---|---|---|---|
| `users` | `id` (Integer) | Unique: `email`, Indexed: `roll_number` | `email`, `hashed_password`, `full_name`, `roll_number`, `role`, `is_active` |
| `refresh_tokens` | `id` (Integer) | FK: `user_id` $\to$ `users.id` (CASCADE) | `token_hash`, `expires_at` |
| `email_tokens` | `id` (Integer) | FK: `user_id` $\to$ `users.id` (CASCADE) | `token`, `token_type`, `expires_at` |
| `groups` | `id` (Integer) | FK: `created_by` $\to$ `users.id`, Unique: `code` | `name`, `code`, `is_deleted`, `created_at` |
| `group_memberships` | `id` (Integer) | FKs: `group_id`, `user_id`, Unique: `user_id` | `joined_at` (enforces 1 group per student) |
| `workspaces` | `id` (String PK) | FK: `owner_id` $\to$ `users.id` | `name`, `description`, `term`, `is_open`, `is_archived` |
| `workspace_staff` | `id` (Integer) | FKs: `workspace_id`, `user_id`, Unique: `(workspace_id, user_id)` | `role`, `added_at` |
| `workspace_staff_requests` | `id` (Integer) | FKs: `workspace_id`, `requester_id`, Unique: `(workspace_id, requester_id)` | `status` (PENDING/APPROVED/REJECTED), `resolved_at` |
| `workspace_groups` | `id` (Integer) | FKs: `workspace_id`, `group_id`, Unique: `(workspace_id, group_id)` | `enrolled_by`, `enrolled_at` |
| `workspace_notices` | `id` (Integer) | FKs: `workspace_id`, `author_id` | `title`, `content`, `image_url`, `is_pinned`, `expires_at` |
| `projects` | `id` (Integer) | FKs: `workspace_id`, `group_id`, Unique: `(workspace_id, group_id)` | `name`, `description`, `created_by` |
| `project_updates` | `id` (Integer) | FKs: `project_id`, `author_id` | `content`, `link`, `created_at` |
| `update_comments` | `id` (Integer) | FKs: `update_id`, `author_id` | `content`, `created_at` |
| `github_links` | `id` (Integer) | FKs: `project_id` (Unique), `linked_by` | `repo_url`, `last_synced_at` |
| `github_commits` | `id` (Integer) | FK: `github_link_id` $\to$ `github_links.id` | `commit_sha`, `commit_message`, `author_name`, `committed_at` |
| `review_rounds` | `id` (Integer) | FK: `workspace_id`, Check: `max_score >= 1.0` | `title`, `order_index`, `due_date`, `max_score`, `weight`, `is_open` |
| `submissions` | `id` (Integer) | FKs: `project_id`, `round_id`, Unique: `(project_id, round_id)` | `created_at` |
| `submission_versions` | `id` (Integer) | FKs: `submission_id`, `submitted_by`, `claimed_by_id`, Unique: `(submission_id, version_number)` | `version_number`, `status`, `notes`, `link`, `roster_snapshot` (JSONB) |
| `reviews` | `id` (Integer) | FK: `submission_version_id` (Unique), FK: `reviewer_id` | `status`, `feedback`, `claimed_at`, `completed_at` |
| `result_entries` | `id` (Integer) | FKs: `review_id`, `student_id`, `round_id`, Unique: `(review_id, student_id)`, Check: `score >= 0` | `score`, `feedback`, `is_released`, `released_at` |
| `result_corrections` | `id` (Integer) | FKs: `result_entry_id`, `corrected_by_id` | `old_score`, `new_score`, `reason`, `created_at` |
| `audit_logs` | `id` (BigInteger PK) | FKs: `actor_id`, `workspace_id`, Indexed: `created_at`, `action_type` | `category`, `action_type`, `action_name`, `status`, `old_value`, `new_value` |
| `audit_merkle_roots` | `id` (Integer) | None | `root_hash`, `log_range_start`, `log_range_end`, `computed_at` |

---

## 6. API Specification

All API endpoints are prefixed with `/api/v1` and return JSON.

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/register` | Public | Register new user account (`email`, `password`, `full_name`, `role`, `roll_number`) |
| `POST` | `/login` | Public | Authenticate user credentials; returns JWT `access_token` and user profile |
| `GET` | `/me` | Authenticated | Retrieve current authenticated user profile |

### Student Groups (`/api/v1/groups`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/` | Student | Create a new student group; generates unique join code |
| `GET` | `/me` | Student | Retrieve current student's active group and members |
| `GET` | `/{group_id}` | Authenticated | Retrieve group details by ID |
| `POST` | `/join` | Student | Join an existing group using its unique join code |
| `PATCH`| `/{group_id}/code` | Group Leader | Regenerate the group's join code |
| `POST` | `/{group_id}/leave` | Member | Leave group; automatically handles leader transfer or group deletion |
| `POST` | `/{group_id}/enroll`| Member | Enroll group into a workspace curriculum |

### Academic Workspaces (`/api/v1/workspaces`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/` | Staff | Create an academic workspace (`name`, `description`, `term`, `id`) |
| `GET` | `/` | Authenticated | List workspaces (scoped by role; student view batches notices and rounds) |
| `GET` | `/{workspace_id}` | Authenticated | Retrieve workspace details and enrolled groups |
| `POST` | `/{workspace_id}/staff-request` | Staff | Submit request for co-staff grading access |
| `GET` | `/{workspace_id}/staff-requests` | Workspace Owner | List pending staff access requests |
| `POST` | `/{workspace_id}/staff-request/{id}/resolve` | Workspace Owner | Approve or reject a staff access request |
| `POST` | `/{workspace_id}/costaff/{user_id}` | Workspace Owner | Add faculty member as co-staff |
| `DELETE`|`/{workspace_id}/costaff/{user_id}` | Workspace Owner | Revoke faculty co-staff privileges |
| `POST` | `/{workspace_id}/archive` | Workspace Owner | Archive workspace (locks submissions) |
| `GET` | `/{workspace_id}/groups` | Staff | List all groups enrolled in the workspace |
| `GET` | `/{workspace_id}/projects` | Staff | List all projects created in the workspace |
| `GET` | `/{workspace_id}/notices` | Enrolled/Staff | List active, unexpired notices (pinned first) |
| `POST` | `/{workspace_id}/notices` | Staff | Publish notice with optional direct image upload (24h expiry) |
| `PATCH`| `/{workspace_id}/notices/{id}` | Notice Author/Staff | Edit notice title or content |
| `POST` | `/{workspace_id}/notices/{id}/pin` | Staff | Toggle notice pin state |
| `DELETE`|`/{workspace_id}/notices/{id}` | Notice Author/Staff | Delete notice and remove uploaded image from disk |
| `POST` | `/notices/cleanup-expired` | Public/Cron | Trigger sweep to delete expired notices |
| `GET` | `/notices/images/{filename}` | Public | Serve uploaded notice image (cached) |
| `GET` | `/{workspace_id}/rounds` | Enrolled/Staff | List review rounds ordered by `order_index` |
| `POST` | `/{workspace_id}/rounds` | Staff | Create review round (`title`, `order_index`, `max_score`, `weight`, `due_date`) |
| `PATCH`| `/{workspace_id}/rounds/{round_id}` | Staff | Update review round parameters and rubric |
| `POST` | `/{workspace_id}/rounds/{round_id}/toggle` | Staff | Toggle round open/closed status |
| `DELETE`|`/{workspace_id}/rounds/{round_id}` | Staff | Delete round (blocked if submissions exist; audited) |

### Projects & Updates (`/api/v1/projects`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/` | Enrolled Group | Create workspace project for the group |
| `GET` | `/{project_id}` | Group Member/Staff | Retrieve project details, team roster, and GitHub link |
| `GET` | `/{project_id}/updates` | Group Member/Staff | List progress update timeline |
| `POST` | `/{project_id}/updates` | Group Member | Post a milestone progress update |
| `POST` | `/{project_id}/updates/{id}/comments` | Member/Staff | Post a threaded comment on a project update |
| `GET` | `/{project_id}/github` | Member/Staff | Get linked GitHub repository details and commits |
| `POST` | `/{project_id}/github` | Group Member | Link a GitHub repository (`repo_url`, `branch`) |
| `POST` | `/{project_id}/github/sync` | Group Member/Staff | Fetch live commits from GitHub API |
| `DELETE`|`/{project_id}/github` | Group Member | Unlink GitHub repository |

### Milestone Submissions (`/api/v1`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/projects/{project_id}/submissions` | Member/Staff | List submissions across rounds for a project |
| `POST` | `/projects/{project_id}/rounds/{round_id}/submissions` | Group Member | Submit deliverable (validates group size $\ge 2$, freezes roster) |
| `PATCH`| `/submissions/{submission_id}/draft` | Group Member | Update draft deliverable notes and links |
| `POST` | `/submissions/{submission_id}/submit` | Group Member | Finalize draft deliverable for review |

### Review Queue & Grading (`/api/v1`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/reviews/queue` | Staff | List pending submissions across managed workspaces |
| `POST` | `/reviews/{version_id}/claim` | Staff | Claim submission for evaluation (uses row-level lock) |
| `POST` | `/reviews/{version_id}/release-claim` | Claiming Staff | Release claimed submission back to queue |
| `POST` | `/reviews/{version_id}/evaluate` | Claiming Staff | Submit evaluation with individual student scores and feedback |
| `POST` | `/reviews/{version_id}/release-results` | Staff | Release marks and feedback to students |

### Results & CSV Export (`/api/v1/results`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/workspace/{workspace_id}` | Staff | Dedicated Results Dashboard with dynamic round columns |
| `GET` | `/workspace/{workspace_id}/export-csv` | Staff | Export workspace results as UTF-8 CSV with BOM |
| `GET` | `/me` | Student | View personal grades and feedback across enrolled workspaces |
| `PATCH`| `/{entry_id}/correct` | Staff | Correct student grade with mandatory audit justification |

### Smart Search (`/api/v1/search`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/search?q={query}` | Authenticated | Role-isolated search across workspaces, groups, projects, submissions, and students |

### Administrative Activity Center (`/api/v1/audit`)
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/audit/activity` | Staff | Paginated audit events with 7 filter parameters |
| `GET` | `/audit/stats` | Staff | Aggregated event statistics across 4 overview categories |
| `GET` | `/audit/filters` | Staff | Dropdown filter options for UI |
| `GET` | `/audit/logs` | Staff | Raw audit logs |

### Health & Telemetry
| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/health` / `/api/v1/health` | Public | Health check (`?wake_db=true` pings PostgreSQL) |
| `GET` | `/api/v1/cache/stats` | Public | Telemetry report for in-memory LRU cache |

---

## 7. Security Architecture

1. **Password Hashing**: Uses direct `bcrypt.hashpw` with per-user salt generation. Truncates input at 72 bytes to mitigate denial-of-service vectors.
2. **JWT Authentication**: Signed with HMAC-SHA256 (`HS256`). Claims include subject (`sub`), issued-at (`iat`), and expiration (`exp`). Token validation is performed via FastAPI dependency injection.
3. **Role & Object Authorization**:
   - Role checks (`get_current_student`, `get_current_staff`) are executed at the route layer.
   - Fine-grained object permissions (`can_access_workspace`, `can_manage_round`, `can_review_submission`) verify that faculty can only view and score projects in workspaces they own or co-manage.
4. **Audit Logging & Redaction**: The audit logging pipeline (`app/services/audit_service.py`) intercepts all security, access, and assessment events. Sensitive keys (`password`, `token`, `secret`, `api_key`, `jwt`) are recursively replaced with `[REDACTED]` before database commit.
5. **File Upload Security**: Direct image uploads are verified for MIME type and file size ($\le 5\text{MB}$), sanitized against directory traversal attacks, and stored outside web root with unique UUID filenames.
6. **Concurrent Review Protection**: Uses PostgreSQL `FOR UPDATE` row-level locks during submission claiming, eliminating race conditions when multiple staff members access the review queue.

---

## 8. Performance & In-Memory Caching

NexaVault incorporates an in-memory caching and query optimization layer designed for sub-millisecond response times:

### In-Memory LRU Cache (`app/core/cache.py`)
- **Structure**: Thread-safe `OrderedDict` maintaining an LRU eviction policy ($O(1)$ lookup, update, and eviction) capped at `CACHE_MAX_ENTRIES` (default 2000).
- **Inverted Tag Index**: Maintains a `Dict[str, Set[str]]` mapping cache tags (e.g., `workspace:WS-01`, `review:queue`) to keys. Allows $O(k)$ targeted invalidation upon write operations without flushing unrelated entries.
- **Cache Isolation**: Returns `copy.deepcopy` of cached objects to prevent in-place mutation side effects.
- **Live Telemetry**: Exposed at `GET /api/v1/cache/stats` reporting hits, misses, hit rate percentage, eviction count, and active entry counts.

### Database Query Optimizations
- **N+1 Query Elimination**: Endpoints such as `list_workspaces` use SQLAlchemy `joinedload` and SQL `IN(...)` batch queries to load all projects, review rounds, and notices in 3 database queries rather than $O(N)$ sequential queries.
- **Neon Serverless Pooling**: Optimized connection string handling and a throttled health-check ping (`/api/v1/health?wake_db=true`) prevent connection exhaustion and warm sleeping database compute instances on app mount.

---

## 9. Project Directory Structure

```
NexaVault/
├── .env.example                     # Environment variables configuration template
├── .gitignore                       # Git exclusion rules
├── docker-compose.yml               # Multi-container Docker orchestration manifest
├── README.md                        # Master technical documentation
├── vercel.json                      # Vercel deployment routing configuration
│
├── backend/
│   ├── Dockerfile                   # Python 3.13 production container definition
│   ├── entrypoint.sh                # Container startup: runs migrations & starts Uvicorn
│   ├── requirements.txt             # Python dependencies manifest
│   ├── alembic.ini                  # Alembic migration configuration
│   ├── benchmark_cache.py           # In-memory cache latency benchmarking harness
│   │
│   ├── alembic/
│   │   ├── env.py                   # Migration environment & model metadata
│   │   └── versions/                # Versioned SQL migration scripts
│   │
│   ├── app/
│   │   ├── main.py                  # FastAPI application entrypoint & middleware
│   │   │
│   │   ├── api/
│   │   │   ├── deps.py              # Dependency injection: get_db, auth checks
│   │   │   └── v1/
│   │   │       ├── router.py        # Central API v1 router aggregator
│   │   │       └── endpoints/       # Domain route modules
│   │   │           ├── audit.py     # Administrative Activity Center endpoints
│   │   │           ├── auth.py      # Registration, login, profile endpoints
│   │   │           ├── groups.py    # Team management & join code endpoints
│   │   │           ├── projects.py  # Projects, updates & GitHub sync endpoints
│   │   │           ├── results.py   # Results dashboard & CSV export endpoints
│   │   │           ├── reviews.py   # Staff review queue & scoring endpoints
│   │   │           ├── search.py    # Role-isolated Smart Search endpoints
│   │   │           ├── submissions.py # Milestone submissions & versioning
│   │   │           └── workspaces.py  # Workspaces, notices & rounds endpoints
│   │   │
│   │   ├── core/
│   │   │   ├── cache.py             # Thread-safe LRU cache with inverted tag index
│   │   │   ├── config.py            # Pydantic Settings configuration & CORS parser
│   │   │   ├── permissions.py       # Object-level authorization rules (can_*)
│   │   │   └── security.py          # Bcrypt hashing & JWT signing/decoding
│   │   │
│   │   ├── db/
│   │   │   ├── base.py              # SQLAlchemy DeclarativeBase
│   │   │   └── session.py           # Engine & SessionLocal factory
│   │   │
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   │   ├── audit.py             # AuditLog, AuditMerkleRoot
│   │   │   ├── github.py            # GithubLink, GithubCommit
│   │   │   ├── group.py             # Group, GroupMembership
│   │   │   ├── project.py           # Project, ProjectUpdate, UpdateComment
│   │   │   ├── review.py            # ReviewRound, Submission, Version, Review, ResultEntry
│   │   │   ├── user.py              # User, RefreshToken, EmailToken
│   │   │   └── workspace.py         # Workspace, Staff, Request, Group, Notice
│   │   │
│   │   ├── schemas/                 # Pydantic request/response validation shapes
│   │   │   ├── audit.py, github.py, group.py, project.py,
│   │   │   ├── result.py, review.py, search.py, submission.py,
│   │   │   ├── user.py, workspace.py
│   │   │
│   │   └── services/
│   │       ├── audit_service.py     # Centralized audit logger & metadata sanitizer
│   │       ├── project_service.py   # Project lifecycle operations
│   │       └── storage_service.py   # Multipart image upload & disk lifecycle
│   │
│   ├── tests/                       # Automated pytest test suites
│   │   ├── test_audit_activity_center.py
│   │   ├── test_cache_layer.py
│   │   ├── test_notice_board.py
│   │   ├── test_results_section.py
│   │   ├── test_review_round_pipeline.py
│   │   └── test_step1_marking_migration.py
│   │
│   └── uploads/                     # Uploaded media storage directory
│
├── frontend/
│   ├── Dockerfile                   # Node 20 multi-stage build + Nginx container
│   ├── nginx.conf                   # Nginx SPA fallback & caching configuration
│   ├── package.json                 # Node dependencies & build scripts
│   ├── vite.config.js               # Vite bundler configuration
│   ├── tailwind.config.js           # Tailwind CSS theme & tokens
│   │
│   └── src/
│       ├── App.jsx                  # Root router switcher (Auth / Staff / Student)
│       ├── main.jsx                 # React DOM mount point
│       ├── api/                     # Axios / Fetch API client modules
│       ├── context/
│       │   └── AuthContext.jsx      # Authentication state provider & localStorage sync
│       │
│       └── pages/
│           ├── Login/
│           │   └── Login.jsx        # Login & registration portal
│           ├── Staff/
│           │   ├── StaffDashboard.jsx         # Staff sidebar & navigation shell
│           │   ├── StaffDashboardView.jsx     # Staff metrics overview
│           │   ├── StaffWorkspacesView.jsx    # Workspaces, Notice Board & Round manager
│           │   ├── StaffReviewQueueView.jsx   # Submission review & grading queue
│           │   ├── StaffResultsView.jsx       # Results dashboard & CSV exporter
│           │   ├── StaffProjectDetailView.jsx # Project inspector & GitHub sync
│           │   ├── StaffAuditTrailView.jsx    # Administrative Activity Center
│           │   ├── StaffSmartSearchView.jsx   # Staff global search
│           │   └── StaffProfileView.jsx       # Staff profile view
│           │
│           └── Student/
│               ├── StudentDashboard.jsx       # Student navigation shell
│               ├── DashboardView.jsx          # Student metrics & upcoming deadlines
│               ├── WorkspacesView.jsx         # Enrolled workspaces & notice board
│               ├── GroupsView.jsx             # Group formation & join code manager
│               ├── ProjectsView.jsx           # Project workspace & updates
│               ├── SubmissionsView.jsx        # Milestone submission tracker
│               ├── ResultsView.jsx            # Student grades & faculty feedback
│               ├── SmartSearchView.jsx        # Student scoped search
│               ├── AuditTrailView.jsx         # Student activity history
│               └── ProfileView.jsx            # Student profile view
```

---

## 10. Setup & Execution Guide

### Prerequisites
- **Python**: 3.11, 3.12, or 3.13
- **Node.js**: 18.x or 20.x
- **PostgreSQL**: 15+ (local instance or cloud provider like Neon)
- **Docker**: (Optional) Docker Desktop 24+ with Docker Compose

---

### Method A: Local Development Setup

#### 1. Configure Environment
Copy the environment template in the repository root:
```bash
cp .env.example .env
```
Edit `.env` and set your credentials:
```ini
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexavault_db
JWT_SECRET=your_secure_random_key_minimum_32_characters_long
CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
```

#### 2. Start PostgreSQL Database
Ensure a local PostgreSQL server is running and create the database:
```sql
CREATE DATABASE nexavault_db;
```

#### 3. Backend Setup
Navigate to the `backend/` directory:
```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run database migrations to head
alembic upgrade head

# Start the FastAPI development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API and Swagger UI will be accessible at:
- API Base: `http://127.0.0.1:8000`
- Interactive Swagger Docs: `http://127.0.0.1:8000/api/v1/docs`

#### 4. Frontend Setup
Open a second terminal and navigate to `frontend/`:
```bash
cd frontend

# Install Node dependencies
npm install

# Start Vite development server
npm run dev
```
The frontend application will be accessible at:
- Frontend URL: `http://localhost:5173`

---

### Method B: Full-Stack Docker Compose Setup

Run the entire application (PostgreSQL, Backend, Frontend) with a single command:
```bash
# From the repository root:
docker compose up --build -d
```
Docker Compose orchestrates:
- `db`: PostgreSQL 16 Alpine container on port `5432` with named volume persistence.
- `backend`: Runs migrations via `entrypoint.sh` and serves FastAPI on port `8000`.
- `frontend`: Builds the production Vite bundle and serves it via Nginx on port `3000`.

To stop the containers:
```bash
docker compose down
```

---

## 11. Testing & Verification

NexaVault includes a full automated test suite covering all critical workflows:

```bash
# Run all backend tests from the backend directory:
cd backend
pytest -v
```

### Verified Test Suites (44 passed)
- **`test_audit_activity_center.py`** (6 tests): Validates activity center endpoints, event aggregation, filtering, security denial logging, and JSON metadata diffs.
- **`test_cache_layer.py`** (9 tests): Validates in-memory LRU eviction, TTL expiration, tag-based targeted invalidation, concurrency locks, and telemetry.
- **`test_notice_board.py`** (8 tests): Validates image file uploads, MIME sniffing, 5MB limit, 24-hour expiration queries, notice pinning, and storage deletion.
- **`test_results_section.py`** (6 tests): Validates results dashboard, individual student grading, dynamic round columns, pass/fail percentage calculations, and CSV export formatting with UTF-8 BOM.
- **`test_review_round_pipeline.py`** (7 tests): Validates round weight persistence, edit round modal PATCH endpoint, cross-workspace isolation, cache invalidation, review queue scoring against round max score, and round deletion protection.
- **`test_step1_marking_migration.py`** (8 tests): Validates database schema migrations, backfill idempotency, score constraints, and result entry integrity.

### Cache Latency Benchmark
To measure local in-memory cache hit vs. miss performance:
```bash
cd backend
python benchmark_cache.py
```

---

## 12. Current Limitations & Roadmap

1. **Email Service Dispatch**:
   - `EmailToken` database model is implemented.
   - SMTP dispatch (via Mailpit in development or SendGrid/SES in production) for self-service password reset and email verification links is planned for a future release.
2. **Automated Merkle Tree Generator**:
   - The `AuditMerkleRoot` database model is implemented to record periodic checkpoint hashes.
   - The scheduled background cron job to compute Merkle trees over ranges of audit log entries and verify external cryptographic proofs is not yet automated.
3. **Distributed Cache Scaling**:
   - The current `InMemoryCache` operates in the memory space of a single Uvicorn process.
   - Horizontal scaling across multiple worker processes or distributed containers requires replacing the in-process store with a Redis backend (the interface in `app/core/cache.py` is pre-architected for this drop-in replacement).
4. **Full-Text Trigram Search**:
   - Smart search currently uses SQL `ILIKE '%term%'` filters. Adding PostgreSQL GIN trigram indexes (`pg_trgm`) will further optimize search over large project corpora.
