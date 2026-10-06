from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.base import Base

class GithubLink(Base):
    __tablename__ = "github_links"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    repo_url = Column(String(512), nullable=False)
    linked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="github_link")
    user = relationship("User")
    commits = relationship("GithubCommit", back_populates="github_link", cascade="all, delete-orphan", order_by="desc(GithubCommit.committed_at)")

class GithubCommit(Base):
    __tablename__ = "github_commits"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    github_link_id = Column(Integer, ForeignKey("github_links.id", ondelete="CASCADE"), nullable=False, index=True)
    commit_sha = Column(String(100), nullable=False, index=True)
    commit_message = Column(Text, nullable=False)
    author_name = Column(String(255), nullable=False)
    committed_at = Column(DateTime(timezone=True), nullable=False)

    github_link = relationship("GithubLink", back_populates="commits")
