# scripts/create_super_admin.py
"""
Script to create a super admin user for initial setup.
Run this script after database initialization to create your first admin.

Usage:
    python scripts/create_super_admin.py
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__)))

from app.db.session import AsyncSessionLocal
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from sqlalchemy import select


async def create_super_admin():
    """Create a super admin user interactively"""
    
    print("\n=== Eléva Super Admin Creation ===\n")
    
    # Get user input
    email = input("Enter email: ").strip()
    username = input("Enter username: ").strip()
    full_name = input("Enter full name (optional): ").strip() or None
    password = input("Enter password: ").strip()
    
    if not email or not username or not password:
        print("\nError: Email, username, and password are required!")
        return
    
    if len(password) < 8:
        print("\nError: Password must be at least 8 characters long!")
        return
    
    async with AsyncSessionLocal() as db:
        try:
            # Check if user already exists
            result = await db.execute(
                select(User).filter(
                    (User.email == email) | (User.username == username)
                )
            )
            existing_user = result.scalar_one_or_none()
            
            if existing_user:
                if existing_user.email == email:
                    print(f"\nError: User with email '{email}' already exists!")
                else:
                    print(f"\nError: User with username '{username}' already exists!")
                
                # Ask if they want to upgrade existing user to super admin
                if existing_user.role != UserRole.SUPER_ADMIN:
                    upgrade = input("\nDo you want to upgrade this user to super admin? (y/n): ").lower()
                    if upgrade == 'y':
                        existing_user.role = UserRole.SUPER_ADMIN
                        await db.commit()
                        print(f"\n✓ User '{existing_user.username}' upgraded to super admin!")
                return
            
            # Create new super admin user
            new_admin = User(
                email=email,
                username=username,
                full_name=full_name,
                hashed_password=get_password_hash(password),
                role=UserRole.SUPER_ADMIN,
                is_active=True,
                is_verified=True
            )
            
            db.add(new_admin)
            await db.commit()
            
            print(f"\n✓ Super admin user '{username}' created successfully!")
            print("\nYou can now login with these credentials at /login")
            print("Access the admin panel at /admin after logging in.")
            
        except Exception as e:
            print(f"\nError creating super admin: {str(e)}")
            await db.rollback()


async def list_admins():
    """List all existing admin users"""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).filter(
                User.role.in_([UserRole.ADMIN, UserRole.SUPER_ADMIN])
            )
        )
        admins = result.scalars().all()
        
        if admins:
            print("\n=== Existing Admin Users ===\n")
            for admin in admins:
                role_str = "Super Admin" if admin.role == UserRole.SUPER_ADMIN else "Admin"
                print(f"- {admin.username} ({admin.email}) - {role_str}")
        else:
            print("\nNo admin users found.")


async def main():
    """Main function"""
    print("\nWhat would you like to do?")
    print("1. Create a new super admin")
    print("2. List existing admins")
    print("3. Exit")
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == "1":
        await create_super_admin()
    elif choice == "2":
        await list_admins()
    elif choice == "3":
        print("\nGoodbye!")
        return
    else:
        print("\nInvalid choice!")
    
    # Ask if they want to do something else
    again = input("\nDo you want to perform another action? (y/n): ").lower()
    if again == 'y':
        await main()


if __name__ == "__main__":
    asyncio.run(main())