#!/bin/bash
# Nexus IT Platform — Startup Script

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        NEXUS IT SUPPORT PLATFORM             ║"
echo "║   AI-Driven Ticket Automation System         ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "❌ Python 3 is required. Please install it first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pip install flask scikit-learn pandas numpy joblib werkzeug --break-system-packages -q

# Train models if not present
if [ ! -f "models/category_model.pkl" ]; then
    echo "🧠 Training ML models from dataset..."
    python3 train_models.py
else
    echo "✅ ML models already trained"
fi

echo ""
echo "🚀 Starting Nexus IT Platform..."
echo "🌐 Open http://localhost:5000 in your browser"
echo ""
echo "Demo accounts you can create at /signup"
echo "Press CTRL+C to stop"
echo ""

python3 app.py
