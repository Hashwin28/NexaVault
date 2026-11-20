from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import decode_access_token
from app.models.user import User

# OAuth2 scheme point for FastAPI docs / header extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

def get_db() -> Generator:
    """Provides a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    """Extracts and verifies current user from Bearer token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if not payload:
        raise credentials_exception

    user_email: str = payload.get("sub")
    if not user_email:
        raise credentials_exception

    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user account"
        )

    # Security check: if role claim is present in token, ensure it matches current DB role
    token_role = payload.get("role")
    if token_role and token_role.lower() != user.role.lower():
        raise credentials_exception

    return user

def get_optional_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> Optional[User]:
    """Extracts user from Bearer token if present, returns None if not present or invalid."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        user_email: str = payload.get("sub")
        if not user_email:
            return None
        user = db.query(User).filter(User.email == user_email).first()
        if not user or not user.is_active:
            return None
        token_role = payload.get("role")
        if token_role and token_role.lower() != user.role.lower():
            return None
        return user
    except Exception:
        return None

def get_current_student(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user has the 'student' role."""
    if current_user.role.lower() != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Student role required."
        )
    return current_user

def get_current_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user has the 'staff' role."""
    if current_user.role.lower() not in ["staff", "teacher"]:
        try:
            from app.services.audit_service import log_audit_event
            log_audit_event(
                db=db,
                action_type="ACCESS_DENIED",
                category="SECURITY",
                status="FAILURE",
                actor_id=current_user.id,
                resource_type="endpoint",
                resource_name="Staff Endpoint",
                description=f"Unauthorized staff area access attempt by {current_user.email} (role: {current_user.role})",
                error_reason="Access forbidden: Staff role required.",
                metadata={"user_role": current_user.role, "email": current_user.email}
            )
            db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Staff role required."
        )
    return current_user

def get_current_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies that the authenticated user has the 'administrator' role."""
    if current_user.role.lower() != "administrator":
        try:
            from app.services.audit_service import log_audit_event
            log_audit_event(
                db=db,
                action_type="ACCESS_DENIED",
                category="SECURITY",
                status="FAILURE",
                actor_id=current_user.id,
                resource_type="endpoint",
                resource_name="Admin Endpoint",
                description=f"Unauthorized admin area access attempt by {current_user.email} (role: {current_user.role})",
                error_reason="Access forbidden: Administrator role required.",
            )
            db.commit()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Administrator role required."
        )
    return current_user
