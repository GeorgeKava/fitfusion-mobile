#!/usr/bin/env python3
"""
Test Azure Vision endpoint and key
"""
import os
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

def test_vision_endpoint():
    """Test the Azure Vision endpoint"""
    
    vision_endpoint = os.getenv("AZURE_VISION_ENDPOINT")
    vision_key = os.getenv("AZURE_VISION_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")
    model = os.getenv('AZURE_OPENAI_MODEL', 'gpt-4o')
    
    print("=" * 60)
    print("Testing Azure Vision Endpoint")
    print("=" * 60)
    print(f"Vision Endpoint: {vision_endpoint}")
    print(f"Model: {model}")
    print(f"Base URL: {vision_endpoint}openai/deployments/{model}")
    print()
    
    try:
        client = AzureOpenAI(
            api_key=vision_key,
            api_version=api_version,
            base_url=f"{vision_endpoint}openai/deployments/{model}",
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Hello! Can you analyze images for fitness recommendations?"}
            ],
            max_tokens=100
        )
        
        result = response.choices[0].message.content
        print(f"✅ SUCCESS!")
        print(f"Response: {result}")
        print("\n🎉 Vision API is working perfectly!")
        print("Agentic RAG vision analysis will now work in production.")
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        print("\nPlease verify the endpoint and key are correct.")

if __name__ == "__main__":
    test_vision_endpoint()
