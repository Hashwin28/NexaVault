import time
import threading
from concurrent.futures import ThreadPoolExecutor
import pytest
from app.core.cache import (
    InMemoryCache,
    cache,
    key_ws_detail_student,
    key_group_detail,
    key_project_detail,
    key_results_me,
    invalidate_workspace,
    invalidate_group,
    invalidate_project,
    invalidate_user,
)


def test_cache_get_set_delete():
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=100)
    c.set("k1", {"foo": "bar", "num": 42})
    
    val = c.get("k1")
    assert val == {"foo": "bar", "num": 42}
    
    # Test deepcopy isolation: mutating val must not affect cache store
    val["foo"] = "tampered"
    assert c.get("k1")["foo"] == "bar"

    # Test delete
    assert c.delete("k1") is True
    assert c.get("k1") is None
    assert c.delete("k1") is False


def test_cache_ttl_expiration():
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=100)
    c.set("short_lived", "alive", ttl=0.05)
    
    assert c.get("short_lived") == "alive"
    time.sleep(0.08)
    # Expired
    assert c.get("short_lived") is None
    stats = c.stats()
    assert stats["expirations"] >= 1


def test_cache_bounded_lru_eviction():
    # Capacity = 3 entries
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=3)
    c.set("a", 1)
    c.set("b", 2)
    c.set("c", 3)
    
    # Access "a" to make it more recently used: order is now b, c, a
    assert c.get("a") == 1
    
    # Insert "d", which should evict "b" (the least recently used)
    c.set("d", 4)
    assert c.get("b") is None
    assert c.get("a") == 1
    assert c.get("c") == 3
    assert c.get("d") == 4
    assert c.stats()["evictions"] == 1


def test_cache_tag_invalidation():
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=100)
    c.set("ws:1:details", {"name": "WS1"}, tags=["workspace:1"])
    c.set("ws:1:groups", [{"id": 1}], tags=["workspace:1", "groups"])
    c.set("ws:2:details", {"name": "WS2"}, tags=["workspace:2"])

    assert c.get("ws:1:details") is not None
    assert c.get("ws:1:groups") is not None
    assert c.get("ws:2:details") is not None

    # Invalidate tag workspace:1
    invalidated_count = c.invalidate_tag("workspace:1")
    assert invalidated_count == 2
    assert c.get("ws:1:details") is None
    assert c.get("ws:1:groups") is None
    # Workspace 2 must be completely unaffected
    assert c.get("ws:2:details") is not None


def test_cache_prefix_invalidation():
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=100)
    c.set("review:queue:u1:l10:o0", [1, 2])
    c.set("review:queue:u2:l10:o0", [3, 4])
    c.set("project:detail:p10", {"title": "P10"})

    c.invalidate_prefix("review:queue:")
    assert c.get("review:queue:u1:l10:o0") is None
    assert c.get("review:queue:u2:l10:o0") is None
    assert c.get("project:detail:p10") is not None


def test_cache_concurrency_safety():
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=500)
    num_threads = 30
    ops_per_thread = 50

    def worker(tid: int):
        for i in range(ops_per_thread):
            key = f"thread_key_{i % 10}"
            c.set(key, {"tid": tid, "i": i}, tags=[f"mod:{i % 3}"])
            val = c.get(key)
            if i % 7 == 0:
                c.invalidate_tag(f"mod:{i % 3}")
            if i % 11 == 0:
                c.delete(key)

    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(worker, tid) for tid in range(num_threads)]
        for f in futures:
            f.result()

    stats = c.stats()
    assert stats["hits"] + stats["misses"] > 0
    assert stats["current_size"] <= 500


def test_cache_stampede_protection():
    c = InMemoryCache(enabled=True, default_ttl=60, max_entries=100)
    call_count = 0
    lock = threading.Lock()

    def expensive_fetch():
        nonlocal call_count
        with lock:
            call_count += 1
        time.sleep(0.04)  # Simulate slow DB/computation
        return {"data": 999}

    results = []

    def caller():
        res = c.get_or_set("heavy_metric", expensive_fetch, ttl=60)
        results.append(res)

    threads = [threading.Thread(target=caller) for _ in range(15)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # All callers received the same result
    assert len(results) == 15
    for r in results:
        assert r == {"data": 999}
    # expensive_fetch must only have been invoked ONCE despite 15 concurrent requests!
    assert call_count == 1


def test_scope_isolation():
    # User A in Workspace 1 should never collide with User B or Workspace 2
    key_u1 = key_ws_detail_student("ws-100", user_id=1, group_id=10)
    key_u2 = key_ws_detail_student("ws-100", user_id=2, group_id=10)
    key_ws2 = key_ws_detail_student("ws-200", user_id=1, group_id=10)

    assert key_u1 != key_u2
    assert key_u1 != key_ws2

    # Group me key isolation
    key_g1 = key_group_detail(group_id=1)
    key_g2 = key_group_detail(group_id=2)
    assert key_g1 != key_g2

    # Results student key isolation
    key_r1 = key_results_me(student_id=5)
    key_r2 = key_results_me(student_id=6)
    assert key_r1 != key_r2


def test_invalidation_helpers():
    cache.clear()
    
    # Setup data
    cache.set(key_project_detail(1), {"id": 1, "name": "P1"}, tags=["project:1", "workspace:ws1"])
    cache.set("project:progress:p1", 85.0, tags=["project:1"])
    cache.set("project:submissions:p1", [{"id": 10}], tags=["project:1"])
    cache.set("ws:groups:ws1", [{"id": 5}], tags=["workspace:ws1"])

    assert cache.get(key_project_detail(1)) is not None
    assert cache.get("project:progress:p1") is not None
    assert cache.get("project:submissions:p1") is not None
    assert cache.get("ws:groups:ws1") is not None

    # Invalidate project 1
    invalidate_project(1, "ws1")
    assert cache.get(key_project_detail(1)) is None
    assert cache.get("project:progress:p1") is None
    assert cache.get("project:submissions:p1") is None
    # ws:groups:ws1 remains because it's not tagged with project:1
    assert cache.get("ws:groups:ws1") is not None

    # Invalidate workspace ws1
    invalidate_workspace("ws1")
    assert cache.get("ws:groups:ws1") is None
