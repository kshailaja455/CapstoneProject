import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()
backend_env = Path(__file__).resolve().parent.parent / "backend" / ".env"
if backend_env.exists():
    load_dotenv(backend_env)

MONGO_URI = os.getenv("MONGO_URI") or os.getenv("MONGODB_URI") or "mongodb://127.0.0.1:27017/news-pulse"
MONGO_DB = os.getenv("MONGO_DB", "news-pulse")
MAX_ARTICLES_FOR_CLUSTERING = int(os.getenv("MAX_ARTICLES_FOR_CLUSTERING", "200"))
SIMILARITY_THRESHOLD = float(os.getenv("SIMILARITY_THRESHOLD", "0.26"))
REQUEST_TIMEOUT_SECONDS = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "15"))
