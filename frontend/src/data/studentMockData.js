export const studentProfile = {
  name: "Alex Chen",
  id: "NV-2024-8841",
  email: "student@nexavault.edu",
  role: "Student",
  department: "Department of Computer Science & Engineering",
  program: "B.Tech Computer Science — Semester 3",
  avatar: "AC",
  gpa: "3.92 / 4.00",
  rank: "#2 in Cohort (120 Students)",
  githubConnected: true,
  githubHandle: "alexchen-dev",
};

export const overviewMetrics = [
  {
    title: "Active Workspaces",
    value: "4",
    subtitle: "All course vaults operational",
    icon: "Grid",
    color: "teal",
  },
  {
    title: "Ongoing Projects",
    value: "6",
    subtitle: "2 deadlines this week",
    icon: "Folder",
    color: "sky",
  },
  {
    title: "Pending Reviews",
    value: "3",
    subtitle: "1 faculty action required",
    icon: "Clock",
    color: "amber",
  },
  {
    title: "Average Grade",
    value: "96.4%",
    subtitle: "Grade Index: A+ (Highest Honor)",
    icon: "Award",
    color: "emerald",
  },
];

export const activeWorkspaces = [
  {
    id: "ws-dsa",
    code: "CS204-DSA",
    title: "DSA Algorithmic Vault",
    instructor: "Dr. Sarah Jenkins",
    modulesCount: 8,
    progress: 92,
    lastCommit: "Optimized Red-Black Tree balancing algorithm",
    lastActivity: "12 mins ago",
    repoUrl: "github.com/nexavault/cs204-dsa-vault",
    tags: ["Data Structures", "Algorithms", "C++"],
  },
  {
    id: "ws-ase",
    code: "CS301-ASE",
    title: "Advanced Software Engineering Lab",
    instructor: "Prof. Marcus Vance",
    modulesCount: 5,
    progress: 78,
    lastCommit: "Implemented FastAPI JWT middleware & CORS settings",
    lastActivity: "2 hours ago",
    repoUrl: "github.com/nexavault/cs301-ase-app",
    tags: ["FastAPI", "React", "Architecture"],
  },
  {
    id: "ws-dbs",
    code: "CS208-DBS",
    title: "Database Systems Core",
    instructor: "Dr. Elena Rostova",
    modulesCount: 6,
    progress: 85,
    lastCommit: "Completed B+ Tree Indexing performance benchmark",
    lastActivity: "Yesterday",
    repoUrl: "github.com/nexavault/cs208-db-engine",
    tags: ["SQL", "Relational DB", "B+ Trees"],
  },
  {
    id: "ws-osk",
    code: "CS305-OSK",
    title: "Operating Systems Kernel",
    instructor: "Dr. David Miller",
    modulesCount: 4,
    progress: 60,
    lastCommit: "Custom Virtual Memory Page Replacement Algorithm",
    lastActivity: "2 days ago",
    repoUrl: "github.com/nexavault/cs305-os-kernel",
    tags: ["C", "POSIX", "Memory Management"],
  },
];

export const currentProjects = [
  {
    id: "proj-1",
    title: "NexaVault Core Storage Engine",
    workspace: "CS204-DSA",
    status: "NEEDS_REVISION",
    statusLabel: "Feedback Action Required",
    progress: 85,
    deadline: "Oct 5, 2026",
    daysLeft: 2,
    techStack: ["C++", "B-Tree", "Memory Pools"],
  },
  {
    id: "proj-2",
    title: "Distributed Auth Gateway",
    workspace: "CS301-ASE",
    status: "UNDER_REVIEW",
    statusLabel: "Faculty Review in Progress",
    progress: 95,
    deadline: "Oct 8, 2026",
    daysLeft: 5,
    techStack: ["Python", "FastAPI", "PyJWT"],
  },
  {
    id: "proj-3",
    title: "Query Execution Planner",
    workspace: "CS208-DBS",
    status: "APPROVED",
    statusLabel: "Grade A+ (98/100)",
    progress: 100,
    deadline: "Completed",
    daysLeft: 0,
    techStack: ["SQLAlchemy", "SQLite", "AST Parsing"],
  },
  {
    id: "proj-4",
    title: "POSIX Thread Pool Scheduler",
    workspace: "CS305-OSK",
    status: "SUBMITTED",
    statusLabel: "Auto-Grader Passed (100%)",
    progress: 70,
    deadline: "Oct 12, 2026",
    daysLeft: 9,
    techStack: ["C", "Pthreads", "Synchronization"],
  },
];

