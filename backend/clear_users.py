#!/usr/bin/env python3
"""
Clear all users from ChromaDB
Use this to start fresh with a clean database
"""

import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

from vector_store import FitnessVectorStore

def clear_all_users():
    """Clear all user accounts from ChromaDB"""
    print("\n🗑️  Clearing all users from ChromaDB...\n")
    
    # Initialize vector store
    store = FitnessVectorStore()
    
    # Get all users
    try:
        all_users = store.users_collection.get()
        user_count = len(all_users['ids'])
        
        if user_count == 0:
            print("ℹ️  No users found in database. Already empty!")
            return
        
        print(f"📊 Found {user_count} user(s) in database:")
        for i, user_id in enumerate(all_users['ids'], 1):
            metadata = all_users['metadatas'][i-1] if all_users['metadatas'] else {}
            name = metadata.get('name', 'Unknown')
            print(f"   {i}. {user_id} ({name})")
        
        # Confirm deletion
        print(f"\n⚠️  WARNING: This will permanently delete all {user_count} user(s)!")
        confirmation = input("Type 'DELETE' to confirm: ")
        
        if confirmation.strip() != 'DELETE':
            print("\n❌ Cancelled. No users were deleted.")
            return
        
        # Delete all users
        store.users_collection.delete(ids=all_users['ids'])
        
        # Verify deletion
        remaining = store.users_collection.get()
        if len(remaining['ids']) == 0:
            print(f"\n✅ Successfully deleted {user_count} user(s)!")
            print("📦 ChromaDB is now empty and ready for fresh registrations.")
        else:
            print(f"\n⚠️  Warning: {len(remaining['ids'])} user(s) still remain in database.")
    
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        raise

if __name__ == "__main__":
    clear_all_users()
