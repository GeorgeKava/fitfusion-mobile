#!/usr/bin/env python3
"""
Test the exact same Azure OpenAI initialization as ai.py
"""
import os
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

def test_ai_py_pattern():
    """Test using the exact same pattern as ai.py"""
    
    azure_endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
    api_key = os.getenv("AZURE_OPENAI_API_KEY")
    api_version = os.getenv("AZURE_OPENAI_API_VERSION")
    model = os.getenv('AZURE_OPENAI_MODEL')
    
    print("=" * 60)
    print("Testing ai.py Pattern (Same as Food Identification)")
    print("=" * 60)
    print(f"Endpoint: {azure_endpoint}")
    print(f"Model: {model}")
    print(f"Base URL: {azure_endpoint}openai/deployments/{model}")
    print()
    
    try:
        client = AzureOpenAI(
            api_key=api_key,
            api_version=api_version,
            base_url=f"{azure_endpoint}openai/deployments/{model}",
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
        print("\n🎉 This is the correct configuration!")
        print("Vision analysis should now work in agentic RAG.")
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        print("\nThe deployment 'gpt-4o' might not exist at this endpoint.")
        print("Check Azure AI Foundry to get the correct connection endpoint.")

if __name__ == "__main__":
    test_ai_py_pattern()
