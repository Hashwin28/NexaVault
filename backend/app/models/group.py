from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    creator = relationship("User", foreign_keys=[created_by])
    memberships = relationship("GroupMembership", back_populates="group", cascade="all, delete-orphan")
    enrolled_workspaces = relationship("WorkspaceGroup", back_populates="group", cascade="all, delete-orphan")
    projects = relationship("Project", back_populates="group", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Group id={self.id} name='{self.name}' code='{self.code}' is_deleted={self.is_deleted}>"

class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    joined_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    group = relationship("Group", back_populates="memberships")
    user = relationship("User", back_populates="membership")

    __table_args__ = (
        UniqueConstraint("user_id", name="uq_user_single_active_group"),
    )

    def __repr__(self):
        return f"<GroupMembership group_id={self.group_id} user_id={self.user_id}>"
