import urllib.request
import urllib.parse
import json
import time
import sys

BASE_URL = "https://nexavault-l5b5.onrender.com/api/v1"
ORIGIN = "https://nexa-vault-chi.vercel.app"

def request(method, path, body=None, token=None):
    url = f"{BASE_URL}{path}"
    headers = {
        "Origin": ORIGIN,
        "User-Agent": "NexaVault-Production-Auditor/1.0",
        "Content-Type": "application/json"
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            resp_body = resp.read().decode('utf-8')
            parsed = json.loads(resp_body) if resp_body else None
            return status, parsed, resp.headers
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode('utf-8')
        try:
            parsed = json.loads(resp_body)
        except:
            parsed = resp_body
        return e.code, parsed, e.headers
    except Exception as e:
        return 0, str(e), {}

def run_full_suite():
    print("=" * 60)
    print("NEXAVAULT LIVE PRODUCTION VERIFICATION SUITE")
    print(f"Target API: {BASE_URL}")
    print(f"Origin: {ORIGIN}")
    print("=" * 60)

    ts = int(time.time())

    # 1. CORS Preflight
    print("\n[1] Testing CORS Preflight on /auth/login...")
    req = urllib.request.Request(
        f"{BASE_URL}/auth/login",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        },
        method="OPTIONS"
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        allow_origin = resp.headers.get("Access-Control-Allow-Origin")
        assert allow_origin == ORIGIN or allow_origin == "*", f"Unexpected CORS allow origin: {allow_origin}"
        print(f"  -> PASS: 200 OK with Access-Control-Allow-Origin: {allow_origin}")

    # 2. Invalid Login
    print("\n[2] Testing Invalid Credentials Rejection...")
    status, body, headers = request("POST", "/auth/login", {"email": f"fake_{ts}@nexavault.edu", "password": "wrong"})
    assert status == 401, f"Expected 401, got {status}"
    print("  -> PASS: 401 Unauthorized returned cleanly.")

    # 3. Student Registrations & Logins
    s1_email = f"prod_s1_{ts}@nexavault.edu"
    s2_email = f"prod_s2_{ts}@nexavault.edu"
    print(f"\n[3] Registering Student 1 ({s1_email}) & Student 2 ({s2_email})...")
    status, body, _ = request("POST", "/auth/register", {"email": s1_email, "password": "Password123!", "full_name": "Student Alpha"})
    assert status == 201, f"Reg 1 failed: {body}"
    s1_token = body["access_token"]

    status, body, _ = request("POST", "/auth/register", {"email": s2_email, "password": "Password123!", "full_name": "Student Beta"})
    assert status == 201, f"Reg 2 failed: {body}"
    s2_token = body["access_token"]
    print("  -> PASS: Both students registered and tokenized.")

    # 4. Group Management
    print("\n[4] Testing Group Creation, 1-Member Enrollment Block, & Join...")
    status, body, _ = request("POST", "/groups/", {"name": f"Alpha Team {ts}"}, token=s1_token)
    assert status == 201, f"Create group failed: {body}"
    group_id = body["id"]
    group_code = body["code"]

    # 1-member block
    status, body, _ = request("POST", f"/groups/{group_id}/enroll", {"workspace_id": "WS-1"}, token=s1_token)
    assert status == 400, f"Expected 400 for 1-member group, got {status}"
    print("  -> PASS: 1-member group enrollment blocked.")

    # Student 2 joins
    status, body, _ = request("POST", "/groups/join", {"code": group_code}, token=s2_token)
    assert status == 200 and body["member_count"] == 2, f"Join failed: {body}"
    print(f"  -> PASS: Student 2 joined. Member count: {body['member_count']}")

    # Code rotation
    status, body, _ = request("PATCH", f"/groups/{group_id}/code", {}, token=s1_token)
    assert status == 200 and body["code"] != group_code
    print(f"  -> PASS: Group code rotated to: {body['code']}")

    # 5. Role Isolation Negative Test
    print("\n[5] Testing Role Isolation (Student accessing Review Queue)...")
    status, body, _ = request("GET", "/reviews/queue", token=s1_token)
    assert status == 403, f"Expected 403, got {status}"
    print("  -> PASS: Role isolation strictly enforced (403 Forbidden).")

    print("\n" + "=" * 60)
    print("LIVE PRODUCTION VERIFICATION COMPLETED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_full_suite()
