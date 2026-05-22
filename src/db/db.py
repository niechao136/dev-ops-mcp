from contextlib import contextmanager
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.util.path import ROOT_DIR

from .orm import Base


DATA_DIR = Path(ROOT_DIR) / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_FILE_PATH = DATA_DIR / "devops.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE_PATH}"


engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)


@contextmanager
def get_db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
