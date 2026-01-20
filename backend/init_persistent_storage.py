#!/usr/bin/env python3
"""
Initialize Azure File Share with ChromaDB data from Docker image
This copies the 2,918 exercises to persistent storage
"""

import os
import shutil
from pathlib import Path

def init_persistent_storage():
    """Copy ChromaDB data to persistent storage if it's empty"""
    
    # Check if we're in a container with mounted Azure File Share
    persistent_path = Path("/app/chroma_db")
    backup_path = Path("/app/chroma_db_backup")
    
    # If persistent storage exists and is empty, copy from backup
    if persistent_path.exists():
        # Count files in persistent storage
        files = list(persistent_path.glob("*"))
        
        if len(files) == 0:
            print("📦 Persistent storage is empty - initializing with exercise database")
            
            # Check if backup exists (should be in Docker image)
            if backup_path.exists():
                print(f"✅ Found backup at {backup_path}")
                # Copy all files from backup to persistent storage
                for item in backup_path.glob("*"):
                    dest = persistent_path / item.name
                    if item.is_file():
                        shutil.copy2(item, dest)
                        print(f"   Copied {item.name}")
                    elif item.is_dir():
                        shutil.copytree(item, dest)
                        print(f"   Copied directory {item.name}")
                
                print("✅ Persistent storage initialized with 2,918 exercises")
            else:
                print(f"⚠️ No backup found at {backup_path}")
        else:
            print(f"✅ Persistent storage already has {len(files)} items")
    else:
        print(f"⚠️ Persistent storage path {persistent_path} not found")

if __name__ == "__main__":
    init_persistent_storage()
