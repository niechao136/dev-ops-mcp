import os
from pathlib import Path
import sqlite3
from datetime import datetime, UTC

from src.util.path import ROOT_DIR

DATA_DIR = Path(ROOT_DIR) / "data"
DB_FILE_PATH = DATA_DIR / "devops.db"


def migrate_database():
    if not DB_FILE_PATH.exists():
        print("Warning: Database file does not exist, no migration needed")
        return

    conn = sqlite3.connect(str(DB_FILE_PATH))
    cursor = conn.cursor()

    try:
        print("Checking database structure...")
        
        # Check api_tokens table
        cursor.execute("PRAGMA table_info(api_tokens)")
        api_tokens_columns = [column[1] for column in cursor.fetchall()]
        print(f"api_tokens columns: {api_tokens_columns}")
        
        if "created_at" not in api_tokens_columns:
            print("Adding created_at column to api_tokens table...")
            try:
                cursor.execute("ALTER TABLE api_tokens ADD COLUMN created_at DATETIME")
                conn.commit()
                print("Successfully added created_at column")
            except sqlite3.OperationalError as e:
                print(f"Info: {e}")
        
        # Check projects table
        cursor.execute("PRAGMA table_info(projects)")
        projects_columns = [column[1] for column in cursor.fetchall()]
        print(f"projects columns: {projects_columns}")
        
        if "created_at" not in projects_columns:
            print("Adding created_at column to projects table...")
            try:
                cursor.execute("ALTER TABLE projects ADD COLUMN created_at DATETIME")
                conn.commit()
                print("Successfully added created_at column")
            except sqlite3.OperationalError as e:
                print(f"Info: {e}")
        
        # Check commands table
        cursor.execute("PRAGMA table_info(commands)")
        commands_columns = [column[1] for column in cursor.fetchall()]
        print(f"commands columns: {commands_columns}")
        
        if "created_at" not in commands_columns:
            print("Adding created_at column to commands table...")
            try:
                cursor.execute("ALTER TABLE commands ADD COLUMN created_at DATETIME")
                conn.commit()
                print("Successfully added created_at column")
            except sqlite3.OperationalError as e:
                print(f"Info: {e}")
        
        if "default_params" not in commands_columns:
            print("Adding default_params column to commands table...")
            try:
                cursor.execute("ALTER TABLE commands ADD COLUMN default_params TEXT")
                conn.commit()
                print("Successfully added default_params column")
            except sqlite3.OperationalError as e:
                print(f"Info: {e}")
        
        print("\nDatabase migration completed!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_database()
