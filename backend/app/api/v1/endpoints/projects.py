import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
import httpx
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, get_current_student
from app.models.user import User
from app.models.project import Project, ProjectUpdate, UpdateComment
from app.models.group import GroupMembership
from app.models.github import GithubLink, GithubCommit
from app.schemas.project import (
    ProjectCreate,
    ProjectResponse,
    ProjectMemberInfo,
    ProjectUpdateCreate,
    ProjectUpdateResponse,
    UpdateCommentCreate,
    UpdateCommentResponse,
)
from app.schemas.github import (
    GithubLinkCreate,
    GithubLinkResponse,
    GithubCommitResponse,
)
from app.core.permissions import (
    can_access_project,
    can_create_project,
    is_user_group_member,
    can_access_workspace,
)
from app.services.audit_service import log_audit
from app.core.cache import (
    cache,
    key_project_detail,
    key_project_updates,
    key_project_github,
    invalidate_project,
    invalidate_workspace,
    invalidate_group,
)

router = APIRouter()

from app.services.project_service import calculate_project_progress

def build_project_response(project: Project, db: Session) -> ProjectResponse:
    """Builds a ProjectResponse with derived group members list and progress percentage."""
    memberships = (
        db.query(GroupMembership)
        .filter(GroupMembership.group_id == project.group_id)
        .order_by(GroupMembership.joined_at.asc())
        .all()
    )
    members_list = [
        ProjectMemberInfo(
            id=m.user.id,
            full_name=m.user.full_name,
            email=m.user.email
        )
        for m in memberships if m.user
    ]

    github_url = project.github_link.repo_url if project.github_link else None
    prog_pct = calculate_project_progress(db, project.id)

    return ProjectResponse(
        id=project.id,
        workspace_id=project.workspace_id,
        workspace_name=project.workspace.name if project.workspace else project.workspace_id,
        group_id=project.group_id,
        group_name=project.group.name if project.group else f"Group #{project.group_id}",
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        members=members_list,
        github_repo_url=github_url,
        progress_percentage=prog_pct,
    )

