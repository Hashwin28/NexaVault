from fastapi import APIRouter
from app.api.v1.endpoints import auth, student, groups

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(student.router, prefix="/student", tags=["student-auth"])
api_router.include_router(groups.router, prefix="/groups", tags=["groups"])
