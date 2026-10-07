from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class SearchResultItem(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    type: str  # "workspace" | "group" | "project" | "submission" | "student"
    workspace_id: Optional[str] = None

class SmartSearchResponse(BaseModel):
    query: str
    workspaces: List[Dict[str, Any]] = []
    groups: List[Dict[str, Any]] = []
    projects: List[Dict[str, Any]] = []
    submissions: List[Dict[str, Any]] = []
    students: List[Dict[str, Any]] = []
