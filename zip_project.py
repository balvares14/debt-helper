import zipfile
import os
from pathlib import Path
import sys

# Define the project directory and output zip file
project_dir = Path.cwd()
zip_path = project_dir / "deploy.zip"

# Patterns to exclude (relative to project directory)
exclude_patterns = [
    "node_modules/*",
    "client/node_modules/*",
    ".git/*",
    "*.zip",
    "zip_project.py",
    "copy-project.py"
]

def should_exclude(file_path, project_dir, exclude_patterns):
    """Check if a file or directory should be excluded based on patterns."""
    rel_path = str(file_path.relative_to(project_dir)).replace("\\", "/")
    for pattern in exclude_patterns:
        # Convert pattern to use forward slashes for consistency
        pattern = pattern.replace("\\", "/")
        # Handle wildcards
        if pattern.endswith("/*"):
            # Exclude entire directory and its contents
            dir_name = pattern[:-2]
            if rel_path.startswith(dir_name) or rel_path == dir_name.split("/")[-1]:
                return True
        elif pattern.startswith("*."):
            # Exclude files with specific extension
            if file_path.name.lower().endswith(pattern[1:].lower()):
                return True
        else:
            # Exact file match
            if rel_path == pattern or file_path.name == pattern:
                return True
    return False

def create_zip(project_dir, zip_path, exclude_patterns):
    """Create a zip file of the project directory, excluding specified patterns."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file_path in project_dir.rglob("*"):
            if file_path.is_file() and not should_exclude(file_path, project_dir, exclude_patterns):
                # Write file to zip with path relative to project directory
                rel_path = file_path.relative_to(project_dir)
                zipf.write(file_path, rel_path)
                print(f"Added: {rel_path}")

if __name__ == "__main__":
    print(f"Creating zip file: {zip_path}")
    create_zip(project_dir, zip_path, exclude_patterns)
    print("Zip file created successfully!")
    sys.exit(0)  # Exit the script cleanly