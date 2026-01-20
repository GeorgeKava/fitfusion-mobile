"""
Script to sync users from localStorage backup to ChromaDB
This will help migrate users that were registered when backend was down
"""
import chromadb
import json

# Example users from localStorage - you'll need to paste the actual data
# Get this from browser console: localStorage.getItem('registeredUsers')

print("=" * 60)
print("LOCALSTORAGE TO CHROMADB SYNC UTILITY")
print("=" * 60)
print()
print("To sync users from localStorage to ChromaDB:")
print()
print("1. Open your browser where you registered users")
print("2. Open Developer Console (F12 or Cmd+Option+I)")
print("3. Run this command:")
print()
print("   localStorage.getItem('registeredUsers')")
print()
print("4. Copy the output")
print("5. Paste it when prompted below")
print()
print("=" * 60)
print()

# Check current ChromaDB state
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_collection(name="fitness_users")
current_count = collection.count()

print(f"Current users in ChromaDB: {current_count}")
print()

response = input("Do you want to paste localStorage data to sync? (yes/no): ")

if response.lower() == 'yes':
    print()
    print("Paste the localStorage data (the JSON array) and press Enter twice:")
    print()
    
    lines = []
    while True:
        line = input()
        if line == "":
            break
        lines.append(line)
    
    if lines:
        try:
            data = json.loads(''.join(lines))
            print()
            print(f"Found {len(data)} users in localStorage")
            print()
            
            # Here you would add code to insert users into ChromaDB
            # This requires the backend API endpoint or direct ChromaDB insertion
            print("To complete sync, you need to:")
            print("1. Start your backend server: python app.py")
            print("2. Make POST requests to /api/create-user-profile for each user")
            
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
else:
    print("Sync cancelled")

print()
print("=" * 60)
