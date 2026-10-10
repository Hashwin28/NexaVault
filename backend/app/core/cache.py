import copy
import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Callable, Dict, List, Optional, Set

from app.core.config import settings

logger = logging.getLogger("nexavault.cache")


class CacheEntry:
    __slots__ = ("value", "expires_at", "created_at", "tags")

    def __init__(self, value: Any, expires_at: float, created_at: float, tags: Set[str]):
        self.value = value
        self.expires_at = expires_at
        self.created_at = created_at
        self.tags = tags

    def is_expired(self, now: float) -> bool:
        return now >= self.expires_at


class InMemoryCache:
    """
    Thread-safe, bounded, in-memory LRU cache with configurable TTL,
    tag-based targeted invalidation, and comprehensive telemetry.

    Compatible with FastAPI service layers and designed as an abstraction
    easily replaceable with Redis when horizontal scaling is required.
    """

    def __init__(
        self,
        max_entries: int = 2000,
        default_ttl: int = 300,
        enabled: bool = True,
    ):
        self._max_entries = max_entries
        self._default_ttl = default_ttl
        self._enabled = enabled
        self._lock = threading.RLock()
        self._key_locks: Dict[str, threading.Lock] = {}
        self._key_locks_mutex = threading.Lock()

        # Storage: OrderedDict maintains LRU order (most recently used at end)
        self._store: OrderedDict[str, CacheEntry] = OrderedDict()
        self._tag_to_keys: Dict[str, Set[str]] = {}

        # Telemetry
        self._hits = 0
        self._misses = 0
        self._sets = 0
        self._deletes = 0
        self._evictions = 0
        self._expirations = 0
        self._start_time = time.time()

    @property
    def enabled(self) -> bool:
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        self._enabled = value

    def get(self, key: str) -> Optional[Any]:
        """
        Retrieves a cached value by key.
        Returns a deep copy of the cached value to guarantee isolation.
        Returns None on miss or expiration.
        """
        if not self._enabled:
            return None

        now = time.monotonic()
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                self._misses += 1
                return None

            if entry.is_expired(now):
                self._expirations += 1
                self._misses += 1
                self._remove_entry_locked(key)
                return None

            # Hit: update LRU position
            self._store.move_to_end(key)
            self._hits += 1
            return copy.deepcopy(entry.value)

    def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
        tags: Optional[List[str]] = None,
    ) -> None:
        """
        Stores a value in the cache with an optional TTL and tagging.
        Stores an isolated deep copy to prevent mutation of cache state.
        Evicts LRU entries if capacity limit is reached.
        """
        if not self._enabled:
            return

        effective_ttl = float(ttl) if ttl is not None else float(self._default_ttl)
        now = time.monotonic()
        expires_at = now + max(0.001, effective_ttl)
        tag_set = set(tags) if tags else set()
        val_copy = copy.deepcopy(value)

        with self._lock:
            # If key already exists, clean up its old tag mappings
            if key in self._store:
                self._remove_from_tags_locked(key, self._store[key].tags)

            # Enforce bounded capacity
            if len(self._store) >= self._max_entries:
                self._evict_one_locked(now)

            entry = CacheEntry(
                value=val_copy,
                expires_at=expires_at,
                created_at=now,
                tags=tag_set,
            )
            self._store[key] = entry
            self._store.move_to_end(key)

            # Update tag index
            for tag in tag_set:
                if tag not in self._tag_to_keys:
                    self._tag_to_keys[tag] = set()
                self._tag_to_keys[tag].add(key)

            self._sets += 1

    def delete(self, key: str) -> bool:
        """Removes a single key from cache. Returns True if key existed."""
        with self._lock:
            if key in self._store:
                self._remove_entry_locked(key)
                self._deletes += 1
                return True
            return False

    def invalidate_tag(self, tag: str) -> int:
        """
        Invalidates all cache entries associated with a single tag.
        Returns the number of keys removed.
        """
        with self._lock:
            keys = self._tag_to_keys.get(tag)
            if not keys:
                return 0

            # Copy key set to iterate safely
            keys_to_remove = list(keys)
            count = 0
            for k in keys_to_remove:
                if k in self._store:
                    self._remove_entry_locked(k)
                    count += 1
            self._deletes += count
            return count

    def invalidate_tags(self, *tags: str) -> int:
        """Invalidates all entries matching any of the specified tags."""
        count = 0
        for tag in tags:
            count += self.invalidate_tag(tag)
        return count

    def invalidate_prefix(self, prefix: str) -> int:
        """
        Invalidates all cache keys that start with the given prefix string.
        Returns the number of keys removed.
        """
        with self._lock:
            matching_keys = [k for k in self._store if k.startswith(prefix)]
            count = 0
            for k in matching_keys:
                self._remove_entry_locked(k)
                count += 1
            self._deletes += count
            return count

    def clear(self) -> None:
        """Completely clears the cache and resets internal stores."""
        with self._lock:
            self._store.clear()
            self._tag_to_keys.clear()

    def get_or_set(
        self,
        key: str,
        fetch_fn: Callable[[], Any],
        ttl: Optional[int] = None,
        tags: Optional[List[str]] = None,
    ) -> Any:
        """
        Cache-aside read wrapper with stampede protection.
        Checks cache; if missed, acquires a key-specific lock to ensure only one
        thread executes fetch_fn, then sets cache and returns value.
        """
        if not self._enabled:
            return fetch_fn()

        cached = self.get(key)
        if cached is not None:
            return cached

        # Stampede mitigation: acquire or create key lock
        with self._key_locks_mutex:
            if key not in self._key_locks:
                self._key_locks[key] = threading.Lock()
            key_lock = self._key_locks[key]

        with key_lock:
            # Double-check cache inside lock
            cached = self.get(key)
            if cached is not None:
                return cached

            # Execute computation / database fetch
            value = fetch_fn()
            self.set(key, value, ttl=ttl, tags=tags)

        # Cleanup key lock if not needed
        with self._key_locks_mutex:
            if key in self._key_locks and not self._key_locks[key].locked():
                self._key_locks.pop(key, None)

        return value

    def stats(self) -> Dict[str, Any]:
        """Returns comprehensive telemetry statistics for the cache layer."""
        with self._lock:
            total_reqs = self._hits + self._misses
            hit_rate = (self._hits / total_reqs * 100.0) if total_reqs > 0 else 0.0
            return {
                "enabled": self._enabled,
                "current_size": len(self._store),
                "max_entries": self._max_entries,
                "hits": self._hits,
                "misses": self._misses,
                "total_requests": total_reqs,
                "hit_rate_pct": round(hit_rate, 2),
                "sets": self._sets,
                "deletes": self._deletes,
                "evictions": self._evictions,
                "expirations": self._expirations,
                "active_tags": len(self._tag_to_keys),
                "uptime_seconds": round(time.time() - self._start_time, 1),
            }

    # --- Internal helpers (must be called with self._lock held) ---

    def _remove_entry_locked(self, key: str) -> None:
        entry = self._store.pop(key, None)
        if entry:
            self._remove_from_tags_locked(key, entry.tags)

    def _remove_from_tags_locked(self, key: str, tags: Set[str]) -> None:
        for tag in tags:
            if tag in self._tag_to_keys:
                self._tag_to_keys[tag].discard(key)
                if not self._tag_to_keys[tag]:
                    del self._tag_to_keys[tag]

    def _evict_one_locked(self, now: float) -> None:
        # First priority: find and purge an already expired entry
        for k, entry in list(self._store.items()):
            if entry.is_expired(now):
                self._expirations += 1
                self._remove_entry_locked(k)
                return

        # Second priority: pop LRU (the oldest entry in OrderedDict)
        oldest_key, _ = self._store.popitem(last=False)
        self._evictions += 1
        if oldest_key in self._store:
            self._remove_entry_locked(oldest_key)


