#!/usr/bin/env python3
"""
CLI script to securely provision an Administrator account in NexaVault.
Usage:
    python backend/scripts/provision_admin.py --email admin@example.edu --name "Admin Name" --password "SecurePass123!" [--department CS]
"""
import sys
import os
import argparse

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import hash_password
from app.services.audit_service import log_audit


def provision_admin(email: str, name: str, password: str, department: str = None) -> bool:
    email_clean = email.lower().strip()
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email_clean).first()
        if existing:
            if existing.role.lower() == "administrator":
                print(f"[!] User '{email_clean}' already exists and is already an Administrator (ID: {existing.id}).")
                # Update password if requested
                existing.hashed_password = hash_password(password)
                existing.full_name = name.strip()
                if department:
                    existing.department = department.strip()
                existing.is_active = True
                db.commit()
                print(f"[+] Successfully updated credentials for existing Administrator '{email_clean}'.")
                return True
            else:
                print(f"[-] Error: User '{email_clean}' exists with role '{existing.role}'. Refusing to overwrite non-admin account via CLI.")
                return False

        hashed = hash_password(password)
        new_admin = User(
            email=email_clean,
            full_name=name.strip(),
            hashed_password=hashed,
            role="administrator",
            department=department.strip() if department else None,
            is_active=True,
        )
        db.add(new_admin)
        db.flush()

        log_audit(
            db=db,
            action_type="admin_account_provisioned_cli",
            entity_type="user",
            entity_id=new_admin.id,
            description=f"Administrator account '{email_clean}' provisioned via secure CLI.",
            new_value={"email": email_clean, "full_name": name, "department": department},
        )
        db.commit()
        db.refresh(new_admin)
        print(f"[+] Successfully provisioned Administrator account: ID={new_admin.id}, Email={new_admin.email}, Dept={new_admin.department}")
        return True
    except Exception as e:
        db.rollback()
        print(f"[-] Database error while provisioning admin: {e}")
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Securely provision a NexaVault Administrator account.")
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--name", required=True, help="Full name of administrator")
    parser.add_argument("--password", required=True, help="Strong password")
    parser.add_argument("--department", required=False, default=None, help="Assigned department code (e.g. CS, ECE) or omit for Global Admin")

    args = parser.parse_args()
    success = provision_admin(
        email=args.email,
        name=args.name,
        password=args.password,
        department=args.department,
    )
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
