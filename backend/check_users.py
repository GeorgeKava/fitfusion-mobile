import chromadb
from chromadb.config import Settings

# Initialize ChromaDB client
client = chromadb.PersistentClient(path="./chroma_db")

try:
    # List all collections
    collections = client.list_collections()
    print(f"Available collections: {[c.name for c in collections]}")
    print()
    
    # Try to get the user profiles collection
    collection = client.get_collection(name="fitness_users")
    
    # Get count of all documents
    count = collection.count()
    print(f"Total users in ChromaDB: {count}")
    print()
    
    if count > 0:
        # Get all user data
        results = collection.get()
        
        print(f"User IDs: {results['ids']}")
        print()
        
        # Print metadata for each user
        if results['metadatas']:
            print("User Details:")
            print("-" * 60)
            for idx, metadata in enumerate(results['metadatas']):
                print(f"\n{idx + 1}. User ID: {results['ids'][idx]}")
                print(f"   Email: {metadata.get('email', 'N/A')}")
                print(f"   Username: {metadata.get('username', 'N/A')}")
                print(f"   Name: {metadata.get('name', 'N/A')}")
                print(f"   Age: {metadata.get('age', 'N/A')}")
                print(f"   Gender: {metadata.get('gender', 'N/A')}")
                print(f"   Fitness Level: {metadata.get('fitnessLevel', 'N/A')}")
    else:
        print("No users found in the database yet.")
            
except Exception as e:
    print(f"Error: {e}")
    print("\nThe 'fitness_users' collection might not exist yet.")
    print("Users will be added to ChromaDB when they register through the app.")
