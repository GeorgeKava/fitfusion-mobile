import asyncio
import json
from typing import Any, Sequence
from mcp.server.models import InitializationOptions
from mcp.server import NotificationOptions, Server
from mcp.types import (
    Resource,
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
    LoggingLevel
)
import mcp.types as types
from pydantic import AnyUrl
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fitness-mcp-server")

# Create the MCP server instance
server = Server("fitness-advisor")

# Sample fitness data that could come from a database
FITNESS_EXERCISES = {
    "push_ups": {
        "name": "Push-ups",
        "category": "Upper Body",
        "muscle_groups": ["chest", "shoulders", "triceps"],
        "difficulty": "beginner",
        "equipment": "none",
        "instructions": "Start in plank position, lower chest to ground, push back up",
        "reps": "3 sets of 10-15"
    },
    "squats": {
        "name": "Squats",
        "category": "Lower Body", 
        "muscle_groups": ["quadriceps", "glutes", "hamstrings"],
        "difficulty": "beginner",
        "equipment": "none",
        "instructions": "Stand with feet shoulder-width apart, lower hips back and down, return to standing",
        "reps": "3 sets of 12-20"
    },
    "deadlifts": {
        "name": "Deadlifts",
        "category": "Full Body",
        "muscle_groups": ["hamstrings", "glutes", "back", "traps"],
        "difficulty": "intermediate",
        "equipment": "barbell",
        "instructions": "Stand with feet hip-width apart, bend at hips and knees to lower bar, return to standing",
        "reps": "3 sets of 5-8"
    }
}

NUTRITION_PLANS = {
    "weight_loss": {
        "name": "Weight Loss Plan",
        "daily_calories": 1800,
        "macros": {"protein": "30%", "carbs": "40%", "fat": "30%"},
        "meals": {
            "breakfast": "Greek yogurt with berries and nuts",
            "lunch": "Grilled chicken salad with olive oil",
            "dinner": "Baked salmon with quinoa and vegetables",
            "snacks": "Apple with almond butter"
        }
    },
    "muscle_gain": {
        "name": "Muscle Building Plan",
        "daily_calories": 2500,
        "macros": {"protein": "35%", "carbs": "45%", "fat": "20%"},
        "meals": {
            "breakfast": "Protein smoothie with banana and oats",
            "lunch": "Chicken and rice bowl with vegetables",
            "dinner": "Lean beef with sweet potato and broccoli",
            "snacks": "Protein bar and mixed nuts"
        }
    },
    "maintenance": {
        "name": "Maintenance Plan",
        "daily_calories": 2200,
        "macros": {"protein": "25%", "carbs": "50%", "fat": "25%"},
        "meals": {
            "breakfast": "Oatmeal with fruits and nuts",
            "lunch": "Turkey and avocado wrap",
            "dinner": "Grilled fish with quinoa and mixed vegetables",
            "snacks": "Yogurt with granola"
        }
    }
}

FOOD_DATABASE = {
    "apple": {
        "name": "Apple (medium)",
        "calories": 95,
        "macros": {"protein": 0.5, "carbs": 25, "fat": 0.3, "fiber": 4},
        "vitamins": ["Vitamin C", "Potassium"],
        "health_rating": "excellent",
        "timing": "Pre-workout or as snack"
    },
    "banana": {
        "name": "Banana (medium)",
        "calories": 105,
        "macros": {"protein": 1.3, "carbs": 27, "fat": 0.4, "fiber": 3},
        "vitamins": ["Potassium", "Vitamin B6"],
        "health_rating": "excellent",
        "timing": "Pre or post-workout"
    },
    "chicken_breast": {
        "name": "Chicken Breast (100g)",
        "calories": 165,
        "macros": {"protein": 31, "carbs": 0, "fat": 3.6, "fiber": 0},
        "vitamins": ["Protein", "B vitamins"],
        "health_rating": "excellent",
        "timing": "Post-workout or main meals"
    },
    "quinoa": {
        "name": "Quinoa (1 cup cooked)",
        "calories": 222,
        "macros": {"protein": 8, "carbs": 39, "fat": 3.6, "fiber": 5},
        "vitamins": ["Complete protein", "Iron", "Magnesium"],
        "health_rating": "excellent", 
        "timing": "Post-workout or main meals"
    }
}

