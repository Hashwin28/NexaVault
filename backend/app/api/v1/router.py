from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth,
    groups,
    workspaces,
    projects,
    submissions,
    results,
    reviews,
    search,
    audit,
    admin,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(groups.router, prefix="/groups", tags=["Groups"])
api_router.include_router(workspaces.router, prefix="/workspaces", tags=["Workspaces"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(submissions.router, tags=["Submissions"])
api_router.include_router(results.router, prefix="/results", tags=["Results"])
api_router.include_router(reviews.router, tags=["Reviews"])
api_router.include_router(search.router, tags=["Smart Search"])
api_router.include_router(audit.router, tags=["Audit Trail"])
api_router.include_router(admin.router, tags=["Administrator"])
