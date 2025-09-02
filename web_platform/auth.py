"""
Authentication system for the Web Trading Platform
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
import bcrypt
import uuid
import os
from typing import Optional

from .models import User, UserCreate, UserLogin, Token, APIResponse

# Configuration - IMPORTANT: Set SECRET_KEY in environment variables
SECRET_KEY = os.getenv("SECRET_KEY", "CHANGE-THIS-IN-PRODUCTION")  # Change this in production!
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Security scheme
security = HTTPBearer()

# In-memory user storage (use database in production)
users_db = {}

# Router
auth_router = APIRouter()

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return payload
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials", 
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(token_data: dict = Depends(verify_token)) -> User:
    """Get current user from token"""
    user_id = token_data.get("sub")
    if user_id not in users_db:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return users_db[user_id]

@auth_router.post("/register", response_model=APIResponse)
async def register(user_data: UserCreate):
    """Register new user"""
    # Check if username already exists
    for user in users_db.values():
        if user.username == user_data.username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        if user.email == user_data.email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
    
    # Create new user
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    
    user = User(
        id=user_id,
        username=user_data.username,
        email=user_data.email,
        full_name=user_data.full_name,
        created_at=datetime.utcnow()
    )
    
    # Store user (with password separately in production)
    users_db[user_id] = user
    # In production, store hashed_password in separate secure table
    
    return APIResponse(
        data={"user": user, "message": "User registered successfully"},
        message="Registration successful"
    )

@auth_router.post("/login", response_model=APIResponse)
async def login(user_credentials: UserLogin):
    """Login user"""
    # Find user by username
    user = None
    for u in users_db.values():
        if u.username == user_credentials.username:
            user = u
            break
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # In production, verify password from secure storage
    # For demo, we'll accept any password
    # if not verify_password(user_credentials.password, stored_password):
    #     raise HTTPException(
    #         status_code=status.HTTP_401_UNAUTHORIZED,
    #         detail="Invalid username or password"
    #     )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.id, "username": user.username},
        expires_delta=access_token_expires
    )
    
    token = Token(
        access_token=access_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    
    return APIResponse(
        data={"token": token, "user": user},
        message="Login successful"
    )

@auth_router.get("/me", response_model=APIResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return APIResponse(data=current_user)

@auth_router.post("/logout", response_model=APIResponse)
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user (in practice, you'd invalidate the token)"""
    return APIResponse(
        data={"message": "Logged out successfully"},
        message="Logout successful"
    )

# Create a demo user for testing
demo_user = User(
    id="demo-user-id",
    username="demo",
    email="demo@example.com",
    full_name="Demo User",
    is_active=True,
    is_premium=True,
    created_at=datetime.utcnow()
)
users_db["demo-user-id"] = demo_user