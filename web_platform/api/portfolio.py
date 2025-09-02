"""
Portfolio Management API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import uuid

from ..models import Portfolio, Position, APIResponse
from ..auth import get_current_user, User

router = APIRouter()

# Temporary in-memory storage (in production, use database)
portfolios_db = {}
positions_db = {}

@router.get("/", response_model=APIResponse)
async def get_portfolios(current_user: User = Depends(get_current_user)):
    """Get user's portfolios"""
    user_portfolios = [p for p in portfolios_db.values() if p.user_id == current_user.id]
    return APIResponse(data=user_portfolios)

@router.post("/", response_model=APIResponse)
async def create_portfolio(
    name: str,
    current_user: User = Depends(get_current_user)
):
    """Create new portfolio"""
    portfolio_id = str(uuid.uuid4())
    portfolio = Portfolio(
        id=portfolio_id,
        name=name,
        user_id=current_user.id,
        positions=[],
        created_at=datetime.now(),
        updated_at=datetime.now()
    )
    
    portfolios_db[portfolio_id] = portfolio
    return APIResponse(data=portfolio)

@router.get("/{portfolio_id}", response_model=APIResponse)
async def get_portfolio(
    portfolio_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get specific portfolio"""
    if portfolio_id not in portfolios_db:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    portfolio = portfolios_db[portfolio_id]
    if portfolio.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return APIResponse(data=portfolio)

# Additional portfolio endpoints would go here...