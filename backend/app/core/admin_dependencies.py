from fastapi import Depends, HTTPException, status
from app.core.dependencies import get_current_active_user
from app.models.user import User, UserRole


async def get_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    A dependency to ensure the current user has admin privileges.
    
    This function checks if the authenticated user has either ADMIN or SUPER_ADMIN role.
    It's used to protect admin-only endpoints.
    
    Args:
        current_user (User): The authenticated user from get_current_active_user dependency.
    
    Raises:
        HTTPException(403): If the user doesn't have admin privileges.
    
    Returns:
        User: The authenticated admin user.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Admin access required."
        )
    return current_user

async def get_super_admin_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """
    A dependency to ensure the current user is a super admin.
    
    This function checks if the authenticated user has SUPER_ADMIN role.
    It's used to protect super-admin-only endpoints like role management.
    
    Args:
        current_user (User): The authenticated user from get_current_active_user dependency.
    
    Raises:
        HTTPException(403): If the user is not a super admin.
    
    Returns:
        User: The authenticated super admin user.
    """
    if not current_user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions. Super admin access required."
        )
    return current_user