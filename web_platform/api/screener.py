from fastapi import APIRouter
from ..models import APIResponse, ScreenerRequest

router = APIRouter()

@router.post("/scan", response_model=APIResponse)
async def scan_stocks(request: ScreenerRequest):
    return APIResponse(data={"message": "Stock screener coming soon"})