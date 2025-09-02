FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies including GUI libraries
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    python3-pyqt5 \
    python3-pyqt5.qtwebengine \
    python3-pyqt5-dev \
    pyqt5-dev-tools \
    qttools5-dev-tools \
    libxcb-xinerama0 \
    libqt5widgets5 \
    libqt5gui5 \
    libqt5core5a \
    libgl1-mesa-glx \
    libgl1-mesa-dri \
    libglib2.0-0 \
    libxext6 \
    libsm6 \
    libxrender1 \
    libfontconfig1 \
    libice6 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Set display for GUI (virtual display)
ENV DISPLAY=:99

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install additional GUI dependencies explicitly
RUN pip install --no-cache-dir PyQt5==5.15.11 plotly==6.3.0

# Install watchdog for auto-reload and FastAPI dependencies
RUN pip install --no-cache-dir watchdog[watchmedo] fastapi uvicorn

# Copy application code
COPY . .

# Run as root for now (can be changed later for production)

# Default command (can be overridden in docker-compose)
CMD ["python", "main.py", "--mode", "test"]