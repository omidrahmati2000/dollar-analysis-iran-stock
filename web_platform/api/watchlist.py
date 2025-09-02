"""
Watchlist API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
import uuid

from ..models import Watchlist, WatchlistCreate, WatchlistUpdate, APIResponse
from ..auth import get_current_user, User

router = APIRouter()

# Temporary in-memory storage
watchlists_db = {}

@router.get("/", response_model=APIResponse)
async def get_watchlists(current_user: User = Depends(get_current_user)):
    """Get user's watchlists"""
    user_watchlists = [w for w in watchlists_db.values() if w.user_id == current_user.id]
    return APIResponse(data=user_watchlists)

@router.post("/", response_model=APIResponse)
async def create_watchlist(
    watchlist_data: WatchlistCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new watchlist"""
    watchlist_id = str(uuid.uuid4())
    watchlist = Watchlist(
        id=watchlist_id,
        name=watchlist_data.name,
        user_id=current_user.id,
        symbols=watchlist_data.symbols,
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    watchlists_db[watchlist_id] = watchlist
    return APIResponse(data=watchlist)

# Additional watchlist endpoints...