@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    project_in: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Create a project for the student's group in a specified workspace.
    - Group must have >= 2 members.
    - Group must be actively enrolled in the workspace.
    - A group can only have ONE project per workspace.
    """
    allowed, reason, group = can_create_project(db, current_student.id, project_in.workspace_id.strip())
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason or "Project creation disallowed."
        )

    new_project = Project(
        workspace_id=project_in.workspace_id.strip(),
        group_id=group.id,
        name=project_in.name.strip(),
        description=project_in.description.strip() if project_in.description else None,
        created_by=current_student.id
    )
    db.add(new_project)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="PROJECT_CREATED",
        entity_type="PROJECT",
        entity_id=new_project.id,
        workspace_id=new_project.workspace_id,
        new_value={"name": new_project.name, "workspace_id": new_project.workspace_id, "group_id": new_project.group_id},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(new_project)
    invalidate_workspace(new_project.workspace_id)
    invalidate_group(group.id)
    cache.invalidate_prefix("ws:list:")

    return build_project_response(new_project, db)

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project_details(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get project details.
    Access is strictly derived from current group membership.
    If a student left the group, 404 is returned immediately.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not can_access_project(db, current_user.id, project):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    c_key = key_project_detail(project_id)
    cached = cache.get(c_key)
    if cached is not None:
        return ProjectResponse(**cached)

    res = build_project_response(project, db)
    cache.set(c_key, res.model_dump(), ttl=120, tags=[f"project:{project_id}", f"workspace:{project.workspace_id}"])
    return res

@router.get("/{project_id}/updates", response_model=List[ProjectUpdateResponse])
def list_project_updates(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all informal updates and comments for a project.
    Accessible to current project members and workspace staff.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not can_access_project(db, current_user.id, project):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    c_key = key_project_updates(project_id)
    cached = cache.get(c_key)
    if cached is not None:
        return [ProjectUpdateResponse(**x) for x in cached]

    updates = (
        db.query(ProjectUpdate)
        .filter(ProjectUpdate.project_id == project.id)
        .order_by(ProjectUpdate.created_at.desc())
        .all()
    )

    results = []
    for u in updates:
        comment_responses = [
            UpdateCommentResponse(
                id=c.id,
                update_id=c.update_id,
                author_id=c.author_id,
                author_name=c.author.full_name if c.author else "Unknown",
                author_role=c.author.role if c.author else "student",
                content=c.content,
                created_at=c.created_at
            )
            for c in u.comments
        ]
        results.append(
            ProjectUpdateResponse(
                id=u.id,
                project_id=u.project_id,
                author_id=u.author_id,
                author_name=u.author.full_name if u.author else "Unknown",
                content=u.content,
                link=u.link,
                created_at=u.created_at,
                comments=comment_responses
            )
        )

    cache.set(c_key, [r.model_dump() for r in results], ttl=120, tags=[f"project:{project_id}:updates", f"project:{project_id}"])
    return results

@router.post("/{project_id}/updates", response_model=ProjectUpdateResponse, status_code=status.HTTP_201_CREATED)
def post_project_update(
    project_id: int,
    update_in: ProjectUpdateCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Post an informal progress update for the project.
    Restricted to current group members of the project.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not is_user_group_member(db, current_student.id, project.group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    new_update = ProjectUpdate(
        project_id=project.id,
        author_id=current_student.id,
        content=update_in.content.strip(),
        link=update_in.link.strip() if update_in.link else None
    )
    db.add(new_update)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="UPDATE_POSTED",
        entity_type="PROJECT_UPDATE",
        entity_id=new_update.id,
        new_value={"project_id": project.id, "content_snippet": new_update.content[:50]},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(new_update)
    cache.invalidate_tag(f"project:{project_id}:updates")

    return ProjectUpdateResponse(
        id=new_update.id,
        project_id=new_update.project_id,
        author_id=new_update.author_id,
        author_name=current_student.full_name,
        content=new_update.content,
        link=new_update.link,
        created_at=new_update.created_at,
        comments=[]
    )

@router.post("/{project_id}/updates/{update_id}/comments", response_model=UpdateCommentResponse, status_code=status.HTTP_201_CREATED)
def post_update_comment(
    project_id: int,
    update_id: int,
    comment_in: UpdateCommentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Post a comment on a project update.
    Allowed for current group members and workspace staff.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not can_access_project(db, current_user.id, project):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    update_obj = db.query(ProjectUpdate).filter(ProjectUpdate.id == update_id, ProjectUpdate.project_id == project.id).first()
    if not update_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Update not found."
        )

    comment = UpdateComment(
        update_id=update_obj.id,
        author_id=current_user.id,
        content=comment_in.content.strip()
    )
    db.add(comment)
    db.flush()

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_user.id,
        action_type="COMMENT_POSTED",
        entity_type="UPDATE_COMMENT",
        entity_id=comment.id,
        new_value={"update_id": update_obj.id, "project_id": project.id},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(comment)
    cache.invalidate_tag(f"project:{project_id}:updates")

    return UpdateCommentResponse(
        id=comment.id,
        update_id=comment.update_id,
        author_id=comment.author_id,
        author_name=current_user.full_name,
        author_role=current_user.role,
        content=comment.content,
        created_at=comment.created_at
    )

def parse_repo_owner_and_name(repo_url: str):
    if not repo_url:
        return None, None
    clean = re.sub(r"^https?://", "", repo_url.strip())
    clean = re.sub(r"^www\.", "", clean)
    clean = re.sub(r"^github\.com/", "", clean)
    clean = re.sub(r"\.git$", "", clean).strip("/")
    parts = clean.split("/")
    if len(parts) >= 2:
        return parts[0], parts[1]
    return None, None

def sync_github_commits_from_api(link_obj: GithubLink, db: Session) -> None:
    """Fetch live commits from public GitHub repository and store them in database."""
    owner, repo = parse_repo_owner_and_name(link_obj.repo_url)
    if not owner or not repo:
        return

    api_url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page=15"
    headers = {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "NexaVault-Academic-Sync/1.0"
    }
    try:
        with httpx.Client(timeout=4.0) as client:
            resp = client.get(api_url, headers=headers)
            if resp.status_code == 200:
                commits_data = resp.json()
                if isinstance(commits_data, list):
                    db.query(GithubCommit).filter(GithubCommit.github_link_id == link_obj.id).delete()
                    for item in commits_data:
                        sha = item.get("sha")
                        commit_info = item.get("commit", {})
                        msg = commit_info.get("message", "Commit")
                        author_info = commit_info.get("author", {})
                        author_name = author_info.get("name") or (item.get("author") or {}).get("login") or "Contributor"
                        date_str = author_info.get("date")
                        if date_str:
                            try:
                                committed_at = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                            except Exception:
                                committed_at = datetime.now(timezone.utc)
                        else:
                            committed_at = datetime.now(timezone.utc)

                        if sha:
                            c_obj = GithubCommit(
                                github_link_id=link_obj.id,
                                commit_sha=sha[:40],
                                commit_message=msg[:500],
                                author_name=author_name[:255],
                                committed_at=committed_at
                            )
                            db.add(c_obj)

                    link_obj.last_synced_at = datetime.now(timezone.utc)
                    db.flush()
    except Exception:
        # Graceful fallback on network/rate-limit
        pass

@router.get("/{project_id}/github", response_model=Optional[GithubLinkResponse])
def get_project_github_info(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """View linked GitHub repository details for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not can_access_project(db, current_user.id, project):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    c_key = key_project_github(project_id)
    cached = cache.get(c_key)
    if cached is not None:
        return GithubLinkResponse(**cached) if cached else None

    link = db.query(GithubLink).filter(GithubLink.project_id == project.id).first()
    if not link:
        cache.set(c_key, None, ttl=180, tags=[f"project:{project_id}:github", f"project:{project_id}"])
        return None

    # Auto-sync once if commits have never been populated
    if not link.commits and not link.last_synced_at:
        sync_github_commits_from_api(link, db)
        db.commit()
        db.refresh(link)

    commits = [
        GithubCommitResponse(
            commit_sha=c.commit_sha,
            commit_message=c.commit_message,
            author_name=c.author_name,
            committed_at=c.committed_at
        )
        for c in link.commits
    ]

    res = GithubLinkResponse(
        id=link.id,
        project_id=link.project_id,
        repo_url=link.repo_url,
        last_synced_at=link.last_synced_at,
        created_at=link.created_at,
        commits=commits
    )
    cache.set(c_key, res.model_dump(), ttl=180, tags=[f"project:{project_id}:github", f"project:{project_id}"])
    return res

