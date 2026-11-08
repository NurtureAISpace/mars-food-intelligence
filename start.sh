#!/usr/bin/env bash
set -e

# Mars Food Intelligence - Start Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=========================================================="
echo "   MARS FOOD INTELLIGENCE (SOL-450 MVP SYSTEM)            "
echo "   NASA Space Apps Challenge Ganja 2026                    "
echo "=========================================================="

# Check Python environment
if [ -d "$BACKEND_DIR/.venv" ]; then
    PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
    UVICORN_BIN="$BACKEND_DIR/.venv/bin/uvicorn"
    PYTEST_BIN="$BACKEND_DIR/.venv/bin/pytest"
else
    PYTHON_BIN="python3"
    UVICORN_BIN="uvicorn"
    PYTEST_BIN="pytest"
fi

if [ "$1" == "test" ]; then
    echo "Running scientific verification test suite..."
    cd "$BACKEND_DIR"
    $PYTEST_BIN -v
    exit 0
fi

echo "Starting Backend Service on http://127.0.0.1:8001 (API & Docs)..."
cd "$BACKEND_DIR"
$UVICORN_BIN app.main:app --host 127.0.0.1 --port 8001 &
BACKEND_PID=$!

echo "Starting Frontend Vite App on http://localhost:3000..."
cd "$FRONTEND_DIR"
npm run dev -- --port 3000 &
FRONTEND_PID=$!

cleanup() {
    echo ""
    echo "Shutting down Mars Food Intelligence services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "✅ Systems Operational:"
echo "   - Frontend Dashboard: http://localhost:3000"
echo "   - Backend API Docs:   http://127.0.0.1:8001/docs"
echo "   - Press Ctrl+C to terminate services"
echo ""

wait
