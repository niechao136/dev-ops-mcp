import os
from pathlib import Path
import sqlite3
from datetime import datetime, UTC

from src.utils.path import ROOT_DIR

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
        
        if "is_health_check" not in commands_columns:
            print("Adding is_health_check column to commands table...")
            try:
                cursor.execute("ALTER TABLE commands ADD COLUMN is_health_check INTEGER DEFAULT 0")
                conn.commit()
                print("Successfully added is_health_check column")
            except sqlite3.OperationalError as e:
                print(f"Info: {e}")
        
        if "work_dir" not in commands_columns:
            print("Adding work_dir column to commands table...")
            try:
                cursor.execute("ALTER TABLE commands ADD COLUMN work_dir VARCHAR(255)")
                conn.commit()
                print("Successfully added work_dir column")
            except sqlite3.OperationalError as e:
                print(f"Info: {e}")

        # Check and create public_commands table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='public_commands'")
        if not cursor.fetchone():
            print("Creating public_commands table...")
            cursor.execute("""
                CREATE TABLE public_commands (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(100) NOT NULL,
                    action_type VARCHAR(50) NOT NULL,
                    description TEXT,
                    shell_command TEXT NOT NULL,
                    timeout INTEGER DEFAULT 600,
                    default_params TEXT,
                    tags TEXT,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME,
                    updated_at DATETIME
                )
            """)
            conn.commit()
            print("Successfully created public_commands table")
        else:
            print("public_commands table already exists")

        # Check and create tasks table
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'")
        if not cursor.fetchone():
            print("Creating tasks table...")
            cursor.execute("""
                CREATE TABLE tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task_id VARCHAR(64) NOT NULL UNIQUE,
                    project_name VARCHAR(100) NOT NULL,
                    action VARCHAR(50) NOT NULL,
                    status VARCHAR(20) DEFAULT 'pending',
                    output_log TEXT,
                    start_time DATETIME,
                    end_time DATETIME,
                    timeout INTEGER DEFAULT 600,
                    actor_type VARCHAR(20) NOT NULL,
                    actor_id INTEGER NOT NULL,
                    command_details TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("CREATE INDEX idx_tasks_task_id ON tasks(task_id)")
            cursor.execute("CREATE INDEX idx_tasks_project_name ON tasks(project_name)")
            cursor.execute("CREATE INDEX idx_tasks_status ON tasks(status)")
            cursor.execute("CREATE INDEX idx_tasks_created_at ON tasks(created_at)")
            conn.commit()
            print("Successfully created tasks table")
        else:
            print("tasks table already exists")

        print("\nDatabase migration completed!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    migrate_database()