export const submissionLifecycle = [
  {
    step: 1,
    name: "Project Initiated",
    date: "Sep 28, 2026",
    status: "COMPLETED",
    detail: "Repository cloned and workspace environment initialized.",
  },
  {
    step: 2,
    name: "Initial Submission",
    date: "Sep 30, 2026",
    status: "COMPLETED",
    detail: "Code artifact SUB-DSA-042 pushed to main branch.",
  },
  {
    step: 3,
    name: "Auto-Grader Audit",
    date: "Oct 1, 2026",
    status: "COMPLETED",
    detail: "14/14 automated algorithmic unit test cases passed.",
  },
  {
    step: 4,
    name: "Faculty Review",
    date: "Oct 3, 2026",
    status: "ACTION_REQUIRED",
    detail: "Dr. Sarah Jenkins requested Big-O complexity analysis revision.",
  },
  {
    step: 5,
    name: "Resubmission",
    date: "Due Oct 5",
    status: "PENDING",
    detail: "Awaiting student upload of revised documentation & edge cases.",
  },
  {
    step: 6,
    name: "Final Result",
    date: "Pending",
    status: "WAITING",
    detail: "Final grade index calculation and credit assignment.",
  },
];

export const facultyFeedbackList = [
  {
    id: "fb-1",
    evaluator: "Dr. Sarah Jenkins",
    title: "Department Head — Computer Science",
    target: "NexaVault Core Storage Engine (SUB-DSA-042)",
    message: "Excellent implementation of node rotations in your Red-Black Tree. Please add the worst-case space complexity analysis in your README.md and handle null root deletion edge cases before final grading.",
    dueDate: "Tomorrow at 23:59",
    priority: "HIGH",
    actionRequired: "Upload Revised Documentation",
  },
  {
    id: "fb-2",
    evaluator: "Prof. Marcus Vance",
    title: "Software Engineering Lead",
    target: "Distributed Auth Gateway (SUB-ASE-019)",
    message: "CORS configuration looks solid. Ensure that IPv6 fallback handling for local Windows development environment is documented in your architecture diagram.",
    dueDate: "Oct 7, 2026",
    priority: "MEDIUM",
    actionRequired: "Update Architecture Diagram",
  },
];

export const recentResults = [
  {
    id: "res-1",
    course: "CS208-DBS",
    title: "Query Execution Planner",
    score: "98 / 100",
    grade: "A+",
    evaluator: "Dr. Elena Rostova",
    date: "Oct 2, 2026",
    feedback: "Exceptional AST traversal optimization and benchmark execution time.",
  },
  {
    id: "res-2",
    course: "CS204-DSA",
    title: "Heap Allocator & Garbage Collection",
    score: "95 / 100",
    grade: "A",
    evaluator: "Dr. Sarah Jenkins",
    date: "Sep 28, 2026",
    feedback: "Clean memory pool management with zero memory leaks in Valgrind audit.",
  },
];

export const recentActivity = [
  {
    id: "act-1",
    time: "12 mins ago",
    text: "Ran NexaVault Auto-Grader test suite for SUB-DSA-042 (14/14 test cases passed).",
    type: "test",
  },
  {
    id: "act-2",
    time: "1 hour ago",
    text: "Faculty Dr. Sarah Jenkins posted review feedback on NexaVault Core Storage Engine.",
    type: "feedback",
  },
  {
    id: "act-3",
    time: "3 hours ago",
    text: "Merged PR #14 (feat/jwt-auth) into workspace Advanced Software Engineering Lab.",
    type: "github",
  },
  {
    id: "act-4",
    time: "Yesterday",
    text: "Passed Security Audit Check for JWT Token verification & Bcrypt hashing.",
    type: "security",
  },
];

