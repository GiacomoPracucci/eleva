from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import Optional, List
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password


class CRUDUser:
    """
    A class for handling all Create, Read, Update, Delete (CRUD) operations for the User model.

    This class abstracts the database interaction logic away from the API endpoints,
    providing a clear and reusable interface for managing users in the database.
    """
    async def get(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """
        Retrieves a single user by their unique ID.

        Args:
            db (Session): The database session.
            user_id (int): The ID of the user to retrieve.

        Returns:
            Optional[User]: The User object if found, otherwise None.
        """
        result = await db.execute(select(User).filter(User.id == user_id))
        return result.scalar_one_or_none()
    
    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """
        Retrieves a single user by their email address.

        Args:
            db (Session): The database session.
            email (str): The email of the user to retrieve.

        Returns:
            Optional[User]: The User object if found, otherwise None.
        """
        result = await db.execute(select(User).filter(User.email == email))
        return result.scalar_one_or_none()
    
    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """
        Retrieves a single user by their username.

        Args:
            db (Session): The database session.
            username (str): The username of the user to retrieve.

        Returns:
            Optional[User]: The User object if found, otherwise None.
        """
        result = await db.execute(select(User).filter(User.username == username))
        return result.scalar_one_or_none()
    
    async def get_by_email_or_username(self, db: AsyncSession, login: str) -> Optional[User]:
        """
        Retrieves a single user by either their email or username.

        This is primarily used for login where the user can provide either
        credential.

        Args:
            db (Session): The database session.
            login (str): The email or username of the user to retrieve.

        Returns:
            Optional[User]: The User object if found, otherwise None.
        """
        result = await db.execute(
            select(User).filter(
                or_(User.email == login, User.username == login)
            )
        )
        return result.scalar_one_or_none()
    
    async def get_multi(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
        """
        Retrieves a list of users with pagination.

        Args:
            db (Session): The database session.
            skip (int): The number of records to skip. Defaults to 0.
            limit (int): The maximum number of records to return. Defaults to 100.

        Returns:
            List[User]: A list of User objects.
        """
        result = await db.execute(
            select(User).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def create(self, db: AsyncSession, obj_in: UserCreate) -> User:
        """
        Creates a new user in the database.

        This method takes user data from a Pydantic schema, hashes the
        plain-text password, creates a new User model instance, and commits it
        to the database.

        Args:
            db (Session): The database session.
            obj_in (UserCreate): A Pydantic schema containing the new user's data.

        Returns:
            User: The newly created User object.
        """
        db_obj = User(
            email=obj_in.email,
            username=obj_in.username,
            full_name=obj_in.full_name,
            hashed_password=get_password_hash(obj_in.password),
            academic_level=obj_in.academic_level,
            bio=obj_in.bio,
            show_profile_publicly=obj_in.show_profile_publicly,
            allow_ai_training=obj_in.allow_ai_training
        )
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def update(self, db: AsyncSession, db_obj: User, obj_in: UserUpdate) -> User:
        """
        Updates an existing user's information in the database.

        This method performs a partial update. It takes a dictionary of update data
        from a Pydantic schema, excluding any unset fields, and applies the changes
        to the provided database object.

        Args:
            db (Session): The database session.
            db_obj (User): The existing User object to be updated.
            obj_in (UserUpdate): A Pydantic schema with the fields to update.

        Returns:
            User: The updated User object.
        """
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        await db.commit()
        await db.refresh(db_obj)
        return db_obj
    
    async def authenticate(self, db: AsyncSession, username: str, password: str) -> Optional[User]:
        """
        Authenticates a user by checking their credentials.

        It first finds the user by their email or username and then verifies that
        the provided password matches the stored hash.

        Args:
            db (Session): The database session.
            username (str): The user's email or username.
            password (str): The user's plain-text password.

        Returns:
            Optional[User]: The authenticated User object if credentials are correct,
                            otherwise None.
        """
        user = await self.get_by_email_or_username(db, username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user
    
    def is_active(self, user: User) -> bool:
        """
        Checks if a user account is active.

        Args:
            user (User): The user object to check.

        Returns:
            bool: True if the user is active, False otherwise.
        """
        return user.is_active


user_crud = CRUDUser()