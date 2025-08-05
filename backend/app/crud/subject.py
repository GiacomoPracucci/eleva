from sqlalchemy.orm import Session
from typing import Optional, List
from app.models.subject import Subject
from app.schemas.subject import SubjectCreate, SubjectUpdate


class CRUDSubject:
    """
    A class for handling all Create, Read, Update, Delete (CRUD) operations for the Subject model.

    This class abstracts the database interaction logic for subjects, providing a
    clear and reusable interface that separates data access from business logic
    in the API layer.
    """
    def get(self, db: Session, subject_id: int) -> Optional[Subject]:
        """
        Retrieves a single subject by its unique ID.

        Args:
            db (Session): The database session.
            subject_id (int): The ID of the subject to retrieve.

        Returns:
            Optional[Subject]: The Subject object if found, otherwise None.
        """
        return db.query(Subject).filter(Subject.id == subject_id).first()
    
    def get_by_owner(
        self, db: Session, owner_id: int, skip: int = 0, limit: int = 100,
        include_archived: bool = False
    ) -> List[Subject]:
        """
        Retrieves a list of subjects belonging to a specific owner, with pagination.

        By default, this method excludes archived subjects. This behavior can be
        overridden by setting the `include_archived` flag to True.

        Args:
            db (Session): The database session.
            owner_id (int): The ID of the user whose subjects are to be retrieved.
            skip (int): The number of records to skip for pagination. Defaults to 0.
            limit (int): The maximum number of records to return. Defaults to 100.
            include_archived (bool): Whether to include archived subjects in the
                                    result. Defaults to False.

        Returns:
            List[Subject]: A list of Subject objects owned by the specified user.
        """
        query = db.query(Subject).filter(Subject.owner_id == owner_id)
        if not include_archived:
            query = query.filter(Subject.is_archived == False)
        return query.offset(skip).limit(limit).all()
    
    def create(self, db: Session, obj_in: SubjectCreate, owner_id: int) -> Subject:
        """
        Creates a new subject for a specific user.

        This method takes subject data from a Pydantic schema and combines it with
        the owner's ID to create a new Subject model instance, which is then
        committed to the database.

        Args:
            db (Session): The database session.
            obj_in (SubjectCreate): A Pydantic schema with the new subject's data.
            owner_id (int): The ID of the user who will own this subject.

        Returns:
            Subject: The newly created Subject object.
        """
        db_obj = Subject(**obj_in.model_dump(), owner_id=owner_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update(self, db: Session, db_obj: Subject, obj_in: SubjectUpdate) -> Subject:
        """
        Updates an existing subject's information.

        This method performs a partial update using only the fields provided in the
        input schema (`obj_in`). It excludes any unset fields to avoid overwriting
        existing data unintentionally.

        Args:
            db (Session): The database session.
            db_obj (Subject): The existing Subject object to be updated.
            obj_in (SubjectUpdate): A Pydantic schema with the fields to update.

        Returns:
            Subject: The updated Subject object.
        """
        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_obj, field, value)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def delete(self, db: Session, db_obj: Subject) -> Subject:
        """
        Deletes a subject from the database.

        Args:
            db (Session): The database session.
            db_obj (Subject): The Subject object to be deleted.

        Returns:
            Subject: The Subject object that was just deleted.
        """
        db.delete(db_obj)
        db.commit()
        return db_obj
    
    def is_owner(self, db_obj: Subject, user_id: int) -> bool:
        """
        Checks if a given user is the owner of a subject.

        This is a simple utility function for permission checks.

        Args:
            db_obj (Subject): The subject object to check.
            user_id (int): The ID of the user to check against the subject's owner.

        Returns:
            bool: True if the user is the owner, False otherwise.
        """
        return db_obj.owner_id == user_id


#subject_crud = CRUDSubject()