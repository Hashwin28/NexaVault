from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class GithubCommitResponse(BaseModel):
    commit_sha: str
    commit_message: str
    author_name: str
    committed_at: datetime

    model_config = ConfigDict(from_attributes=True)

class GithubLinkCreate(BaseModel):
    repo_url: str

class GithubLinkResponse(BaseModel):
    id: int
    project_id: int
    repo_url: str
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    commits: List[GithubCommitResponse] = []

    model_config = ConfigDict(from_attributes=True)