@server.list_resources()
async def handle_list_resources() -> list[Resource]:
    """List available fitness resources"""
    resources = []
    
    # Add exercise resources
    for exercise_id, exercise_data in FITNESS_EXERCISES.items():
        resources.append(Resource(
            uri=AnyUrl(f"fitness://exercises/{exercise_id}"),
            name=f"Exercise: {exercise_data['name']}",
            description=f"{exercise_data['category']} exercise targeting {', '.join(exercise_data['muscle_groups'])}",
            mimeType="application/json"
        ))
    
    # Add nutrition plan resources
    for plan_id, plan_data in NUTRITION_PLANS.items():
        resources.append(Resource(
            uri=AnyUrl(f"fitness://nutrition/{plan_id}"),
            name=f"Nutrition: {plan_data['name']}",
            description=f"Nutrition plan with {plan_data['daily_calories']} daily calories",
            mimeType="application/json"
        ))
    
    # Add food database resources
    for food_id, food_data in FOOD_DATABASE.items():
        resources.append(Resource(
            uri=AnyUrl(f"fitness://foods/{food_id}"),
            name=f"Food: {food_data['name']}",
            description=f"Nutritional information for {food_data['name']} - {food_data['calories']} calories",
            mimeType="application/json"
        ))
    
    return resources

@server.read_resource()
async def handle_read_resource(uri: AnyUrl) -> str:
    """Read a specific fitness resource"""
    uri_str = str(uri)
    
    if uri_str.startswith("fitness://exercises/"):
        exercise_id = uri_str.split("/")[-1]
        if exercise_id in FITNESS_EXERCISES:
            return json.dumps(FITNESS_EXERCISES[exercise_id], indent=2)
    
    elif uri_str.startswith("fitness://nutrition/"):
        plan_id = uri_str.split("/")[-1]
        if plan_id in NUTRITION_PLANS:
            return json.dumps(NUTRITION_PLANS[plan_id], indent=2)
    
    elif uri_str.startswith("fitness://foods/"):
        food_id = uri_str.split("/")[-1]
        if food_id in FOOD_DATABASE:
            return json.dumps(FOOD_DATABASE[food_id], indent=2)
    
    raise ValueError(f"Resource not found: {uri}")

@server.list_tools()
async def handle_list_tools() -> list[Tool]:
    """List available fitness tools"""
    return [
        Tool(
            name="create_workout_plan",
            description="Create a personalized workout plan based on user goals and preferences",
            inputSchema={
                "type": "object",
                "properties": {
                    "goal": {
                        "type": "string",
                        "enum": ["weight_loss", "muscle_gain", "endurance", "flexibility"],
                        "description": "Primary fitness goal"
                    },
                    "fitness_level": {
                        "type": "string",
                        "enum": ["beginner", "intermediate", "advanced"],
                        "description": "Current fitness level"
                    },
                    "available_equipment": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of available equipment"
                    },
                    "days_per_week": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 7,
                        "description": "Number of workout days per week"
                    }
                },
                "required": ["goal", "fitness_level", "days_per_week"]
            }
        ),
        Tool(
            name="calculate_nutrition_needs",
            description="Calculate daily nutrition needs based on user profile",
            inputSchema={
                "type": "object",
                "properties": {
                    "age": {"type": "integer", "minimum": 10, "maximum": 100},
                    "gender": {"type": "string", "enum": ["male", "female"]},
                    "weight": {"type": "number", "minimum": 30},
                    "height": {"type": "number", "minimum": 100},
                    "activity_level": {
                        "type": "string", 
                        "enum": ["sedentary", "light", "moderate", "active", "very_active"]
                    },
                    "goal": {"type": "string", "enum": ["weight_loss", "maintenance", "muscle_gain"]}
                },
                "required": ["age", "gender", "weight", "height", "activity_level", "goal"]
            }
        ),
        Tool(
            name="get_exercise_recommendations",
            description="Get exercise recommendations based on muscle groups and equipment",
            inputSchema={
                "type": "object",
                "properties": {
                    "target_muscles": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Target muscle groups"
                    },
                    "equipment": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Available equipment"
                    },
                    "difficulty": {
                        "type": "string",
                        "enum": ["beginner", "intermediate", "advanced"],
                        "description": "Exercise difficulty level"
                    }
                },
                "required": ["target_muscles"]
            }
        ),
        Tool(
            name="identify_food_nutrition",
            description="Identify nutritional information for a specific food item",
            inputSchema={
                "type": "object",
                "properties": {
                    "food_name": {
                        "type": "string",
                        "description": "Name of the food item to analyze"
                    },
                    "portion_size": {
                        "type": "string",
                        "description": "Portion size (e.g., '1 cup', '100g', 'medium')",
                        "default": "standard serving"
                    },
                    "fitness_goal": {
                        "type": "string",
                        "enum": ["weight_loss", "muscle_gain", "maintenance"],
                        "description": "User's fitness goal for context"
                    }
                },
                "required": ["food_name"]
            }
        ),
        Tool(
            name="generate_meal_plan",
            description="Generate a complete meal plan based on nutrition goals",
            inputSchema={
                "type": "object",
                "properties": {
                    "daily_calories": {
                        "type": "integer",
                        "minimum": 1200,
                        "maximum": 4000,
                        "description": "Target daily calories"
                    },
                    "fitness_goal": {
                        "type": "string",
                        "enum": ["weight_loss", "muscle_gain", "maintenance"],
                        "description": "Primary fitness goal"
                    },
                    "dietary_restrictions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Dietary restrictions or preferences"
                    },
                    "meals_per_day": {
                        "type": "integer",
                        "minimum": 3,
                        "maximum": 6,
                        "description": "Number of meals per day",
                        "default": 5
                    }
                },
                "required": ["daily_calories", "fitness_goal"]
            }
        )
    ]

