from fastapi import APIRouter
from ..models import APIResponse, BacktestStrategy, BacktestResult

router = APIRouter()

@router.post("/run", response_model=APIResponse)
async def run_backtest(strategy: BacktestStrategy):
    return APIResponse(data={"message": "Backtesting coming soon"})