from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String(100), primary_key=True, index=True)  # Workspace Enrollment ID (e.g. "CS204-DSA")
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    term = Column(String(100), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    is_open = Column(Boolean, default=True, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    owner = relationship("User", foreign_keys=[owner_id])
    staff_members = relationship("WorkspaceStaff", back_populates="workspace", cascade="all, delete-orphan")
    staff_requests = relationship("WorkspaceStaffRequest", back_populates="workspace", cascade="all, delete-orphan")
    enrolled_groups = relationship("WorkspaceGroup", back_populates="workspace", cascade="all, delete-orphan")
    notices = relationship("WorkspaceNotice", back_populates="workspace", cascade="all, delete-orphan")
    review_rounds = relationship("ReviewRound", back_populates="workspace", cascade="all, delete-orphan", order_by="ReviewRound.order_index")
    projects = relationship("Project", back_populates="workspace", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Workspace id='{self.id}' name='{self.name}' is_open={self.is_open}>"

class WorkspaceStaff(Base):
    __tablename__ = "workspace_staff"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(50), default="costaff", nullable=False)  # "owner" | "costaff"
    assigned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    workspace = relationship("Workspace", back_populates="staff_members")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("workspace_id", "user_id", name="uq_workspace_staff"),
    )

class WorkspaceStaffRequest(Base):
    __tablename__ = "workspace_staff_requests"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    requester_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False)  # "pending" | "approved" | "rejected"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    workspace = relationship("Workspace", back_populates="staff_requests")
    requester = relationship("User")

    __table_args__ = (
        UniqueConstraint("workspace_id", "requester_id", name="uq_workspace_staff_request"),
    )

class WorkspaceGroup(Base):
    __tablename__ = "workspace_groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    enrolled_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    enrolled_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    workspace = relationship("Workspace", back_populates="enrolled_groups")
    group = relationship("Group", back_populates="enrolled_workspaces")
    enrolled_by_user = relationship("User")

    __table_args__ = (
        UniqueConstraint("workspace_id", "group_id", name="uq_workspace_group_enrollment"),
    )

class WorkspaceNotice(Base):
    __tablename__ = "workspace_notices"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    image_url = Column(Text, nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    workspace = relationship("Workspace", back_populates="notices")
    author = relationship("User")