@server.call_tool()
async def handle_call_tool(name: str, arguments: dict[str, Any] | None) -> list[types.TextContent]:
    """Handle tool calls"""
    if not arguments:
        arguments = {}
    
    if name == "create_workout_plan":
        return await create_workout_plan(arguments)
    elif name == "calculate_nutrition_needs":
        return await calculate_nutrition_needs(arguments)
    elif name == "get_exercise_recommendations":
        return await get_exercise_recommendations(arguments)
    elif name == "identify_food_nutrition":
        return await identify_food_nutrition(arguments)
    elif name == "generate_meal_plan":
        return await generate_meal_plan(arguments)
    else:
        raise ValueError(f"Unknown tool: {name}")

async def create_workout_plan(args: dict[str, Any]) -> list[TextContent]:
    """Create a personalized workout plan"""
    goal = args.get("goal")
    fitness_level = args.get("fitness_level")
    days_per_week = args.get("days_per_week", 3)
    equipment = args.get("available_equipment", [])
    
    # Simple workout plan generation logic
    plan = {
        "goal": goal,
        "fitness_level": fitness_level,
        "schedule": f"{days_per_week} days per week",
        "exercises": []
    }
    
    # Add exercises based on goal and equipment
    suitable_exercises = []
    for exercise_id, exercise_data in FITNESS_EXERCISES.items():
        if exercise_data["difficulty"] == fitness_level or fitness_level == "intermediate":
            if not equipment or exercise_data["equipment"] in equipment or exercise_data["equipment"] == "none":
                suitable_exercises.append(exercise_data)
    
    plan["exercises"] = suitable_exercises[:6]  # Limit to 6 exercises
    plan["recommendations"] = f"Focus on {goal.replace('_', ' ')} with {fitness_level} level exercises"
    
    return [TextContent(
        type="text",
        text=json.dumps(plan, indent=2)
    )]

async def calculate_nutrition_needs(args: dict[str, Any]) -> list[TextContent]:
    """Calculate daily nutrition needs"""
    age = args.get("age")
    gender = args.get("gender")
    weight = args.get("weight")  # in kg
    height = args.get("height")  # in cm
    activity_level = args.get("activity_level")
    goal = args.get("goal")
    
    # Basic BMR calculation (Harris-Benedict)
    if gender == "male":
        bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age)
    else:
        bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
    
    # Activity multipliers
    activity_multipliers = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9
    }
    
    tdee = bmr * activity_multipliers.get(activity_level, 1.55)
    
    # Adjust for goal
    if goal == "weight_loss":
        daily_calories = tdee - 500  # 500 calorie deficit
    elif goal == "muscle_gain":
        daily_calories = tdee + 300  # 300 calorie surplus
    else:
        daily_calories = tdee  # maintenance
    
    nutrition_plan = {
        "bmr": round(bmr),
        "tdee": round(tdee),
        "daily_calories": round(daily_calories),
        "goal": goal,
        "macros": {
            "protein": f"{round(daily_calories * 0.3 / 4)}g (30%)",
            "carbohydrates": f"{round(daily_calories * 0.4 / 4)}g (40%)",
            "fat": f"{round(daily_calories * 0.3 / 9)}g (30%)"
        },
        "water_intake": f"{round(weight * 35)}ml per day"
    }
    
    return [TextContent(
        type="text",
        text=json.dumps(nutrition_plan, indent=2)
    )]

async def get_exercise_recommendations(args: dict[str, Any]) -> list[TextContent]:
    """Get exercise recommendations"""
    target_muscles = args.get("target_muscles", [])
    equipment = args.get("equipment", [])
    difficulty = args.get("difficulty", "beginner")
    
    recommendations = []
    for exercise_id, exercise_data in FITNESS_EXERCISES.items():
        # Check if exercise targets any of the requested muscles
        if any(muscle in exercise_data["muscle_groups"] for muscle in target_muscles):
            # Check equipment requirements
            if not equipment or exercise_data["equipment"] in equipment or exercise_data["equipment"] == "none":
                # Check difficulty
                if exercise_data["difficulty"] == difficulty or difficulty == "intermediate":
                    recommendations.append(exercise_data)
    
    result = {
        "target_muscles": target_muscles,
        "difficulty": difficulty,
        "recommended_exercises": recommendations
    }
    
    return [TextContent(
        type="text",
        text=json.dumps(result, indent=2)
    )]

