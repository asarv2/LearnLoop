# server/scripts/generate_models.py
import os
import re
import subprocess
import sys
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def generate_sqlmodel_from_sql():
    """Generate SQLModel classes from SQL schema using sqlacodegen"""
    python_executable = sys.executable
    
    # Use the same environment variable pattern as db.py
    db_user = os.getenv("DB_USER")
    db_password = os.getenv("DB_PASSWORD")
    db_host = os.getenv("DB_HOST")
    db_port = os.getenv("DB_PORT")
    db_name = os.getenv("DB_NAME")
    
    db_url = f"postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}?sslmode=require"

    if not all([db_user, db_password, db_name, db_host, db_port]):
        print("Error: Database environment variables are not properly set")
        print("Required variables: user, password, host, port, dbname")
        sys.exit(1)

    print(f"Using database URL: {db_url}")

    cmd = [python_executable, "-m", "sqlacodegen", "--generator=sqlmodels", db_url]

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        generated_code = result.stdout

        import_lines = [
            "import uuid",
            "from datetime import datetime, timezone",
            "from typing import Any, Dict, List, Optional",
            "",
            "from sqlalchemy import (ARRAY, Boolean, CheckConstraint, Column, Computed,",
            "                        DateTime, Double, Enum, ForeignKeyConstraint, Index,",
            "                        Integer, PrimaryKeyConstraint, SmallInteger, String,",
            "                        Text, UniqueConstraint, Uuid, text)",
            "from sqlalchemy.dialects.postgresql import JSONB",
            "from sqlalchemy.orm import Mapped",
            "from sqlmodel import Field, Relationship, SQLModel",
        ]

        import_section = "\n".join(import_lines)

        lines = generated_code.split("\n")
        class_start_idx = 0
        for i, line in enumerate(lines):
            if "SQLModel" in line and line.strip().startswith("class "):
                class_start_idx = i
                break

        class_definitions = "\n".join(lines[class_start_idx:])

        base_class = '\nclass _Base(SQLModel):\n    """Shared config so Pydantic will accept SQLAlchemy types."""\n    model_config = {"arbitrary_types_allowed": True}\n'
        class_definitions = base_class + class_definitions
        class_definitions = re.sub(
            r"class (\w+)\(SQLModel, table=True\):",
            r"class \1(_Base, table=True):",
            class_definitions,
        )

        print("Applying type transformations...")

        # --- Convert Postgres-specific defaults to portable Python equivalents ---
        class_definitions = re.sub(
            r"server_default=text\('gen_random_uuid\(\)'\)",
            "default_factory=uuid.uuid4",
            class_definitions,
        )
        class_definitions = re.sub(
            r"server_default=text\('now\(\)'\)",
            "default_factory=datetime.utcnow",
            class_definitions,
        )
        class_definitions = re.sub(
            r"server_default=text\(\"'{}'::jsonb\"\)",
            "default_factory=dict",
            class_definitions,
        )
        class_definitions = re.sub(
            r"server_default=text\('ARRAY\[\]::uuid\[\]'\)",
            "default_factory=list",
            class_definitions,
        )
        class_definitions = re.sub(
            r"server_default=text\(\"'([\w\s]+)'::[\w\s]+\"\)",
            r"default=r'\1'",
            class_definitions,
        )
        class_definitions = re.sub(
            r"server_default=text\('false'\)", "default=False", class_definitions
        )
        class_definitions = re.sub(
            r"server_default=text\('true'\)", "default=True", class_definitions
        )
        class_definitions = re.sub(
            r"server_default=text\('([\d\.]+)'\)", r"default=\1", class_definitions
        )

        # ✅ FINAL VERSION: Robustly move default_factory and handle defaults
        processed_lines = []
        for line in class_definitions.split("\n"):
            factory_match = re.search(r"default_factory=([\w\.]+)", line)

            # Check if a line has a default_factory that needs to be moved
            if factory_match and "sa_column=Column" in line:
                factory_string = factory_match.group(
                    0
                )  # e.g., "default_factory=uuid.uuid4"

                # 1. Remove the original default_factory from the Column definition
                cleaned_line = line.replace(f", {factory_string}", "")
                cleaned_line = cleaned_line.replace(factory_string, "")

                # 2. Check if the Field already has a 'default=None'
                if "default=None" in cleaned_line:
                    # If it does, replace 'default=None' with the factory
                    final_line = cleaned_line.replace("default=None", factory_string)
                else:
                    # Otherwise, add the factory to the Field call
                    # This correctly handles cases like the id field
                    final_line = re.sub(
                        r"sa_column=", f"{factory_string}, sa_column=", cleaned_line, 1
                    )

                processed_lines.append(final_line)
            else:
                # If the line doesn't need changes, add it as is
                processed_lines.append(line)

        class_definitions = "\n".join(processed_lines)

        # Correct type hints and other formatting
        class_definitions = re.sub(
            r": uuid\.UUID", r": Mapped[uuid.UUID]", class_definitions
        )
        class_definitions = re.sub(r": UUID", r": Mapped[uuid.UUID]", class_definitions)
        class_definitions = re.sub(
            r": Optional\[UUID\]", r": Optional[uuid.UUID]", class_definitions
        )
        class_definitions = re.sub(r": list", r": List[uuid.UUID]", class_definitions)
        class_definitions = re.sub(
            r": Optional\[list\]", r": Optional[List[uuid.UUID]]", class_definitions
        )
        class_definitions = re.sub(r": dict", r": Dict[str, Any]", class_definitions)
        class_definitions = re.sub(
            r": Optional\[dict\]", r": Optional[Dict[str, Any]]", class_definitions
        )
        class_definitions = class_definitions.replace(
            "ARRAY(Uuid())", "ARRAY(Uuid(as_uuid=True))"
        )
        class_definitions = class_definitions.replace(
            ", Uuid)", ", Uuid(as_uuid=True))"
        )

        final_code = import_section + class_definitions

        final_code = final_code.replace(
            "datetime.utcnow", "lambda: datetime.now(timezone.utc)"
        )

        output_path = "app/models.py"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w") as f:
            f.write(final_code)

        print(f"SQLModel classes generated successfully and saved to {output_path}!")
        print("Applied transformations:")
        print("- Made default values database-agnostic")
        print("- Corrected type hints and Field definitions")

    except subprocess.CalledProcessError as e:
        print(f"Error generating SQLModel classes: {e}")
        print(f"Error output: {e.stderr}")
        sys.exit(1)


if __name__ == "__main__":
    generate_sqlmodel_from_sql()
