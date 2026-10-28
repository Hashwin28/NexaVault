# NexaVault — Academic Project Report (LaTeX Source Project)

## Project Overview
- **Project Title:** NexaVault — Departmental Academic Workspace & Project Evaluation Platform
- **Course:** `23AID204 | Advanced Data Structures & Algorithm Analysis`
- **Institution:** Amrita Vishwa Vidyapeetham, School of Artificial Intelligence, Coimbatore
- **Faculty In-Charge:** Dr. Ardra P. S.
- **Project Team:**
  - `CB.AI.U4AID25008` — Gurucharan
  - `CB.AI.U4AID25049` — Sharvesh
  - `CB.AI.U4AID25062` — Bhavesh Jayan
  - `CB.AI.U4AID25064` — Hashwin
- **Official GitHub Repository:** https://github.com/HackRythm/NexaVault
- **Live Public Deployment:** https://nexa-vault-chi.vercel.app/

---

## Document Specifications
- **Page Budget:** Exactly **12 pages total** (strictly conforming to the 12-page maximum constraint).
- **Typography:** Times Roman typography with standardized academic layout, A4 paper, running headers/footers, and IEEE numeric citations.
- **Figures Included:**
  - `figures/amrita_logo.png`: Institutional emblem (Cover Page).
  - `figures/system_architecture.jpg`: NexaVault Three-Tier System Architecture (Section 6, Figure 1).
  - `figures/student_dashboard.png`: Student Collaborative Workspace Overview (Section 8, Figure 2a).
  - `figures/student_submissions.png`: Deliverable Submissions & Commit Changelog (Section 8, Figure 2b).
  - `figures/staff_dashboard.png`: Staff Workspace & Review Queue Dashboard (Section 8, Figure 3a).
  - `figures/staff_results.png`: Academic Results Ledger & Universal CSV Export (Section 8, Figure 3b).
  - `figures/staff_notice_board.png`: 24-Hour Notice Board & Direct Media Upload (Section 9, Figure 4a).
  - `figures/staff_audit_trail.png`: Administrative Activity Center & Audit Trail (Section 9, Figure 4b).

---

## Directory Structure
```
latex_report/
├── main.tex                 # Master LaTeX document
├── references.bib           # BibTeX bibliographic citations (IEEE style)
├── main.pdf                 # Final compiled PDF (12 pages)
├── figures/                 # All figure assets, screenshots, and institutional logos
│   ├── amrita_logo.png
│   ├── system_architecture.jpg
│   ├── student_dashboard.png
│   ├── student_submissions.png
│   ├── staff_dashboard.png
│   ├── staff_results.png
│   ├── staff_notice_board.png
│   └── staff_audit_trail.png
└── README.md                # Compilation instructions & documentation
```

---

## Compilation Instructions

The document is engineered to compile cleanly using standard `pdflatex` and `bibtex` with zero external package installations required.

### Recommended CLI Build:
```bash
cd latex_report
pdflatex -interaction=nonstopmode main.tex
bibtex main
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
```

### Overleaf / Cloud LaTeX:
Upload the entire `latex_report` directory (or zip archive) to Overleaf. Set the compiler to **pdfLaTeX** and set the main document to `main.tex`. It compiles out-of-the-box in seconds.
