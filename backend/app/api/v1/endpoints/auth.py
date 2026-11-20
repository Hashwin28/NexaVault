from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token
from app.services.audit_service import log_audit

router = APIRouter()

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register_student(user_in: UserCreate, request: Request, db: Session = Depends(get_db)):
    """
    Public student registration endpoint.
    PUBLIC REGISTRATION = STUDENT ONLY.
    Staff and Administrator accounts cannot self-register through this endpoint.
    """
    email_clean = user_in.email.lower().strip()
    
    # Check if email is already registered
    existing_user = db.query(User).filter(User.email == email_clean).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    # Force role to student for public registration
    db_user = User(
        email=email_clean,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name.strip(),
        role="student",
        is_active=True
    )
    db.add(db_user)
    db.flush()

    # Log audit entry in the same transaction
    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=db_user.id,
        action_type="USER_REGISTERED",
        entity_type="USER",
        entity_id=db_user.id,
        new_value={"email": db_user.email, "role": db_user.role, "full_name": db_user.full_name},
        ip_address=client_ip
    )
    
    db.commit()
    db.refresh(db_user)

    # Generate JWT access token with user role and metadata
    access_token = create_access_token(
        subject=db_user.email,
        role=db_user.role,
        extra_claims={
            "id": db_user.id,
            "department": db_user.department,
            "full_name": db_user.full_name,
        }
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(db_user)
    )

@router.post("/login", response_model=Token)
def login_user(credentials: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticates a user and returns a signed JWT token containing role and profile claims."""
    email_clean = credentials.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()

    client_ip = request.client.host if request.client else None

    if not user or not verify_password(credentials.password, user.hashed_password):
        log_audit(
            db=db,
            actor_id=user.id if user else None,
            action_type="USER_LOGIN_FAILED",
            category="SECURITY",
            status="FAILURE",
            entity_type="USER",
            resource_type="USER",
            resource_name=email_clean,
            description=f"Failed login attempt for {email_clean}",
            entity_id=user.id if user else None,
            error_reason="Invalid email or password",
            new_value={"attempted_email": email_clean},
            ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The email or password you entered is incorrect. Please try again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        log_audit(
            db=db,
            actor_id=user.id,
            action_type="USER_LOGIN_FAILED",
            entity_type="USER",
            entity_id=user.id,
            status="FAILURE",
            error_reason="User account is inactive",
            new_value={"email": email_clean},
            ip_address=client_ip,
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your user account is inactive. Please contact support."
        )

    log_audit(
        db=db,
        actor_id=user.id,
        action_type="USER_LOGIN_SUCCESS",
        entity_type="USER",
        entity_id=user.id,
        status="SUCCESS",
        new_value={"email": user.email, "role": user.role},
        ip_address=client_ip,
    )
    db.commit()

    access_token = create_access_token(
        subject=user.email,
        role=user.role,
        extra_claims={
            "id": user.id,
            "department": user.department,
            "full_name": user.full_name,
        }
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.model_validate(user)
    )

@router.get("/me", response_model=UserResponse)
def get_authenticated_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the profile of the currently authenticated user."""
    return current_user
