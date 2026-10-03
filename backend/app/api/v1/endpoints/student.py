from fastapi import APIRouter, Depends
from app.api.deps import get_current_student
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter()

@router.get("/me", response_model=UserResponse)
def get_authenticated_student_profile(
    current_student: User = Depends(get_current_student)
):
    """
    Returns the authenticated student's profile.
    Requires a valid JWT bearer token belonging to a user with the 'student' role.
    Raises 403 Forbidden if accessed by a teacher or unprivileged account.
    """
    return current_student
