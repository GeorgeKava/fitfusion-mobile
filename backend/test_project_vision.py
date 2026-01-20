#!/usr/bin/env python3
"""
Test Azure AI Foundry Project Endpoint for Vision
"""
import os
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()

def test_project_vision():
    """Test if Azure AI Foundry project endpoint works for vision"""
    
    print("=" * 60)
    print("Testing Azure AI Foundry Project Endpoint")
    print("=" * 60)
    
    try:
        model = os.getenv('AZURE_OPENAI_MODEL', 'gpt-4o')
        project_endpoint = os.getenv("PROJECT_ENDPOINT")
        
        print(f"Project Endpoint: {project_endpoint}")
        print(f"Model: {model}")
        print(f"Base URL: {project_endpoint}/openai/deployments/{model}")
        print()
        
        client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview"),
            base_url=f"{project_endpoint}/openai/deployments/{model}",
        )
        
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "user", "content": "Hello! Can you analyze images?"}
            ],
            max_tokens=100
        )
        
        print(f"✅ SUCCESS!")
        print(f"Response: {response.choices[0].message.content}")
        print("\n🎉 Vision API is working! The agentic RAG should now work properly.")
        
    except Exception as e:
        print(f"❌ FAILED: {e}")
        print("\nThis means the deployment might have a different name.")
        print("Check your Azure AI Foundry project for the actual deployment name.")

if __name__ == "__main__":
    test_project_vision()
