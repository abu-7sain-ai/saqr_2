import sys
import os

# Add backend root to path so "backend.main" imports work correctly on Vercel
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.main import app
