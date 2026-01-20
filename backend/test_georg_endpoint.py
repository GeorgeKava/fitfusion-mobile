#!/usr/bin/env python3
"""
Test with the inferred Georg connection endpoint
"""
import os
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

def test_georg_endpoint():
    """Test using the Georg connection endpoint"""
    
    # Infer endpoint from connection name: Georg-mj1to5es-eastus2
    georg_endpoint = "https://georg-mj1to5es-eastus2.openai.azure.com/"
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")
    model = "gpt-4o"
    
    print("=" * 60)
    print("Testing Georg Connection Endpoint")
    print("=" * 60)
    print(f"Endpoint: {georg_endpoint}")
    print(f"Model: {model}")
    print(f"Base URL: {georg_endpoint}openai/deployments/{model}")
    print()
    
    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            base_url=f"{georg_endpoint}openai/deployments/{model}",
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Say 'Vision API is working!' if you can process images."}
            ],
            max_tokens=50
        )
        
        result = response.choices[0].message.content
        print(f"✅ SUCCESS! Response: {result}")
        print("\n🎉 FOUND IT! Use this endpoint:")
        print(f"   AZURE_OPENAI_API_ENDPOINT={georg_endpoint}")
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        print("\nPlease check Azure AI Foundry and click 'Get endpoint' for the gpt-4o deployment")
        print("to get the exact connection endpoint URL.")

if __name__ == "__main__":
    test_georg_endpoint()
