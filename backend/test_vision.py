#!/usr/bin/env python3
"""
Test Azure OpenAI Vision API
"""
import os
from dotenv import load_dotenv
from openai import AzureOpenAI
import base64

load_dotenv()

def test_vision():
    """Test if Azure OpenAI vision works"""
    
    # Method 1: Without base_url (should fail with DeploymentNotFound)
    print("=" * 60)
    print("Testing Method 1: Without base_url deployment path")
    print("=" * 60)
    try:
        client1 = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview"),
            azure_endpoint=os.getenv("AZURE_OPENAI_API_ENDPOINT")
        )
        
        response1 = client1.chat.completions.create(
            model=os.getenv("AZURE_OPENAI_MODEL", "gpt-4o"),
            messages=[
                {"role": "user", "content": "Hello, can you see images?"}
            ],
            max_tokens=100
        )
        print(f"✅ Method 1 SUCCESS: {response1.choices[0].message.content[:100]}")
    except Exception as e:
        print(f"❌ Method 1 FAILED: {e}")
    
    # Method 2: With base_url (like ai.py)
    print("\n" + "=" * 60)
    print("Testing Method 2: With base_url deployment path")
    print("=" * 60)
    try:
        model = os.getenv('AZURE_OPENAI_MODEL', 'gpt-4o')
        azure_endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
        
        client2 = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview"),
            base_url=f"{azure_endpoint}openai/deployments/{model}",
        )
        
        response2 = client2.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Hello, can you see images?"}
            ],
            max_tokens=100
        )
        print(f"✅ Method 2 SUCCESS: {response2.choices[0].message.content[:100]}")
    except Exception as e:
        print(f"❌ Method 2 FAILED: {e}")
    
    print("\n" + "=" * 60)
    print("Configuration Info:")
    print("=" * 60)
    print(f"AZURE_OPENAI_API_ENDPOINT: {os.getenv('AZURE_OPENAI_API_ENDPOINT')}")
    print(f"AZURE_OPENAI_MODEL: {os.getenv('AZURE_OPENAI_MODEL')}")
    print(f"AZURE_OPENAI_API_VERSION: {os.getenv('AZURE_OPENAI_API_VERSION')}")

if __name__ == "__main__":
    test_vision()
