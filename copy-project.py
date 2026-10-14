import shutil
import os
import sys

def copy_project(src, dst):
    """Copy files and directories from src to dst, excluding node_modules folders and the root versions folder."""
    try:
        # Normalize paths for Windows compatibility
        src = os.path.normpath(os.path.abspath(src))
        dst = os.path.normpath(os.path.abspath(dst))
        
        # Ensure destination directory exists
        os.makedirs(dst, exist_ok=True)
        
        root_dir = os.path.normpath(os.path.abspath(os.path.dirname(__file__)))
        root_node_modules = os.path.normpath(os.path.join(root_dir, 'node_modules'))
        client_node_modules = os.path.normpath(os.path.join(root_dir, 'client', 'node_modules'))
        # Skip the versions folder at the root so copies don't nest inside it
        root_versions = os.path.normpath(os.path.join(root_dir, 'versions'))
        
        for item in os.listdir(src):
            src_path = os.path.normpath(os.path.join(src, item))
            dst_path = os.path.normpath(os.path.join(dst, item))
            
            if src_path in (root_node_modules, client_node_modules, root_versions):
                continue
                
            try:
                if os.path.isdir(src_path):
                    copy_project(src_path, dst_path)
                else:
                    shutil.copy2(src_path, dst_path)
            except (shutil.Error, OSError):
                continue
                
    except Exception as e:
        print(f"Error copying {src}: {str(e)}")
        sys.exit(1)

def main():
    """Main function to copy the project folder when double-clicked."""
    try:
        # Source is the directory containing this script
        source_dir = os.path.normpath(os.path.dirname(__file__))
        # Destination is <project_name>_copy in the same directory
        project_name = os.path.basename(source_dir)
        parent_dir = os.path.dirname(source_dir)
        dest_dir = os.path.join(parent_dir, f"{project_name}_copy")
        
        print(f"Copying from {source_dir} to {dest_dir}")
        copy_project(source_dir, dest_dir)
        print("Copy completed successfully!")
        
    except Exception as e:
        print(f"Copy failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()