export const studentGroups = [
  {
    id: "grp-1",
    name: "Alpha Storage Engine Vault",
    tagline: "High-performance algorithmic data structures & B-Tree indexing team",
    status: "IN_REVISION",
    statusLabel: "Revision in Progress",
    workspaceCode: "CS204-DSA",
    workspaceTitle: "DSA Algorithmic Vault",
    projectTitle: "NexaVault Core Storage Engine",
    repoUrl: "github.com/nexavault-teams/alpha-storage-vault",
    lead: "Alex Chen",
    members: [
      { name: "Alex Chen", role: "Team Lead & Data Structures", avatar: "AC", isUser: true },
      { name: "Maya Lin", role: "Algorithmic Optimizer", avatar: "ML" },
      { name: "Rohan Patel", role: "Benchmarking & C++ Core", avatar: "RP" },
      { name: "Sofia Rossi", role: "Unit Tests & Auto-Grader", avatar: "SR" }
    ],
    lastActivity: "Merged PR #18 (Red-Black Tree balance logic) 25 mins ago",
    activeSprint: "Sprint 3: Big-O Space Analysis",
    deliverablesCount: 4,
    completedDeliverables: 3
  },
  {
    id: "grp-2",
    name: "CyberAuth Security Squad",
    tagline: "Distributed microservices authentication & JWT security gateway",
    status: "UNDER_REVIEW",
    statusLabel: "Faculty Reviewing Sprint 2",
    workspaceCode: "CS301-ASE",
    workspaceTitle: "Advanced Software Engineering Lab",
    projectTitle: "Distributed Auth Gateway",
    repoUrl: "github.com/nexavault-teams/cyberauth-squad",
    lead: "David Kim",
    members: [
      { name: "Alex Chen", role: "FastAPI Backend Developer", avatar: "AC", isUser: true },
      { name: "David Kim", role: "Architecture Lead", avatar: "DK" },
      { name: "Emily Watson", role: "React Integration Specialist", avatar: "EW" }
    ],
    lastActivity: "Pushed commit 476626d to auth-router 2 hours ago",
    activeSprint: "Sprint 2: CORS & Token Verification",
    deliverablesCount: 5,
    completedDeliverables: 5
  },
  {
    id: "grp-3",
    name: "Relational Query Planners",
    tagline: "SQL Parser, Abstract Syntax Tree generator, and Query optimizer team",
    status: "APPROVED",
    statusLabel: "Grade A+ (98/100)",
    workspaceCode: "CS208-DBS",
    workspaceTitle: "Database Systems Core",
    projectTitle: "Query Execution Planner",
    repoUrl: "github.com/nexavault-teams/query-planners",
    lead: "Alex Chen",
    members: [
      { name: "Alex Chen", role: "Lead SQL Engine Dev", avatar: "AC", isUser: true },
      { name: "Lucas Meyer", role: "AST Optimizer", avatar: "LM" },
      { name: "Aria Thorne", role: "Database Benchmarks", avatar: "AT" }
    ],
    lastActivity: "Graded by Dr. Elena Rostova on Oct 2",
    activeSprint: "Final Release Delivered",
    deliverablesCount: 6,
    completedDeliverables: 6
  },
  {
    id: "grp-4",
    name: "Kernel Thread Schedulers",
    tagline: "POSIX concurrent thread scheduling & memory page replacement group",
    status: "ACTIVE",
    statusLabel: "Active Development",
    workspaceCode: "CS305-OSK",
    workspaceTitle: "Operating Systems Kernel",
    projectTitle: "POSIX Thread Pool Scheduler",
    repoUrl: "github.com/nexavault-teams/kernel-schedulers",
    lead: "Elena Zhao",
    members: [
      { name: "Alex Chen", role: "Virtual Memory Module Dev", avatar: "AC", isUser: true },
      { name: "Elena Zhao", role: "Pthreads Lead", avatar: "EZ" },
      { name: "Marcus Vance", role: "Synchronization & Mutex", avatar: "MV" },
      { name: "James Wright", role: "Kernel Drivers", avatar: "JW" }
    ],
    lastActivity: "Ran virtual memory page replacement tests 1 day ago",
    activeSprint: "Sprint 4: Lock-free Queue",
    deliverablesCount: 4,
    completedDeliverables: 2
  }
];
