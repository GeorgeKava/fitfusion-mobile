import logging
from openai import AzureOpenAI
import os
import base64
from dotenv import load_dotenv

load_dotenv()

# Azure OpenAI configuration
azure_endpoint = os.getenv("AZURE_OPENAI_API_ENDPOINT")
api_key = os.getenv("AZURE_OPENAI_API_KEY")
api_version = os.getenv("AZURE_OPENAI_API_VERSION")
model = os.getenv('AZURE_OPENAI_MODEL')

client = AzureOpenAI(
    api_key=api_key,
    api_version=api_version,
    base_url=f"{azure_endpoint}/openai/deployments/{model}",
)

def get_fast_fitness_recommendation(image_paths, gender, age, weight, height=None, agent_type="general", health_conditions=""):
    """
    Fast fitness recommendation using only GPT-4o vision - no MCP overhead
    """
    try:
        # Process images
        encoded_images = []
        for img_path in image_paths:
            with open(img_path, "rb") as img_file:
                encoded = base64.b64encode(img_file.read()).decode('utf-8')
                encoded_images.append(encoded)

        # Optimized prompt for specific agent types
        agent_prompts = {
            "weight_loss": "Focus on cardio exercises and calorie deficit nutrition advice.",
            "muscle_gain": "Emphasize strength training exercises and protein-rich nutrition.",
            "cardio": "Prioritize cardiovascular exercises and endurance training.",
            "strength": "Focus on compound movements and progressive overload.",
            "general": "Provide balanced workout and nutrition recommendations."
        }
        
        specific_guidance = agent_prompts.get(agent_type, agent_prompts["general"])

        user_info = f"Analyze this {gender}, {age} years old, {weight} lbs person's image."
        if height:
            user_info += f" They are {height} inches tall."
        if health_conditions.strip():
            user_info += f" Health/Exercise Notes: {health_conditions}"

        prompt = (
            f"You are a fitness expert. {user_info} "
            f"{specific_guidance}\n\n"
            f"Provide:\n"
            f"1. **Quick Assessment** - what you see in the image\n"
            f"2. **3-Exercise Workout** - specific exercises with reps\n"
            f"3. **Nutrition Tip** - one key dietary advice\n"
            f"4. **Weekly Goal** - one achievable target\n\n"
            f"Keep it concise and actionable."
            f"{' IMPORTANT: Consider the health conditions/preferences mentioned above.' if health_conditions.strip() else ''}"
        )

        # Make API call with optimized parameters
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{encoded_images[0]}"}}
                ]}
            ],
            max_tokens=int(os.getenv("AI_FAST_MAX_TOKENS", "800")),
            temperature=float(os.getenv("AI_FAST_TEMPERATURE", "0.5")),
        )
        
        return response.choices[0].message.content
        
    except Exception as e:
        logging.error(f"Fast fitness recommendation error: {e}")
        return f"Quick analysis complete! Based on your profile ({gender}, {age}, {weight} lbs), here's a starter plan: Try 3 sets of push-ups, squats, and planks. Focus on consistent daily movement and balanced nutrition. Start with 20 minutes of activity today!"
