#!/usr/bin/env python3
"""
Trading Platform Launcher
Unified launcher for API server and GUI application
"""

import sys
import os
import subprocess
import time
import threading
import requests
from pathlib import Path


class PlatformLauncher:
    """Main platform launcher class"""
    
    def __init__(self):
        self.base_dir = Path(__file__).parent
        self.api_port = 8000
        self.api_process = None
        self.gui_process = None
    
    def check_api_running(self) -> bool:
        """Check if API server is already running"""
        try:
            response = requests.get(f"http://localhost:{self.api_port}/health", timeout=2)
            return response.status_code == 200
        except:
            return False
    
    def start_api_server(self):
        """Start the API server"""
        print("Starting API v2 server...")
        print("-" * 60)
        
        api_dir = self.base_dir / "api"
        
        # Start API server
        self.api_process = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "trading_platform.api.main:app", 
             "--host", "0.0.0.0", "--port", str(self.api_port), "--reload"],
            cwd=self.base_dir.parent,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Stream output
        def stream_api_output():
            for line in iter(self.api_process.stdout.readline, ''):
                if line:
                    print(f"[API] {line.rstrip()}")
        
        api_thread = threading.Thread(target=stream_api_output)
        api_thread.daemon = True
        api_thread.start()
    
    def start_gui_application(self):
        """Start the GUI application"""
        print("\nStarting GUI Trading Platform...")
        print("-" * 60)
        
        gui_file = self.base_dir / "gui" / "main_gui.py"
        
        self.gui_process = subprocess.Popen(
            [sys.executable, str(gui_file)],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Stream output
        for line in iter(self.gui_process.stdout.readline, ''):
            if line:
                print(f"[GUI] {line.rstrip()}")
    
    def run(self):
        """Main launcher function"""
        print("=" * 60)
        print("IRAN MARKET TRADING PLATFORM v2.0")
        print("Professional Trading System")
        print("=" * 60)
        
        try:
            # Check if API is already running
            if self.check_api_running():
                print("✓ API server is already running on port 8000")
                print("  Documentation: http://localhost:8000/docs")
            else:
                print("Starting API server...")
                self.start_api_server()
                
                # Wait for API to be ready
                print("Waiting for API to be ready...")
                max_retries = 30
                for i in range(max_retries):
                    if self.check_api_running():
                        print("✓ API server is ready!")
                        print("  Documentation: http://localhost:8000/docs")
                        break
                    time.sleep(1)
                    if i % 5 == 0 and i > 0:
                        print(f"  Still waiting... ({i} seconds)")
                else:
                    print("✗ API server failed to start")
                    print("Please start it manually: cd trading_platform/api && python main.py")
                    return 1
            
            # Small delay to ensure API is fully ready
            time.sleep(2)
            
            # Start GUI application
            print("\nLaunching GUI Trading Platform...")
            self.start_gui_application()
            
            print("\n" + "=" * 60)
            print("PLATFORM RUNNING")
            print("-" * 60)
            print("• API Server: http://localhost:8000")
            print("• API Docs: http://localhost:8000/docs")
            print("• GUI: Running")
            print("\nPress Ctrl+C to stop all services")
            print("=" * 60)
            
            # Wait for GUI to exit
            if self.gui_process:
                self.gui_process.wait()
            
        except KeyboardInterrupt:
            self.shutdown()
        except Exception as e:
            print(f"Error: {e}")
            return 1
        
        return 0
    
    def shutdown(self):
        """Shutdown all services"""
        print("\n\nShutting down platform...")
        
        if self.api_process:
            print("Stopping API server...")
            self.api_process.terminate()
            try:
                self.api_process.wait(timeout=5)
            except:
                self.api_process.kill()
        
        if self.gui_process:
            print("Closing GUI application...")
            self.gui_process.terminate()
            try:
                self.gui_process.wait(timeout=5)
            except:
                self.gui_process.kill()
        
        print("Platform stopped.")


def main():
    """Entry point"""
    launcher = PlatformLauncher()
    return launcher.run()


if __name__ == "__main__":
    sys.exit(main())