@router.post("/{project_id}/github", response_model=GithubLinkResponse)
def link_project_github_repo(
    project_id: int,
    github_in: GithubLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Link a public GitHub repository to the project and sync initial commits.
    Restricted to current group members.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not is_user_group_member(db, current_student.id, project.group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    clean_url = github_in.repo_url.strip()
    existing_link = db.query(GithubLink).filter(GithubLink.project_id == project.id).first()
    if existing_link:
        existing_link.repo_url = clean_url
        link_obj = existing_link
    else:
        link_obj = GithubLink(
            project_id=project.id,
            repo_url=clean_url,
            linked_by=current_student.id
        )
        db.add(link_obj)

    db.flush()
    sync_github_commits_from_api(link_obj, db)

    client_ip = request.client.host if request.client else None
    log_audit(
        db=db,
        actor_id=current_student.id,
        action_type="GITHUB_LINKED",
        entity_type="PROJECT",
        entity_id=project.id,
        new_value={"repo_url": clean_url},
        ip_address=client_ip
    )

    db.commit()
    db.refresh(link_obj)
    invalidate_project(project_id, project.workspace_id)

    commits = [
        GithubCommitResponse(
            commit_sha=c.commit_sha,
            commit_message=c.commit_message,
            author_name=c.author_name,
            committed_at=c.committed_at
        )
        for c in link_obj.commits
    ]

    return GithubLinkResponse(
        id=link_obj.id,
        project_id=link_obj.project_id,
        repo_url=link_obj.repo_url,
        last_synced_at=link_obj.last_synced_at,
        created_at=link_obj.created_at,
        commits=commits
    )

@router.post("/{project_id}/github/sync", response_model=GithubLinkResponse)
def sync_project_github_repo(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually sync commits for the linked GitHub repository.
    Allowed for group members and workspace staff.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not can_access_project(db, current_user.id, project):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    link = db.query(GithubLink).filter(GithubLink.project_id == project.id).first()
    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No GitHub repository linked to this project."
        )

    sync_github_commits_from_api(link, db)
    db.commit()
    db.refresh(link)
    invalidate_project(project_id, project.workspace_id)

    commits = [
        GithubCommitResponse(
            commit_sha=c.commit_sha,
            commit_message=c.commit_message,
            author_name=c.author_name,
            committed_at=c.committed_at
        )
        for c in link.commits
    ]

    return GithubLinkResponse(
        id=link.id,
        project_id=link.project_id,
        repo_url=link.repo_url,
        last_synced_at=link.last_synced_at,
        created_at=link.created_at,
        commits=commits
    )

@router.delete("/{project_id}/github", status_code=status.HTTP_200_OK)
def unlink_project_github_repo(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_student: User = Depends(get_current_student)
):
    """
    Disconnect linked GitHub repository from the project.
    Restricted to current group members.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not is_user_group_member(db, current_student.id, project.group_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied."
        )

    link = db.query(GithubLink).filter(GithubLink.project_id == project.id).first()
    if link:
        db.delete(link)
        db.commit()
        invalidate_project(project_id, project.workspace_id)

        client_ip = request.client.host if request.client else None
        log_audit(
            db=db,
            actor_id=current_student.id,
            action_type="GITHUB_UNLINKED",
            entity_type="PROJECT",
            entity_id=project.id,
            new_value=None,
            ip_address=client_ip
        )
    return {"message": "GitHub repository disconnected successfully."}

