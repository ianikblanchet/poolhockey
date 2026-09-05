from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

try:
    from .config import Config
except ImportError:
    from config import Config

# Modifiez l'URL pour PostgreSQL en production. SQLite est utilisé ici pour faciliter vos tests locaux.
#DATABASE_URL = "sqlite:///./hockey_pool.db"

engine = create_engine(Config.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()