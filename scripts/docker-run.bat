@echo off
REM Script to manage Docker containers on Windows

setlocal enabledelayedexpansion

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not running!
    exit /b 1
)

REM Parse command
set "command=%1"

if "%command%"=="" set "command=help"

if "%command%"=="start" (
    echo Starting services...
    docker-compose up -d postgres
    timeout /t 5 /nobreak >nul
    echo Starting application...
    docker-compose up app
    
) else if "%command%"=="dev" (
    echo Starting in development mode...
    docker-compose up -d postgres
    timeout /t 5 /nobreak >nul
    echo Starting development container...
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app bash
    
) else if "%command%"=="test" (
    echo Running tests...
    docker-compose run --rm app python main.py --mode test
    
) else if "%command%"=="full" (
    echo Running full batch processing...
    echo This may take several hours!
    docker-compose run --rm app python main.py --mode full
    
) else if "%command%"=="stop" (
    echo Stopping services...
    docker-compose down
    
) else if "%command%"=="clean" (
    echo Cleaning up everything...
    docker-compose down -v
    echo All containers and volumes removed!
    
) else if "%command%"=="logs" (
    set "service=%2"
    if "%service%"=="" set "service=app"
    docker-compose logs -f !service!
    
) else (
    echo Usage: %0 {start^|dev^|test^|full^|stop^|clean^|logs [service]}
    echo.
    echo Commands:
    echo   start  - Start all services
    echo   dev    - Start in development mode with bash shell
    echo   test   - Run test mode
    echo   full   - Run full batch processing
    echo   stop   - Stop all services
    echo   clean  - Stop services and remove volumes
    echo   logs   - View logs ^(optional: specify service^)
    exit /b 1
)

endlocal