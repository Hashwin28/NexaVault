from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Numeric, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from app.db.base import Base

# Use JSONB if on postgres, else JSON fallback
JSONType = JSON().with_variant(JSONB, "postgresql")

class ReviewRound(Base):
    __tablename__ = "review_rounds"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, default=1, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    max_score = Column(Numeric(6, 2), default=100.0, nullable=False)
    is_open = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    workspace = relationship("Workspace", back_populates="review_rounds")
    submissions = relationship("Submission", back_populates="round", cascade="all, delete-orphan")
    results = relationship("ResultEntry", back_populates="round", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("max_score >= 1.0", name="chk_round_max_score_positive"),
    )

    def __repr__(self):
        return f"<ReviewRound id={self.id} title='{self.title}' max_score={self.max_score} is_open={self.is_open}>"

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    round_id = Column(Integer, ForeignKey("review_rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="submissions")
    round = relationship("ReviewRound", back_populates="submissions")
    versions = relationship("SubmissionVersion", back_populates="submission", cascade="all, delete-orphan", order_by="SubmissionVersion.version_number")

    __table_args__ = (
        UniqueConstraint("project_id", "round_id", name="uq_project_round_submission"),
    )

    def __repr__(self):
        return f"<Submission id={self.id} project_id={self.project_id} round_id={self.round_id}>"

class SubmissionVersion(Base):
    __tablename__ = "submission_versions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_id = Column(Integer, ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, default=1, nullable=False)
    submitted_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String(50), default="DRAFT", nullable=False)  # "DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "REVISION_REQUESTED"
    notes = Column(Text, nullable=True)
    link = Column(Text, nullable=True)
    github_commit_sha = Column(String(100), nullable=True)
    is_late = Column(Boolean, default=False, nullable=False)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    roster_snapshot = Column(JSONType, default=list, nullable=False)  # [{user_id, full_name, email}]
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    submission = relationship("Submission", back_populates="versions")
    submitter = relationship("User")
    review = relationship("Review", back_populates="submission_version", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("submission_id", "version_number", name="uq_submission_version_num"),
    )

    def __repr__(self):
        return f"<SubmissionVersion id={self.id} submission_id={self.submission_id} v={self.version_number} status={self.status}>"

class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    submission_version_id = Column(Integer, ForeignKey("submission_versions.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    status = Column(String(50), default="NEW_SUBMISSION", nullable=False)  # "NEW_SUBMISSION", "IN_REVIEW", "COMPLETED", "REVISION_REQUESTED"
    feedback = Column(Text, nullable=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    submission_version = relationship("SubmissionVersion", back_populates="review")
    reviewer = relationship("User")
    result_entries = relationship("ResultEntry", back_populates="review", cascade="all, delete-orphan")

class ResultEntry(Base):
    __tablename__ = "result_entries"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    review_id = Column(Integer, ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    round_id = Column(Integer, ForeignKey("review_rounds.id", ondelete="CASCADE"), nullable=False, index=True)
    score = Column(Numeric(6, 2), nullable=False)
    is_released = Column(Boolean, default=False, nullable=False, index=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    review = relationship("Review", back_populates="result_entries")
    student = relationship("User")
    round = relationship("ReviewRound", back_populates="results")

    __table_args__ = (
        UniqueConstraint("review_id", "student_id", name="uq_review_student_result"),
        CheckConstraint("score >= 0", name="chk_result_score_non_negative"),
    )

    def __repr__(self):
        return f"<ResultEntry id={self.id} student_id={self.student_id} score={self.score} is_released={self.is_released}>"
