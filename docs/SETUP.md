# CLSG-IR Setup & Installation Guide

This guide details the prerequisites and steps to run CLSG-IR locally on Windows, macOS, or Linux.

---

## 1. Prerequisites

- Python 3.10+ (tested on Python 3.12 64-bit on Windows)
- Modern web browser (Chrome, Edge, Firefox)

---

## 2. Dependencies Installation

Install required dependencies via pip:
```bash
pip install fastapi uvicorn python-multipart pydantic python-pptx python-docx pymupdf matplotlib
```

---

## 3. Running the Server

Launch the application via the entrypoint script:
```bash
python app.py
```

The console will indicate that the server is active:
```
============================================================
🚀 Starting CLSG-IR Studio Server...
📡 Local URL: http://127.0.0.1:8000
📖 API Docs: http://127.0.0.1:8000/docs
============================================================
```

Visit `http://127.0.0.1:8000` in your web browser.

---

## 4. Running Automated Tests

Execute the full suite of unit and end-to-end integration tests:
```bash
python -m unittest discover -s tests
```
All tests should pass cleanly without errors.
