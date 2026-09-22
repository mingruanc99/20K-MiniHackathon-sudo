# app.py
"""
Single-command runnable entrypoint for CLSG-IR Studio.
Run with:
    python app.py
"""
import sys
import uvicorn

if __name__ == "__main__":
    # Ensure UTF-8 output encoding on Windows consoles
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stderr.reconfigure(encoding="utf-8")
        except Exception:
            pass

    print("=" * 60)
    print("Starting CLSG-IR Studio Server...")
    print("Local URL: http://127.0.0.1:8000")
    print("API Docs: http://127.0.0.1:8000/docs")
    print("=" * 60)
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