async def identify_food_nutrition(args: dict[str, Any]) -> list[TextContent]:
    """Identify nutritional information for a food item"""
    food_name = args.get("food_name", "").lower()
    portion_size = args.get("portion_size", "standard serving")
    fitness_goal = args.get("fitness_goal", "maintenance")
    
    # Check if food is in our database
    food_info = None
    for food_id, food_data in FOOD_DATABASE.items():
        if food_id in food_name or food_name in food_data["name"].lower():
            food_info = food_data.copy()
            break
    
    if not food_info:
        # Generic nutrition analysis for unknown foods
        food_info = {
            "name": food_name.title(),
            "calories": "Unknown - requires analysis",
            "macros": {"protein": "Unknown", "carbs": "Unknown", "fat": "Unknown"},
            "health_rating": "requires_analysis",
            "recommendation": f"Food identification for '{food_name}' requires image analysis or more specific information."
        }
    
    # Add fitness goal-specific advice
    goal_advice = {
        "weight_loss": "Focus on portion control and pair with low-calorie vegetables.",
        "muscle_gain": "Consider timing around workouts for optimal protein synthesis.",
        "maintenance": "Include as part of a balanced diet with varied nutrients."
    }
    
    analysis = {
        "food_item": food_info,
        "portion_analyzed": portion_size,
        "fitness_goal": fitness_goal,
        "goal_specific_advice": goal_advice.get(fitness_goal, goal_advice["maintenance"]),
        "timing_recommendation": food_info.get("timing", "Any time"),
        "health_assessment": food_info.get("health_rating", "requires_analysis")
    }
    
    return [TextContent(
        type="text",
        text=json.dumps(analysis, indent=2)
    )]

async def generate_meal_plan(args: dict[str, Any]) -> list[TextContent]:
    """Generate a complete meal plan"""
    daily_calories = args.get("daily_calories", 2000)
    fitness_goal = args.get("fitness_goal", "maintenance")
    dietary_restrictions = args.get("dietary_restrictions", [])
    meals_per_day = args.get("meals_per_day", 5)
    
    # Get base nutrition plan
    base_plan = NUTRITION_PLANS.get(fitness_goal, NUTRITION_PLANS["maintenance"])
    
    # Calculate macro targets
    protein_calories = daily_calories * 0.25
    carb_calories = daily_calories * 0.50  
    fat_calories = daily_calories * 0.25
    
    if fitness_goal == "muscle_gain":
        protein_calories = daily_calories * 0.35
        carb_calories = daily_calories * 0.45
        fat_calories = daily_calories * 0.20
    elif fitness_goal == "weight_loss":
        protein_calories = daily_calories * 0.30
        carb_calories = daily_calories * 0.40
        fat_calories = daily_calories * 0.30
    
    meal_plan = {
        "goal": fitness_goal,
        "daily_calories": daily_calories,
        "macronutrient_targets": {
            "protein": f"{int(protein_calories / 4)}g ({int(protein_calories / daily_calories * 100)}%)",
            "carbohydrates": f"{int(carb_calories / 4)}g ({int(carb_calories / daily_calories * 100)}%)",
            "fat": f"{int(fat_calories / 9)}g ({int(fat_calories / daily_calories * 100)}%)"
        },
        "meals": base_plan["meals"].copy(),
        "dietary_considerations": dietary_restrictions,
        "hydration": f"Aim for {int(daily_calories / 100)}+ glasses of water daily",
        "meal_timing": {
            "breakfast": "Within 1-2 hours of waking",
            "lunch": "4-5 hours after breakfast", 
            "dinner": "3-4 hours before bed",
            "snacks": "Between main meals as needed"
        },
        "notes": f"Customized meal plan for {fitness_goal.replace('_', ' ')} goals with {daily_calories} daily calories"
    }
    
    # Add dietary restriction modifications
    if dietary_restrictions:
        meal_plan["modifications"] = f"Plan modified for: {', '.join(dietary_restrictions)}"
    
    return [TextContent(
        type="text",
        text=json.dumps(meal_plan, indent=2)
    )]

async def main():
    # Import here to avoid issues if mcp package isn't available
    from mcp.server.stdio import stdio_server
    
    async with stdio_server() as (read_stream, write_stream):
        await server.run(
            read_stream,
            write_stream,
            InitializationOptions(
                server_name="fitness-advisor",
                server_version="0.1.0",
                capabilities=server.get_capabilities(
                    notification_options=NotificationOptions(),
                    experimental_capabilities={},
                ),
            ),
        )

if __name__ == "__main__":
    asyncio.run(main())
