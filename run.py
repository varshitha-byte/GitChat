import uvicorn
import sys
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

def main():
    print("=" * 65)
    print(" [*] CodeRAG Assistant -- AI Developer Assistant Server")
    print("=" * 65)
    print("  - Web UI Dashboard:      http://127.0.0.1:8000")
    print("  - Interactive API Docs:  http://127.0.0.1:8000/docs")
    print("  - Architecture Docs:     docs/ARCHITECTURE_DECISIONS.md")
    print("  - Interview Cheat Sheet: docs/INTERVIEW_CHEATSHEET.md")
    print("=" * 65)
    print("Starting Uvicorn server...")
    
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)

if __name__ == "__main__":
    main()
