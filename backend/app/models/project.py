"""
Project and Progress Updates Data Models Module.

Defines SQLAlchemy entities for workspace projects, milestone updates,
author attribution, and collaborative comments on updates.
"""

from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class Project(Base):
    """
    Project entity associating student groups with workspaces, submissions, and GitHub repositories.
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="projects")
    group = relationship("Group", back_populates="projects")
    creator = relationship("User")
    updates = relationship("ProjectUpdate", back_populates="project", cascade="all, delete-orphan", order_by="desc(ProjectUpdate.created_at)")
    submissions = relationship("Submission", back_populates="project", cascade="all, delete-orphan")
    github_link = relationship("GithubLink", back_populates="project", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("workspace_id", "group_id", name="uq_workspace_group_project"),
    )

    def __repr__(self):
        return f"<Project id={self.id} name='{self.name}' workspace_id='{self.workspace_id}' group_id={self.group_id}>"

class ProjectUpdate(Base):
    __tablename__ = "project_updates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    link = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    project = relationship("Project", back_populates="updates")
    author = relationship("User")
    comments = relationship("UpdateComment", back_populates="update", cascade="all, delete-orphan", order_by="UpdateComment.created_at")

    def __repr__(self):
        return f"<ProjectUpdate id={self.id} project_id={self.project_id} author_id={self.author_id}>"

class UpdateComment(Base):
    __tablename__ = "update_comments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    update_id = Column(Integer, ForeignKey("project_updates.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    update = relationship("ProjectUpdate", back_populates="comments")
    author = relationship("User")

    def __repr__(self):
        return f"<UpdateComment id={self.id} update_id={self.update_id} author_id={self.author_id}>"
