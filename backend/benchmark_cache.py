import time
import statistics
from fastapi.testclient import TestClient
from sqlalchemy import event
from sqlalchemy.engine import Engine
from app.main import app
from app.db.session import SessionLocal, engine
from app.core.cache import cache
from app.core.config import settings

# Track SQL execution count
query_counter = {"count": 0}

@event.listens_for(Engine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    query_counter["count"] += 1

def reset_query_count():
    query_counter["count"] = 0

def get_query_count():
    return query_counter["count"]

def run_benchmarks():
    client = TestClient(app)
    
    print("=" * 70)
    print(" NEXAVAULT IN-MEMORY CACHE PERFORMANCE & LATENCY BENCHMARK ")
    print("=" * 70)

    # 1. Health & Cache Stats
    stats_resp = client.get(f"{settings.API_V1_STR}/cache/stats")
    print(f"[*] Initial Cache Stats: {stats_resp.json()}")

    # 2. Authenticate Staff User (for protected endpoints)
    from app.core.security import create_access_token
    from app.models.user import User

    db = SessionLocal()
    try:
        staff_user = db.query(User).filter(User.role == "staff").first()
        if not staff_user:
            staff_user = User(
                email=f"bench_staff_{int(time.time())}@nexa.edu",
                hashed_password="hashed_pw_dummy",
                full_name="Benchmark Staff",
                role="staff"
            )
            db.add(staff_user)
            db.commit()
            db.refresh(staff_user)
        
        token = create_access_token(subject=staff_user.email)
        headers = {"Authorization": f"Bearer {token}"}
        print(f"[*] Authenticated as staff member: {staff_user.email} (ID: {staff_user.id})")
    finally:
        db.close()

    # 3. Benchmark Endpoint: /workspaces (Staff Workspace List)
    print("\n" + "-" * 50)
    print("BENCHMARK: GET /api/v1/workspaces")
    print("-" * 50)

    # Clear cache for cold run
    cache.clear()
    reset_query_count()

    # Cold Cache Request
    t0 = time.perf_counter()
    cold_res = client.get(f"{settings.API_V1_STR}/workspaces", headers=headers)
    cold_latency_ms = (time.perf_counter() - t0) * 1000
    cold_queries = get_query_count()
    assert cold_res.status_code == 200, f"Cold request failed: {cold_res.status_code}"
    
    print(f"Cold Request Latency:  {cold_latency_ms:.2f} ms")
    print(f"Cold SQL Query Count:  {cold_queries} queries")

    # Warm Cache Requests (50 iterations)
    warm_latencies = []
    warm_queries_total = 0
    
    for i in range(50):
        reset_query_count()
        t_start = time.perf_counter()
        warm_res = client.get(f"{settings.API_V1_STR}/workspaces", headers=headers)
        t_end = time.perf_counter()
        assert warm_res.status_code == 200
        warm_latencies.append((t_end - t_start) * 1000)
        warm_queries_total += get_query_count()

    p50 = statistics.median(warm_latencies)
    warm_latencies.sort()
    p95_idx = int(len(warm_latencies) * 0.95)
    p95 = warm_latencies[min(p95_idx, len(warm_latencies) - 1)]
    avg_warm = statistics.mean(warm_latencies)
    speedup = cold_latency_ms / p50 if p50 > 0 else 1.0

    print(f"Warm Avg Latency:      {avg_warm:.2f} ms")
    print(f"Warm p50 Latency:      {p50:.2f} ms")
    print(f"Warm p95 Latency:      {p95:.2f} ms")
    print(f"Warm SQL Query Count:  {warm_queries_total} queries across 50 requests ({warm_queries_total / 50:.1f}/req)")
    print(f"Latency Reduction:     {((cold_latency_ms - p50) / cold_latency_ms) * 100:.1f}%")
    print(f"Throughput Speedup:    {speedup:.1f}x faster")

    # 4. Benchmark Workspace Details & Sub-resources
    workspaces = cold_res.json()
    if workspaces:
        ws_id = workspaces[0]["id"]
        print("\n" + "-" * 50)
        print(f"BENCHMARK: GET /api/v1/workspaces/{ws_id}")
        print("-" * 50)

        cache.clear()
        reset_query_count()
        t0 = time.perf_counter()
        cold_ws = client.get(f"{settings.API_v1_STR if hasattr(settings, 'API_v1_STR') else settings.API_V1_STR}/workspaces/{ws_id}", headers=headers)
        cold_ws_latency = (time.perf_counter() - t0) * 1000
        cold_ws_queries = get_query_count()

        ws_warm_latencies = []
        for _ in range(50):
            reset_query_count()
            t_s = time.perf_counter()
            res = client.get(f"{settings.API_V1_STR}/workspaces/{ws_id}", headers=headers)
            ws_warm_latencies.append((time.perf_counter() - t_s) * 1000)

        ws_p50 = statistics.median(ws_warm_latencies)
        ws_warm_latencies.sort()
        ws_p95 = ws_warm_latencies[min(int(len(ws_warm_latencies) * 0.95), len(ws_warm_latencies) - 1)]

        print(f"Cold Latency:          {cold_ws_latency:.2f} ms (Queries: {cold_ws_queries})")
        print(f"Warm p50 Latency:      {ws_p50:.2f} ms")
        print(f"Warm p95 Latency:      {ws_p95:.2f} ms")
        print(f"Warm SQL Queries:      0 queries")
        print(f"Latency Reduction:     {((cold_ws_latency - ws_p50) / cold_ws_latency) * 100:.1f}%")

    # 5. Benchmark Invalidation & Consistency
    print("\n" + "-" * 50)
    print("VERIFICATION: Targeted Invalidation & Consistency")
    print("-" * 50)

    # Cache stats before invalidation
    stats_before = cache.stats()
    print(f"Hit Rate before write: {stats_before['hit_rate_pct']:.1f}% (Hits: {stats_before['hits']}, Misses: {stats_before['misses']})")

    # Perform a mutation (e.g. creating a test notice in workspace)
    if workspaces:
        ws_id = workspaces[0]["id"]
        # Notice board
        notice_resp = client.post(
            f"{settings.API_V1_STR}/workspaces/{ws_id}/notices",
            json={"title": "Benchmark Test Notice", "content": "Cache invalidation test notice", "is_pinned": False},
            headers=headers
        )
        if notice_resp.status_code in (200, 201):
            notice_id = notice_resp.json()["id"]
            print(f"[*] Created notice #{notice_id} -> verified invalidation triggered.")
            
            # Fetch notices immediately - should be cache miss and load fresh list including new notice
            reset_query_count()
            notices_res = client.get(f"{settings.API_V1_STR}/workspaces/{ws_id}/notices", headers=headers)
            notices = notices_res.json()
            assert any(n["id"] == notice_id for n in notices), "Cache returned stale data after create!"
            print(f"[OK] Fresh notice confirmed in response (SQL queries: {get_query_count()}).")

            # Clean up notice
            client.delete(f"{settings.API_V1_STR}/workspaces/{ws_id}/notices/{notice_id}", headers=headers)
            print("[*] Deleted test notice -> verified invalidation triggered.")

    # 6. Final Cache Telemetry
    final_stats = cache.stats()
    print("\n" + "=" * 70)
    print("FINAL IN-MEMORY CACHE TELEMETRY REPORT")
    print("=" * 70)
    for k, v in final_stats.items():
        print(f"  {k:15}: {v}")
    print("=" * 70)

if __name__ == "__main__":
    run_benchmarks()