# Global Cache Instance
cache = InMemoryCache(
    max_entries=settings.CACHE_MAX_ENTRIES,
    default_ttl=settings.CACHE_DEFAULT_TTL,
    enabled=settings.CACHE_ENABLED,
)


# --- Scope-Safe Cache Key Generators & Invalidation Helpers ---

def key_ws_list_staff(user_id: int) -> str:
    return f"ws:list:staff:u{user_id}"

def key_ws_list_student(user_id: int, group_id: Optional[int]) -> str:
    gid = group_id if group_id is not None else "none"
    return f"ws:list:student:u{user_id}:g{gid}"

def key_ws_detail_staff(workspace_id: str, user_id: int) -> str:
    return f"ws:detail:staff:{workspace_id}:u{user_id}"

def key_ws_detail_student(workspace_id: str, user_id: int, group_id: Optional[int]) -> str:
    gid = group_id if group_id is not None else "none"
    return f"ws:detail:student:{workspace_id}:u{user_id}:g{gid}"

def key_ws_groups(workspace_id: str) -> str:
    return f"ws:groups:{workspace_id}"

def key_ws_projects(workspace_id: str) -> str:
    return f"ws:projects:{workspace_id}"

def key_ws_rounds(workspace_id: str) -> str:
    return f"ws:rounds:{workspace_id}"

