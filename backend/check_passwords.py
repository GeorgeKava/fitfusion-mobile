"""
Check User Passwords Script
Verify if users have plain-text or hashed passwords
"""

import os
from dotenv import load_dotenv
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

load_dotenv()

def check_passwords():
    """Check password status for all users"""
    try:
        # Initialize Azure Search client
        search_endpoint = os.getenv('AZURE_SEARCH_ENDPOINT')
        search_key = os.getenv('AZURE_SEARCH_ADMIN_KEY') or os.getenv('AZURE_SEARCH_KEY')
        index_name = os.getenv('AZURE_SEARCH_USER_DATA_INDEX', 'user_data')
        
        if not search_endpoint or not search_key:
            print("❌ Azure Search credentials not found")
            return
        
        credential = AzureKeyCredential(search_key)
        client = SearchClient(
            endpoint=search_endpoint,
            index_name=index_name,
            credential=credential
        )
        
        print("\n🔍 Checking user passwords...\n")
        
        # Get all user credentials
        results = client.search(
            search_text="*",
            filter="data_type eq 'user_credentials'",
            top=1000
        )
        
        total = 0
        hashed = 0
        plain_text = 0
        
        for result in results:
            total += 1
            email = result.get('user_email', 'unknown')
            
            # Try to get password field
            password_field = None
            for key in result.keys():
                if 'password' in key.lower():
                    password_field = key
                    break
            
            if password_field:
                pwd = result.get(password_field, '')
                if pwd.startswith('$2b$'):
                    print(f"✅ {email} - Hashed (bcrypt)")
                    hashed += 1
                else:
                    print(f"⚠️  {email} - Plain text: {pwd[:20]}...")
                    plain_text += 1
            else:
                print(f"❌ {email} - No password field found")
        
        print(f"\n📊 Summary:")
        print(f"   Total users: {total}")
        print(f"   Hashed passwords: {hashed}")
        print(f"   Plain-text passwords: {plain_text}")
        
        if plain_text == 0:
            print("\n✅ All passwords are already hashed! No migration needed.")
        else:
            print(f"\n⚠️  {plain_text} users need password migration")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("=" * 60)
    print("  User Password Check")
    print("=" * 60)
    check_passwords()
