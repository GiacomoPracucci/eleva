from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional
from app.core.dependencies import get_db, get_current_active_user
from app.crud.user import user_crud
from app.schemas.user import User, UserUpdate
from app.models.user import User as UserModel
import boto3
from PIL import Image
import io
import uuid
from app.core.config import settings

router = APIRouter()


@router.get("/me", response_model=User)
def read_current_user(
    current_user: UserModel = Depends(get_current_active_user)
):
    """Get current user profile"""
    return current_user


@router.put("/me", response_model=User)
def update_current_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Update current user profile"""
    user = user_crud.update(db, db_obj=current_user, obj_in=user_update)
    return user


@router.post("/me/profile-picture", response_model=User)
async def upload_profile_picture(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Upload user profile picture"""
    # Validate file type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    # Read and process image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents))
    
    # Resize image to max 500x500
    image.thumbnail((500, 500), Image.Resampling.LANCZOS)
    
    # Convert to RGB if necessary
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Save to bytes
    img_byte_arr = io.BytesIO()
    image.save(img_byte_arr, format='JPEG', quality=85)
    img_byte_arr = img_byte_arr.getvalue()
    
    # Upload to S3
    s3_client = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )
    
    file_key = f"profile-pictures/{current_user.id}/{uuid.uuid4()}.jpg"
    
    try:
        s3_client.put_object(
            Bucket=settings.AWS_BUCKET_NAME,
            Key=file_key,
            Body=img_byte_arr,
            ContentType='image/jpeg'
        )
        
        # Generate public URL
        profile_picture_url = f"https://{settings.AWS_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{file_key}"
        
        # Update user profile picture URL
        current_user.profile_picture_url = profile_picture_url
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
        
        return current_user
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {str(e)}")


@router.delete("/me/profile-picture", response_model=User)
def delete_profile_picture(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_active_user)
):
    """Delete user profile picture"""
    if current_user.profile_picture_url:
        # Delete from S3
        s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_REGION
        )
        
        # Extract key from URL
        file_key = current_user.profile_picture_url.split('.com/')[-1]
        
        try:
            s3_client.delete_object(
                Bucket=settings.AWS_BUCKET_NAME,
                Key=file_key
            )
        except:
            pass  # Continue even if S3 deletion fails
        
        # Remove URL from database
        current_user.profile_picture_url = None
        db.add(current_user)
        db.commit()
        db.refresh(current_user)
    
    return current_user