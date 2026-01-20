#!/usr/bin/env python3
"""
List all user accounts stored in ChromaDB
"""

from vector_store import FitnessVectorStore
import json

def list_all_accounts():
    """List all user accounts from ChromaDB"""
    print("🔍 Connecting to ChromaDB...")
    
    # Initialize vector store
    vs = FitnessVectorStore()
    
    # Get all users from the collection
    print("\n📊 Fetching all user accounts...")
    results = vs.users_collection.get()
    
    if not results['ids']:
        print("❌ No user accounts found in ChromaDB")
        return
    
    print(f"\n✅ Found {len(results['ids'])} user accounts\n")
    print("=" * 80)
    
    # Display each user
    for i, (user_id, metadata) in enumerate(zip(results['ids'], results['metadatas']), 1):
        print(f"\n👤 Account #{i}")
        print(f"ID: {user_id}")
        print(f"Email: {metadata.get('email', 'N/A')}")
        print(f"Username: {metadata.get('username', 'N/A')}")
        print(f"Name: {metadata.get('firstName', '')} {metadata.get('middleName', '')} {metadata.get('lastName', '')}".strip())
        print(f"Age: {metadata.get('age', 'N/A')}")
        print(f"Gender: {metadata.get('gender', 'N/A')}")
        print(f"Weight: {metadata.get('weight', 'N/A')} lbs")
        print(f"Height: {metadata.get('height', 'N/A')} inches")
        print(f"Fitness Level: {metadata.get('fitnessLevel', 'N/A')}")
        print(f"Coach Type: {metadata.get('agentType', 'N/A')}")
        print(f"Medical Conditions: {metadata.get('medicalConditions', 'None')}")
        print(f"Created: {metadata.get('created_at', 'N/A')}")
        print(f"Has Password: {'Yes' if metadata.get('password') else 'No'}")
        print("-" * 80)
    
    # Summary
    print(f"\n📈 Summary:")
    print(f"Total Accounts: {len(results['ids'])}")
    
    # Count by fitness level
    fitness_levels = {}
    for metadata in results['metadatas']:
        level = metadata.get('fitnessLevel', 'Unknown')
        fitness_levels[level] = fitness_levels.get(level, 0) + 1
    
    print(f"\nBy Fitness Level:")
    for level, count in sorted(fitness_levels.items()):
        print(f"  - {level}: {count}")
    
    # Count by coach type
    coach_types = {}
    for metadata in results['metadatas']:
        coach = metadata.get('agentType', 'Unknown')
        coach_types[coach] = coach_types.get(coach, 0) + 1
    
    print(f"\nBy Coach Type:")
    for coach, count in sorted(coach_types.items()):
        print(f"  - {coach}: {count}")
    
    return results

if __name__ == "__main__":
    list_all_accounts()