def key_ws_notices(workspace_id: str) -> str:
    return f"ws:notices:{workspace_id}"

def key_group_detail(group_id: int) -> str:
    return f"group:detail:g{group_id}"

def key_group_me(user_id: int) -> str:
    return f"group:me:u{user_id}"

def key_project_detail(project_id: int) -> str:
    return f"project:detail:p{project_id}"

def key_project_progress(project_id: int) -> str:
    return f"project:progress:p{project_id}"

def key_project_updates(project_id: int) -> str:
    return f"project:updates:p{project_id}"

def key_project_github(project_id: int) -> str:
    return f"project:github:p{project_id}"

def key_project_submissions(project_id: int) -> str:
    return f"project:submissions:p{project_id}"

def key_results_me(student_id: int) -> str:
    return f"results:me:u{student_id}"

def key_review_queue(staff_id: int, limit: int, offset: int) -> str:
    return f"review:queue:u{staff_id}:l{limit}:o{offset}"


# Invalidation Helpers
def invalidate_workspace(workspace_id: str) -> None:
    """Invalidates all cached queries related to a given workspace."""
    cache.invalidate_tags(f"workspace:{workspace_id}")
    # Also invalidate workspace lists
    cache.invalidate_prefix("ws:list:")

def invalidate_group(group_id: int) -> None:
    """Invalidates all cached queries related to a group."""
    cache.invalidate_tags(f"group:{group_id}")
    cache.invalidate_prefix(f"group:detail:g{group_id}")
    cache.invalidate_prefix("ws:list:")

def invalidate_user(user_id: int) -> None:
    """Invalidates user-specific cached queries."""
    cache.invalidate_tags(f"user:{user_id}")
    cache.invalidate_prefix(f"group:me:u{user_id}")
    cache.invalidate_prefix(f"ws:list:staff:u{user_id}")
    cache.invalidate_prefix(f"ws:list:student:u{user_id}")
    cache.invalidate_prefix(f"results:me:u{user_id}")

def invalidate_project(project_id: int, workspace_id: Optional[str] = None) -> None:
    """Invalidates project details, progress, updates, and submissions."""
    cache.invalidate_tags(f"project:{project_id}")
    cache.invalidate_prefix(f"project:detail:p{project_id}")
    cache.invalidate_prefix(f"project:progress:p{project_id}")
    cache.invalidate_prefix(f"project:updates:p{project_id}")
    cache.invalidate_prefix(f"project:github:p{project_id}")
    cache.invalidate_prefix(f"project:submissions:p{project_id}")
    if workspace_id:
        cache.invalidate_tag(f"workspace:{workspace_id}:projects")

def invalidate_rounds(workspace_id: str) -> None:
    """Invalidates review rounds and project progress calculations for a workspace."""
    cache.invalidate_tag(f"workspace:{workspace_id}:rounds")
    cache.invalidate_tag(f"workspace:{workspace_id}")
    cache.invalidate_prefix("project:progress:")

def invalidate_notices(workspace_id: str) -> None:
    """Invalidates notice board and student views for a workspace."""
    cache.invalidate_tag(f"workspace:{workspace_id}:notices")
    cache.invalidate_tag(f"workspace:{workspace_id}")
    cache.invalidate_prefix("ws:list:student:")
    cache.invalidate_prefix(f"ws:detail:student:{workspace_id}")

def invalidate_results(student_id: Optional[int] = None) -> None:
    """Invalidates student results summary."""
    if student_id:
        cache.invalidate_prefix(f"results:me:u{student_id}")
    else:
        cache.invalidate_prefix("results:me:")
