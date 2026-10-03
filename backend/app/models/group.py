from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.db.base import Base

# Association table for group members
group_members = Table(
    "group_members",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("joined_at", DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
)

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, index=True, nullable=False)
    leader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    workspace_code = Column(String(100), nullable=True)
    project_title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    leader = relationship("User", foreign_keys=[leader_id])
    members = relationship("User", secondary=group_members, backref="joined_groups")

    def __repr__(self):
        return f"<Group id={self.id} name='{self.name}' code='{self.code}' leader_id={self.leader_id}>"
