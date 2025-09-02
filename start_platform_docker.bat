@echo off
echo ================================================
echo IRAN MARKET TRADING PLATFORM v2.0
echo Complete Launcher - Backend + GUI
echo ================================================
echo.

REM Check Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not running
    echo Please install Docker Desktop and make sure it's running
    pause
    exit /b 1
)

REM Check if GUI dependencies are installed
pip show PyQt5 >nul 2>&1
if errorlevel 1 (
    echo Installing GUI dependencies...
    pip install PyQt5 requests pandas numpy matplotlib mplfinance
) else (
    REM Check for mplfinance specifically (new dependency)
    pip show mplfinance >nul 2>&1
    if errorlevel 1 (
        echo Installing chart visualization dependencies...
        pip install matplotlib mplfinance
    )
)

echo Starting Docker containers (Backend + Database)...
echo Services:
echo - PostgreSQL database (port 5432)
echo - FastAPI server (port 8000)
echo - pgAdmin web interface (port 5050)
echo.

docker-compose up -d

echo.
echo Waiting for services to initialize...
timeout /t 15 /nobreak > nul

echo.
echo Checking API health...
curl -s http://localhost:8000/health >nul 2>&1
if errorlevel 1 (
    echo API not ready yet, waiting additional time...
    timeout /t 10 /nobreak > nul
    curl -s http://localhost:8000/health >nul 2>&1
    if errorlevel 1 (
        echo WARNING: API health check failed
        echo The GUI may have connection issues
        echo Check Docker containers: docker ps
    )
)

echo.
echo ================================================
echo SERVICES STATUS:
echo - API Server: http://localhost:8000
echo - API Documentation: http://localhost:8000/docs  
echo - Health Check: http://localhost:8000/health
echo - Database Admin: http://localhost:5050
echo ================================================
echo.

echo Starting GUI application...
echo GUI will connect to API at http://localhost:8000
echo.

python trading_platform/gui/main_gui.py

echo.
echo GUI closed. Stopping Docker containers...
docker-compose down

echo.
echo ================================================
echo CLEANUP COMPLETE
echo All services have been stopped
echo ================================================

pause