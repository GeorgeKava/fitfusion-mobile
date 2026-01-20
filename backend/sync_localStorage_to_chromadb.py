"""
Script to manually add users to ChromaDB
Run this after you get the user data from localStorage
"""
import requests
import json

API_URL = "http://localhost:5001"  # Backend is running on port 5001

print("=" * 60)
print("SYNC USERS FROM LOCALSTORAGE TO CHROMADB")
print("=" * 60)
print()
print("Steps to get your localStorage data:")
print()
print("1. Open browser where you registered users")
print("2. Open Developer Console (F12 or Cmd+Option+I on Mac)")
print("3. Go to Console tab")
print("4. Run this command:")
print()
print("   JSON.stringify(JSON.parse(localStorage.getItem('registeredUsers')))")
print()
print("5. Copy the output (the entire JSON array)")
print("6. Paste it below when prompted")
print()
print("=" * 60)
print()

# Check if backend is running
try:
    test_response = requests.get(f"{API_URL}/health", timeout=2)
    print("✓ Backend server is running")
except:
    print("✗ ERROR: Backend server is not running!")
    print("  Start it with: python3 app.py")
    exit(1)

print()

response = input("Paste localStorage JSON array (or 'skip' to cancel): ")

if response.lower() != 'skip' and response.strip():
    try:
        users_data = json.loads(response)
        print(f"\nFound {len(users_data)} users in localStorage")
        print()
        
        synced = 0
        failed = 0
        
        for user in users_data:
            try:
                # Prepare profile data for backend
                profile_data = {
                    'email': user.get('email'),
                    'username': user.get('username'),
                    'name': user.get('name'),
                    'firstName': user.get('firstName', ''),
                    'lastName': user.get('lastName', ''),
                    'age': user.get('age'),
                    'weight': user.get('weight'),
                    'height': user.get('height'),
                    'gender': user.get('gender'),
                    'sex': user.get('gender'),
                    'fitnessLevel': user.get('fitnessLevel'),
                    'agentType': user.get('agentType', 'personal_trainer'),
                    'fitnessAgent': user.get('agentType', 'personal_trainer'),
                    'medicalConditions': user.get('medicalConditions', []),
                    'createdAt': user.get('createdAt'),
                    'isActive': True
                }
                
                # Send to backend
                resp = requests.post(
                    f"{API_URL}/api/create-user-profile",
                    json=profile_data,
                    headers={'Content-Type': 'application/json'}
                )
                
                if resp.ok:
                    print(f"✓ Synced: {user.get('email')} ({user.get('username')})")
                    synced += 1
                else:
                    print(f"✗ Failed: {user.get('email')} - {resp.status_code}")
                    failed += 1
                    
            except Exception as e:
                print(f"✗ Error syncing {user.get('email', 'unknown')}: {e}")
                failed += 1
        
        print()
        print("=" * 60)
        print(f"Sync complete: {synced} succeeded, {failed} failed")
        print("=" * 60)
        print()
        print("Run this to check ChromaDB: python3 check_users.py")
        
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON format - {e}")
    except Exception as e:
        print(f"Error: {e}")
else:
    print("Sync cancelled")
