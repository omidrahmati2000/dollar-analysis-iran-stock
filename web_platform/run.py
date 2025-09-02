#!/usr/bin/env python3
"""
Launch script for the TradingView-like Web Trading Platform
"""

import sys
import os
import uvicorn
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

def main():
    """Main entry point for the web platform"""
    
    print("""
    🚀 Iran Market Trading Platform - Web Edition
    ===============================================
    
    TradingView-like Professional Trading Platform
    
    ✨ Features:
    • 📊 Real-time charting with 20+ technical indicators  
    • 💱 Iranian stocks & currencies data
    • ⚡ WebSocket live data streaming
    • 📱 Responsive web interface
    • 🔐 User authentication & portfolios
    • 🎯 Advanced screener & alerts
    
    🌐 Starting web server...
    """)
    
    try:
        # Import the FastAPI app
        from web_platform.main import app
        
        # Launch server
        uvicorn.run(
            "web_platform.main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            log_level="info",
            access_log=True
        )
        
    except ImportError as e:
        print(f"❌ Import Error: {e}")
        print("\n🔧 Missing dependencies. Please install:")
        print("   pip install -r requirements.txt")
        return 1
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code or 0)