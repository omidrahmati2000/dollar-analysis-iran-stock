"""
Price Alerts API endpoints
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List
from datetime import datetime
import uuid

from ..models import PriceAlert, AlertCreate, APIResponse
from ..auth import get_current_user, User

router = APIRouter()

# Temporary in-memory storage
alerts_db = {}

@router.get("/", response_model=APIResponse)
async def get_alerts(current_user: User = Depends(get_current_user)):
    """Get user's price alerts"""
    user_alerts = [a for a in alerts_db.values() if a.user_id == current_user.id]
    return APIResponse(data=user_alerts)

@router.post("/", response_model=APIResponse)
async def create_alert(
    alert_data: AlertCreate,
    current_user: User = Depends(get_current_user)
):
    """Create new price alert"""
    alert_id = str(uuid.uuid4())
    alert = PriceAlert(
        id=alert_id,
        user_id=current_user.id,
        symbol=alert_data.symbol,
        condition=alert_data.condition,
        target_price=alert_data.target_price,
        change_percent=alert_data.change_percent,
        created_at=datetime.now()
    )
    
    alerts_db[alert_id] = alert
    return APIResponse(data=alert)

# Additional alert endpoints...