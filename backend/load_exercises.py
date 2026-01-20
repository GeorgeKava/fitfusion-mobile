#!/usr/bin/env python3
"""
Load exercises from megaGymDataset.csv into ChromaDB
Run this once to populate the exercise database
"""

import os
from vector_store import vector_store

def main():
    print("=" * 60)
    print("Exercise Database Loader")
    print("=" * 60)
    
    # Path to the dataset
    csv_path = os.path.join(os.path.dirname(__file__), 'datasets', 'megaGymDataset.csv')
    
    if not os.path.exists(csv_path):
        print(f"❌ Dataset not found at: {csv_path}")
        return False
    
    print(f"📂 Dataset found: {csv_path}")
    print(f"📊 Current exercise count: {vector_store.exercise_collection.count()}")
    
    # Ask for confirmation if exercises already exist
    current_count = vector_store.exercise_collection.count()
    if current_count > 0:
        response = input(f"\n⚠️  Warning: {current_count} exercises already exist. Reload? (yes/no): ")
        if response.lower() != 'yes':
            print("❌ Cancelled")
            return False
        
        print("🗑️  Clearing existing exercises...")
        # Clear the collection
        try:
            vector_store.client.delete_collection("exercise_database")
            vector_store.exercise_collection = vector_store.client.get_or_create_collection(
                name="exercise_database",
                embedding_function=vector_store.embedding_fn,
                metadata={"description": "Exercise database for RAG recommendations"}
            )
            print("✅ Cleared existing exercises")
        except Exception as e:
            print(f"⚠️  Could not clear collection: {e}")
    
    # Load exercises
    print("\n📥 Loading exercises into ChromaDB...")
    success = vector_store.load_exercises_from_csv(csv_path)
    
    if success:
        print("\n" + "=" * 60)
        print("✅ SUCCESS!")
        print("=" * 60)
        print(f"Total exercises loaded: {vector_store.exercise_collection.count()}")
        
        # Test search
        print("\n🧪 Testing search functionality...")
        test_results = vector_store.search_exercises("chest exercises for beginners", top_k=3)
        print(f"Found {len(test_results)} results for 'chest exercises for beginners'")
        if test_results:
            print("\nTop result:")
            print(f"  Title: {test_results[0]['metadata']['title']}")
            print(f"  Body Part: {test_results[0]['metadata']['body_part']}")
            print(f"  Equipment: {test_results[0]['metadata']['equipment']}")
            print(f"  Level: {test_results[0]['metadata']['level']}")
        
        return True
    else:
        print("\n❌ Failed to load exercises")
        return False

if __name__ == "__main__":
    main()
