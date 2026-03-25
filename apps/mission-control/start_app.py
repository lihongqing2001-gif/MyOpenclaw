import os
import subprocess
import webbrowser
import time
from pathlib import Path

def main():
    print("Starting SoloCore Console...")
    
    # Check if node_modules exists
    if not os.path.exists('node_modules'):
        print("node_modules not found. Installing dependencies...")
        subprocess.run(['npm', 'install'], check=True)
    
    project_root = Path.cwd()

    # Start the dev server
    print("Building latest production UI...")
    subprocess.run(['npm', 'run', 'build'], cwd=project_root, check=True)

    print("Starting broker...")
    server_process = subprocess.Popen(
        ['npm', 'run', 'start'],
        cwd=project_root,
    )

    print("Starting resident agent...")
    agent_process = subprocess.Popen(
        ['python3', 'openclaw_agent.py'],
        cwd=project_root,
    )
    
    # Wait a moment for the server to start
    time.sleep(3)
    
    # Open browser
    print("Opening browser at http://127.0.0.1:3000")
    webbrowser.open('http://127.0.0.1:3000')
    
    try:
        # Keep the script running so both child processes stay alive
        server_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down services...")
        server_process.terminate()
        agent_process.terminate()

if __name__ == "__main__":
    main()
