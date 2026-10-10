from datetime import datetime, timezone
from sqlalchemy import Column, Integer, BigInteger, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.types import JSON
from sqlalchemy.orm import relationship
from app.db.base import Base

JSONType = JSON().with_variant(JSONB, "postgresql")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer().with_variant(BigInteger, "postgresql"), primary_key=True, index=True, autoincrement=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    category = Column(String(50), default="SYSTEM", nullable=False, index=True)
    action_type = Column(String(100), nullable=False, index=True)
    action_name = Column(String(150), nullable=True)
    entity_type = Column(String(100), nullable=False, index=True)
    entity_id = Column(Integer, nullable=True, index=True)
    resource_type = Column(String(100), nullable=True, index=True)
    resource_name = Column(String(255), nullable=True)
    workspace_id = Column(String(100), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True, index=True)
    status = Column(String(20), default="SUCCESS", nullable=False, index=True)  # "SUCCESS" | "FAILURE"
    description = Column(Text, nullable=True)
    error_reason = Column(Text, nullable=True)
    old_value = Column(JSONType, nullable=True)
    new_value = Column(JSONType, nullable=True)
    ip_address = Column(String(50), nullable=True)
    request_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    actor = relationship("User")
    workspace = relationship("Workspace")

    def __repr__(self):
        return f"<AuditLog id={self.id} action={self.action_type} entity={self.entity_type}:{self.entity_id} workspace={self.workspace_id}>"

class AuditMerkleRoot(Base):
    __tablename__ = "audit_merkle_roots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    root_hash = Column(String(64), nullable=False)
    computed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    log_range_start = Column(BigInteger, nullable=False)
    log_range_end = Column(BigInteger, nullable=False)
