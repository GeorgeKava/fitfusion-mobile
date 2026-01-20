"""
Migration Script: Hash Existing Plain-Text Passwords
Run this ONCE to convert existing plain-text passwords to bcrypt hashes

⚠️ IMPORTANT: 
- This will update all users in Azure Search
- Existing users will need to use their original passwords (which will now be hashed)
- Run this before deploying the new security updates
"""

import sys
import os
from datetime import datetime

# Add parent directory to path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import only what we need
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# Import Azure Search client directly
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient

class PasswordHasher:
    """Handles password hashing and verification using bcrypt"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password using bcrypt"""
        if not password:
            raise ValueError("Password cannot be empty")
        
        # Generate salt and hash password
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
        
        # Return as string for storage
        return hashed.decode('utf-8')

def migrate_passwords():
    """Migrate all plain-text passwords to bcrypt hashes"""
    try:
        # Initialize Azure Search client directly
        search_endpoint = os.getenv('AZURE_SEARCH_ENDPOINT')
        search_key = os.getenv('AZURE_SEARCH_ADMIN_KEY') or os.getenv('AZURE_SEARCH_KEY')
        index_name = os.getenv('AZURE_SEARCH_USER_DATA_INDEX') or os.getenv('USER_DATA_INDEX', 'user_data')
        
        if not search_endpoint or not search_key:
            print("❌ Azure Search credentials not found in .env file")
            print("   Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_ADMIN_KEY")
            return False
        
        # Create search client
        credential = AzureKeyCredential(search_key)
        user_data_search_client = SearchClient(
            endpoint=search_endpoint,
            index_name=index_name,
            credential=credential
        )
        
        if not user_data_search_client:
            print("❌ Azure Search client not available")
            return False
        
        print("🔍 Searching for users with plain-text passwords...")
        
        # Get all user credentials
        results = user_data_search_client.search(
            search_text="*",
            filter="data_type eq 'user_credentials'",
            select=["id", "user_email", "password"],
            top=1000
        )
        
        users_to_update = []
        total_users = 0
        
        for result in results:
            total_users += 1
            user = dict(result)
            email = user.get('user_email')
            password = user.get('password', '')
            
            # Check if password is already hashed (bcrypt hashes start with $2b$)
            if password and not password.startswith('$2b$'):
                print(f"  📝 Found plain-text password for: {email}")
                
                # Hash the password
                try:
                    hashed = PasswordHasher.hash_password(password)
                    user['password'] = hashed
                    user['password_migrated'] = True
                    user['password_migrated_at'] = datetime.utcnow().isoformat() + "Z"
                    users_to_update.append(user)
                    print(f"  ✅ Hashed password for: {email}")
                except Exception as e:
                    print(f"  ❌ Error hashing password for {email}: {e}")
            else:
                print(f"  ⏭️  Already hashed: {email}")
        
        print(f"\n📊 Found {total_users} total users")
        print(f"🔄 Need to update {len(users_to_update)} users")
        
        if not users_to_update:
            print("✅ All passwords are already hashed!")
            return True
        
        # Confirm before updating
        confirm = input(f"\n⚠️  Update {len(users_to_update)} user passwords? (yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ Migration cancelled")
            return False
        
        # Update documents in batches
        print("\n🔄 Updating passwords in Azure Search...")
        batch_size = 100
        
        for i in range(0, len(users_to_update), batch_size):
            batch = users_to_update[i:i + batch_size]
            try:
                result = user_data_search_client.merge_documents(batch)
                success_count = sum(1 for r in result if r.succeeded)
                print(f"  ✅ Updated batch {i//batch_size + 1}: {success_count}/{len(batch)} succeeded")
            except Exception as e:
                print(f"  ❌ Error updating batch: {e}")
        
        print("\n🎉 Password migration complete!")
        print("\n⚠️  IMPORTANT NOTES:")
        print("   - Users can still login with their original passwords")
        print("   - Passwords are now securely hashed with bcrypt")
        print("   - The migration added 'password_migrated' field to track updates")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("  Password Migration Script")
    print("  Converting plain-text passwords to bcrypt hashes")
    print("=" * 60)
    print()
    
    success = migrate_passwords()
    
    if success:
        print("\n✅ Migration completed successfully!")
        sys.exit(0)
    else:
        print("\n❌ Migration failed!")
        sys.exit(1)
