#!/bin/bash

# Script to manage Docker containers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    printf "${2}${1}${NC}\n"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_color "Error: Docker is not running!" "$RED"
        exit 1
    fi
}

# Function to start services
start_services() {
    print_color "Starting services..." "$GREEN"
    docker-compose up -d postgres
    
    print_color "Waiting for PostgreSQL to be ready..." "$YELLOW"
    sleep 5
    
    print_color "Starting application..." "$GREEN"
    docker-compose up app
}

# Function to start development mode
start_dev() {
    print_color "Starting in development mode..." "$GREEN"
    docker-compose up -d postgres
    
    print_color "Waiting for PostgreSQL to be ready..." "$YELLOW"
    sleep 5
    
    print_color "Starting development container..." "$GREEN"
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm app bash
}

# Function to run tests
run_tests() {
    print_color "Running tests..." "$GREEN"
    docker-compose run --rm app python main.py --mode test
}

# Function to run full batch
run_full() {
    print_color "Running full batch processing..." "$YELLOW"
    print_color "This may take several hours!" "$RED"
    docker-compose run --rm app python main.py --mode full
}

# Function to stop services
stop_services() {
    print_color "Stopping services..." "$YELLOW"
    docker-compose down
}

# Function to clean everything
clean_all() {
    print_color "Cleaning up everything..." "$RED"
    docker-compose down -v
    print_color "All containers and volumes removed!" "$GREEN"
}

# Function to view logs
view_logs() {
    docker-compose logs -f "$1"
}

# Main script
check_docker

case "${1:-help}" in
    start)
        start_services
        ;;
    dev)
        start_dev
        ;;
    test)
        run_tests
        ;;
    full)
        run_full
        ;;
    stop)
        stop_services
        ;;
    clean)
        clean_all
        ;;
    logs)
        view_logs "${2:-app}"
        ;;
    *)
        echo "Usage: $0 {start|dev|test|full|stop|clean|logs [service]}"
        echo ""
        echo "Commands:"
        echo "  start  - Start all services"
        echo "  dev    - Start in development mode with bash shell"
        echo "  test   - Run test mode"
        echo "  full   - Run full batch processing"
        echo "  stop   - Stop all services"
        echo "  clean  - Stop services and remove volumes"
        echo "  logs   - View logs (optional: specify service)"
        exit 1
        ;;
esac