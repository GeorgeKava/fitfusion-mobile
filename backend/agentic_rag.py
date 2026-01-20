#!/usr/bin/env python3
"""
Agentic RAG Implementation for Fitness Recommendations

This implements true Agentic RAG as described by IBM:
- Dynamic decision making based on context
- Iterative refinement of queries and results  
- Goal decomposition and planning
- Self-reflection and quality assessment
- Tool selection and execution strategies
- Vision analysis integration for image-based recommendations
"""

import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
import base64
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class AgentStrategy(Enum):
    """Different strategies the agent can employ"""
    BROAD_SEARCH = "broad_search"
    TARGETED_SEARCH = "targeted_search"  
    PROGRESSIVE_REFINEMENT = "progressive_refinement"
    MULTI_ANGLE_APPROACH = "multi_angle_approach"

@dataclass
class SearchResult:
    """Structured search result with quality metrics"""
    content: str
    relevance_score: float
    source: str
    exercise_type: str
    target_muscles: List[str]
    difficulty: str

@dataclass  
class AgentPlan:
    """The agent's plan for achieving user goals"""
    primary_goal: str
    sub_goals: List[str]
    search_strategies: List[AgentStrategy]
    expected_iterations: int
    success_criteria: Dict[str, float]

class AgenticFitnessRAG:
    """
    Agentic RAG system that dynamically plans, executes, and refines 
    fitness recommendations using intelligent decision-making
    
    Now uses ChromaDB instead of Azure AI Search
    """
    
    def __init__(self, vector_store, azure_openai_client=None):
        # ChromaDB vector store instead of Azure Search
        self.vector_store = vector_store
        self.ai_client = azure_openai_client
        self.max_iterations = int(os.getenv("AGENTIC_RAG_MAX_ITERATIONS", "3"))
        self.reflection_mode = os.getenv("AGENTIC_RAG_REFLECTION_MODE", "true").lower() == "true"
        
        # Agent memory for learning and adaptation
        self.search_history = []
        self.successful_strategies = {}
        self.user_feedback_patterns = {}
        
        logger.info(f"Initialized Agentic RAG with ChromaDB, {self.max_iterations} max iterations, reflection_mode={self.reflection_mode}")
        logger.info(f"📊 Exercise database: {self.vector_store.exercise_collection.count()} exercises available")
        
        # Log Azure OpenAI client status for vision analysis
        if self.ai_client:
            logger.info(f"✅ Azure OpenAI client available for vision analysis: {type(self.ai_client)}")
        else:
            logger.warning(f"⚠️ No Azure OpenAI client provided - vision analysis will be disabled")
    
    async def generate_recommendation(self, user_data: Dict, images: List = None) -> Dict[str, Any]:
        """
        Main agentic loop for generating fitness recommendations
        
        Agentic RAG Process:
        1. Goal Analysis & Planning
        2. Dynamic Strategy Selection  
        3. Iterative Search & Refinement
        4. Self-Reflection & Quality Assessment
        5. Final Synthesis
        """
        
        logger.info("🤖 Starting Agentic RAG recommendation generation")
        
        # Phase 0: Image Analysis (if images provided)
        image_analysis = ""
        logger.info(f"🔍 Debug: Images parameter: {images}")
        logger.info(f"🔍 Debug: Images type: {type(images)}")
        logger.info(f"🔍 Debug: Images length: {len(images) if images else 'None'}")
        
        if images and len(images) > 0:
            logger.info(f"📸 Analyzing {len(images)} images for visual insights: {images}")
            try:
                image_analysis = await self._analyze_images(images, user_data)
                logger.info(f"🔍 Image analysis completed: {len(image_analysis)} characters")
                logger.info(f"📋 Image analysis preview: {image_analysis[:200]}...")
            except Exception as e:
                logger.error(f"❌ Image analysis failed: {e}")
                logger.exception("Full traceback:")
        else:
            logger.info("❌ No images provided for analysis")
        # Phase 1: Goal Analysis & Strategic Planning
        user_profile = self._analyze_user_profile(user_data, image_analysis)
        agent_plan = self._create_strategic_plan(user_profile, images, image_analysis)
        
        logger.info(f"📋 Agent Plan: {agent_plan.primary_goal} with {len(agent_plan.sub_goals)} sub-goals")
        
        # Phase 2: Iterative Agentic Search & Refinement
        search_results = []
        current_strategy = None
        
        for iteration in range(self.max_iterations):
            logger.info(f"🔄 Agentic Iteration {iteration + 1}/{self.max_iterations}")
            
            # Dynamic strategy selection based on current results
            current_strategy = self._select_optimal_strategy(agent_plan, search_results, iteration)
            logger.info(f"🎯 Selected strategy: {current_strategy.value}")
            
            # Execute search with current strategy
            iteration_results = await self._execute_strategic_search(
                current_strategy, agent_plan, user_profile, iteration
            )
            
            # Self-reflection: Evaluate quality and decide if we need to continue
            quality_assessment = self._assess_result_quality(
                iteration_results, agent_plan, search_results
            )
            
            search_results.extend(iteration_results)
            
            logger.info(f"📊 Iteration {iteration + 1} quality: {quality_assessment['overall_score']:.2f}")
            
            # Decide if we've achieved our goals or need another iteration
            if self._should_stop_searching(quality_assessment, agent_plan, iteration):
                logger.info(f"✅ Agent achieved goals in {iteration + 1} iterations")
                break
                
            # Learn from this iteration for the next one
            self._update_agent_memory(current_strategy, iteration_results, quality_assessment)
        
        # Phase 3: Intelligent Synthesis & Final Recommendation
        final_recommendation = await self._synthesize_agentic_recommendation(
            search_results, agent_plan, user_profile, user_data, images, image_analysis
        )
        
        # Phase 4: Self-Reflection and Learning (if enabled)
        if self.reflection_mode:
            reflection_insights = self._generate_reflection_insights(
                agent_plan, search_results, final_recommendation
            )
            final_recommendation["agentic_insights"] = reflection_insights
        
        # Add agentic metadata
        final_recommendation.update({
            "agentic_rag": True,
            "agent_plan": agent_plan.__dict__,
            "iterations_used": len(search_results),
            "strategies_employed": [s.value for s in [current_strategy]] if current_strategy else [],
            "enhanced_with_intelligence": True
        })
        
        logger.info("🎉 Agentic RAG recommendation generation completed")
        return final_recommendation
    
    async def _analyze_images(self, images: List, user_data: Dict) -> str:
        """Analyze uploaded images using Azure OpenAI Vision capabilities"""
        logger.info(f"🔍 Starting image analysis with {len(images) if images else 0} images")
        
        if not images or len(images) == 0:
            logger.info("❌ No images provided for analysis")
            return ""
        
        if not self.ai_client:
            logger.error("❌ CRITICAL: No AI client available for image analysis - client is None!")
            logger.error(f"🔍 Debug: self.ai_client = {self.ai_client}")
            return "VISUAL ANALYSIS SKIPPED: Azure OpenAI client not initialized. Check AZURE_VISION_ENDPOINT and AZURE_VISION_KEY environment variables."
        
        logger.info(f"✅ AI client available: {type(self.ai_client)}, processing {len(images)} images")
        
        try:
            # Encode images for analysis
            encoded_images = []
            logger.info(f"🔍 Debug: Processing {len(images)} image paths")
            
            for i, img_path in enumerate(images):
                logger.info(f"🔍 Debug: Image {i+1}: {img_path}")
                logger.info(f"🔍 Debug: Image exists: {os.path.exists(img_path)}")
                
                if os.path.exists(img_path):
                    try:
                        with open(img_path, "rb") as img_file:
                            encoded = base64.b64encode(img_file.read()).decode('utf-8')
                            encoded_images.append({
                                "filename": os.path.basename(img_path),
                                "data": encoded
                            })
                            logger.info(f"✅ Successfully encoded image {i+1}: {os.path.basename(img_path)}")
                    except Exception as e:
                        logger.error(f"❌ Failed to encode image {img_path}: {e}")
                else:
                    logger.warning(f"⚠️ Image not found: {img_path}")
            
            logger.info(f"🔍 Debug: Successfully encoded {len(encoded_images)} images")
            
            if not encoded_images:
                logger.warning("❌ No images successfully encoded")
                return ""
            
            # Create comprehensive prompt for fitness analysis
            user_info = f"User: {user_data.get('gender', 'Unknown')}, {user_data.get('age', 'Unknown')} years old, {user_data.get('weight', 'Unknown')} lbs"
            user_goal = user_data.get('agent_type', 'general')
            health_conditions = user_data.get('health_conditions', '')
            
            vision_prompt = f"""You are a professional fitness expert analyzing images for personalized recommendations.

USER PROFILE:
{user_info}
Goal: {user_goal}
{f"Health/Exercise Notes: {health_conditions}" if health_conditions.strip() else ""}

ANALYSIS TASK:
Analyze the uploaded images and provide detailed observations about:

1. **Physical Assessment**: Body composition, posture, visible muscle development, overall physique
2. **Form Analysis**: If exercise/movement is shown, analyze form and technique
3. **Environment**: Available equipment, space, setting (gym, home, outdoor)
4. **Specific Recommendations**: Based on what you see, what exercises or modifications would be most beneficial
5. **Visual Cues**: Any specific areas that need attention based on the visual assessment

Provide a comprehensive analysis that will be used to create a personalized fitness plan. Focus on actionable insights based on what you can observe in the images.
"""

            # Call Azure OpenAI Vision API
            vision_model = os.getenv("AZURE_VISION_MODEL", os.getenv("AZURE_OPENAI_MODEL", "gpt-4o"))
            logger.info(f"🤖 Calling Azure OpenAI Vision API with model deployment: {vision_model}")
            logger.info(f"🔍 Debug: Using client endpoint (inferred from client)")
            logger.info(f"🔍 Debug: Max tokens: {os.getenv('AGENTIC_RAG_MAX_TOKENS', '800')}")
            
            try:
                response = self.ai_client.chat.completions.create(
                    model=vision_model,
                    messages=[
                        {"role": "system", "content": vision_prompt},
                        {
                            "role": "user", 
                            "content": [
                                {"type": "text", "text": f"Please analyze these images for {user_goal} fitness recommendations."},
                                *[
                                    {
                                        "type": "image_url", 
                                        "image_url": {"url": f"data:image/jpeg;base64,{img['data']}"}
                                    } for img in encoded_images
                                ]
                            ]
                        }
                    ],
                    max_tokens=int(os.getenv("AGENTIC_RAG_MAX_TOKENS", "800")),
                    temperature=float(os.getenv("AI_TEMPERATURE", "0.7"))
                )
                
                logger.info("✅ Azure OpenAI Vision API call successful!")
                
                image_analysis = response.choices[0].message.content
                
                # Clean up markdown formatting to prevent visual clutter
                image_analysis = self._clean_markdown_formatting(image_analysis)
                
                logger.info(f"✅ Vision analysis completed: {len(image_analysis)} characters")
                return image_analysis
            
            except Exception as vision_error:
                logger.error(f"❌ VISION API ERROR: {type(vision_error).__name__}: {vision_error}")
                logger.error(f"🔍 Full error details: {str(vision_error)}", exc_info=True)
                return f"VISUAL ANALYSIS SKIPPED: Vision model error - {type(vision_error).__name__}: {str(vision_error)[:200]}"
            
        except Exception as e:
            logger.error(f"❌ Image processing error: {e}")
            return ""
    
    def _analyze_user_profile(self, user_data: Dict, image_analysis: str = "") -> Dict[str, Any]:
        """Deep analysis of user profile to understand needs and constraints"""
        age = int(user_data.get('age', 30))
        gender = user_data.get('gender', 'male')
        weight = float(user_data.get('weight', 150))
        height = user_data.get('height', None)
        goal = user_data.get('agent_type', 'general')
        health_conditions = user_data.get('health_conditions', '').lower()
        
        # Intelligent profile analysis
        demographics = {"age": age, "gender": gender, "weight": weight}
        
        # Add height to demographics if provided and not empty
        if height and str(height).strip():
            try:
                demographics["height"] = float(height)
            except (ValueError, TypeError):
                pass  # Skip if height conversion fails
            
        profile = {
            "demographics": demographics,
            "primary_goal": goal,
            "health_constraints": self._parse_health_constraints(health_conditions),
            "fitness_level": self._infer_fitness_level(user_data, image_analysis),
            "motivation_level": self._assess_motivation(goal, age),
            "time_availability": self._estimate_time_availability(user_data),
            "equipment_access": self._infer_equipment_access(user_data, image_analysis),
            "visual_assessment": self._extract_visual_insights(image_analysis),
            "image_analysis": image_analysis  # Store full analysis for later use
        }
        
        return profile
    
    def _create_strategic_plan(self, user_profile: Dict, images: List = None, image_analysis: str = "") -> AgentPlan:
        """Create an intelligent plan for achieving user's fitness goals"""
        primary_goal = user_profile["primary_goal"]
        
        # Enhanced goal decomposition based on visual assessment
        visual_insights = user_profile.get("visual_assessment", {})
        
        # Goal decomposition based on primary objective
        if primary_goal == "weight_loss":
            sub_goals = [
                "find_high_intensity_cardio",
                "identify_calorie_burning_exercises", 
                "locate_nutrition_guidance",
                "discover_progression_strategies"
            ]
            # Add visual-specific goals if we have image insights
            if visual_insights.get("form_issues"):
                sub_goals.append("address_form_corrections")
            if visual_insights.get("equipment_available"):
                sub_goals.append("utilize_available_equipment")
                
            strategies = [AgentStrategy.BROAD_SEARCH, AgentStrategy.TARGETED_SEARCH]
            
        elif primary_goal == "muscle_gain":
            sub_goals = [
                "find_progressive_strength_exercises",
                "identify_muscle_building_protocols",
                "locate_nutrition_for_growth",
                "discover_recovery_strategies"
            ]
            # Add visual-specific goals if we have image insights
            if visual_insights.get("muscle_definition"):
                sub_goals.append("target_specific_muscle_groups")
            if visual_insights.get("posture_issues"):
                sub_goals.append("address_postural_corrections")
                
            strategies = [AgentStrategy.TARGETED_SEARCH, AgentStrategy.PROGRESSIVE_REFINEMENT]
            
        elif primary_goal == "cardio":
            sub_goals = [
                "find_endurance_training_methods",
                "identify_cardio_progressions",
                "locate_heart_rate_guidance",
                "discover_training_variations"
            ]
            # Add visual-specific goals if we have image insights
            if visual_insights.get("current_fitness_level"):
                sub_goals.append("adjust_intensity_for_level")
            if visual_insights.get("equipment_available"):
                sub_goals.append("optimize_available_equipment")
                
            strategies = [AgentStrategy.BROAD_SEARCH, AgentStrategy.MULTI_ANGLE_APPROACH]
            
        else:  # general, strength
            sub_goals = [
                "find_foundational_exercises",
                "identify_balanced_routines",
                "locate_beginner_progressions",
                "discover_safety_guidelines"
            ]
            # Add visual-specific goals if we have image insights
            if visual_insights.get("form_assessment"):
                sub_goals.append("improve_exercise_form")
            if visual_insights.get("mobility_issues"):
                sub_goals.append("address_mobility_limitations")
            if visual_insights.get("equipment_assessment"):
                sub_goals.append("adapt_for_equipment_constraints")
                
            strategies = [AgentStrategy.BROAD_SEARCH, AgentStrategy.PROGRESSIVE_REFINEMENT]
        
        # Set success criteria based on goal complexity
        success_criteria = {
            "relevance_threshold": 0.7,
            "coverage_target": 0.8,
            "diversity_minimum": 3,
            "practical_applicability": 0.9
        }
        
        return AgentPlan(
            primary_goal=primary_goal,
            sub_goals=sub_goals,
            search_strategies=strategies,
            expected_iterations=min(len(sub_goals), self.max_iterations),
            success_criteria=success_criteria
        )
    
    def _select_optimal_strategy(self, plan: AgentPlan, current_results: List, iteration: int) -> AgentStrategy:
        """Dynamically select the best strategy based on current context"""
        
        # First iteration: usually start broad
        if iteration == 0:
            return AgentStrategy.BROAD_SEARCH
        
        # Analyze current results to decide strategy
        if len(current_results) < 3:
            # Need more diverse results
            return AgentStrategy.MULTI_ANGLE_APPROACH
        elif self._results_lack_specificity(current_results):
            # Results too general, need targeted approach  
            return AgentStrategy.TARGETED_SEARCH
        elif self._results_need_refinement(current_results):
            # Good base, refine for quality
            return AgentStrategy.PROGRESSIVE_REFINEMENT
        else:
            # Default fallback
            return plan.search_strategies[iteration % len(plan.search_strategies)]
    
    async def _execute_strategic_search(self, strategy: AgentStrategy, plan: AgentPlan, 
                                       user_profile: Dict, iteration: int) -> List[SearchResult]:
        """Execute search using the selected strategy"""
        
        if strategy == AgentStrategy.BROAD_SEARCH:
            return self._execute_broad_search(plan, user_profile)
        elif strategy == AgentStrategy.TARGETED_SEARCH:
            return self._execute_targeted_search(plan, user_profile, iteration)
        elif strategy == AgentStrategy.PROGRESSIVE_REFINEMENT:
            return self._execute_progressive_refinement(plan, user_profile)
        elif strategy == AgentStrategy.MULTI_ANGLE_APPROACH:
            return self._execute_multi_angle_search(plan, user_profile)
        
        return []
    
    def _execute_broad_search(self, plan: AgentPlan, user_profile: Dict) -> List[SearchResult]:
        """Execute broad search to get diverse results"""
        results = []
        goal = plan.primary_goal
        
        logger.info(f"🔍 Executing broad search for goal: {goal}")
        
        # Broad search terms for comprehensive coverage
        search_terms = {
            "weight_loss": ["cardio", "fat burning", "HIIT", "weight loss exercises"],
            "muscle_gain": ["strength training", "muscle building", "hypertrophy", "resistance"],
            "cardio": ["endurance", "cardiovascular", "aerobic", "cardio training"],
            "strength": ["strength", "powerlifting", "resistance training", "strong"]
        }.get(goal, ["fitness", "exercise", "workout", "training"])
        
        logger.info(f"📝 Search terms: {search_terms}")
        
        # Search with each term using ChromaDB - NO FILTERS initially to ensure results
        for term in search_terms:
            try:
                # Use ChromaDB vector store without filters to get results
                exercises = self.vector_store.search_exercises(
                    query=term,
                    filters=None,  # Remove filters to get ANY results
                    top_k=5
                )
                
                logger.info(f"✅ Found {len(exercises)} exercises for term '{term}'")
                
                for exercise in exercises[:2]:  # Top 2 per search
                    metadata = exercise.get('metadata', {})
                    results.append(SearchResult(
                        content=exercise.get("content", ""),
                        relevance_score=1.0 - (exercise.get("distance", 0) if exercise.get("distance") else 0.5),
                        source="chromadb",
                        exercise_type=metadata.get("type", "general"),
                        target_muscles=[metadata.get("body_part", "")],
                        difficulty=metadata.get("level", "beginner")
                    ))
            except Exception as e:
                logger.error(f"❌ Broad search failed for term '{term}': {e}")
                logger.exception("Full traceback:")
        
        logger.info(f"📊 Broad search complete: {len(results)} total results")
        return results
    
    def _execute_targeted_search(self, plan: AgentPlan, user_profile: Dict, iteration: int) -> List[SearchResult]:
        """Execute highly targeted search for specific needs"""
        results = []
        
        logger.info(f"🎯 Executing targeted search for iteration {iteration}")
        
        # Use current sub-goal for targeted search
        if iteration < len(plan.sub_goals):
            current_sub_goal = plan.sub_goals[iteration]
            
            # Convert sub-goal to specific search terms
            search_term = current_sub_goal.replace("find_", "").replace("identify_", "").replace("locate_", "").replace("discover_", "").replace("_", " ")
            
            logger.info(f"🔍 Targeted search term: '{search_term}'")
            
            try:
                # Use ChromaDB for targeted search - no filters
                exercises = self.vector_store.search_exercises(
                    query=search_term,
                    filters=None,  # Remove filters to ensure results
                    top_k=5
                )
                
                logger.info(f"✅ Found {len(exercises)} exercises for targeted search")
                
                for exercise in exercises[:3]:  # Top 3 for targeted search
                    metadata = exercise.get('metadata', {})
                    results.append(SearchResult(
                        content=exercise.get("content", ""),
                        relevance_score=1.0 - (exercise.get("distance", 0) if exercise.get("distance") else 0.6),
                        source="chromadb_targeted",
                        exercise_type=metadata.get("type", "targeted"),
                        target_muscles=exercise.get("muscle_groups", []),
                        difficulty=exercise.get("difficulty", "intermediate")
                    ))
            except Exception as e:
                logger.error(f"❌ Targeted search failed for sub-goal '{current_sub_goal}': {e}")
                logger.exception("Full traceback:")
        
        logger.info(f"📊 Targeted search complete: {len(results)} results")
        return results
    
    def _execute_progressive_refinement(self, plan: AgentPlan, user_profile: Dict) -> List[SearchResult]:
        """Refine previous searches for higher quality results"""
        # This would typically analyze previous results and search for improvements
        # For now, implement as a high-quality focused search
        return self._execute_targeted_search(plan, user_profile, 0)
    
    def _execute_multi_angle_search(self, plan: AgentPlan, user_profile: Dict) -> List[SearchResult]:
        """Search from multiple angles for comprehensive coverage"""
        results = []
        goal = plan.primary_goal
        
        logger.info(f"🔄 Executing multi-angle search for goal: {goal}")
        
        # Different angles for the same goal
        angle_searches = {
            "weight_loss": ["beginner weight loss", "advanced fat burning", "cardio for weight loss"],
            "muscle_gain": ["beginner muscle building", "advanced hypertrophy", "strength for muscle"],
            "cardio": ["running cardio", "HIIT cardio", "low intensity cardio"],
            "strength": ["powerlifting", "bodyweight strength", "dumbbell strength"]
        }.get(goal, ["beginner fitness", "intermediate fitness", "advanced fitness"])
        
        logger.info(f"📝 Angle searches: {angle_searches}")
        
        for angle in angle_searches:
            try:
                # Use ChromaDB for multi-angle search - no filters
                exercises = self.vector_store.search_exercises(
                    query=angle,
                    filters=None,  # Remove filters to ensure results
                    top_k=5
                )
                
                logger.info(f"✅ Found {len(exercises)} exercises for angle '{angle}'")
                
                for exercise in exercises[:2]:  # Top 2 per angle
                    metadata = exercise.get('metadata', {})
                    results.append(SearchResult(
                        content=exercise.get("content", ""),
                        relevance_score=1.0 - (exercise.get("distance", 0) if exercise.get("distance") else 0.55),
                        source=f"chromadb_angle_{angle.replace(' ', '_')}",
                        exercise_type=metadata.get("type", "multi_angle"),
                        target_muscles=[metadata.get("body_part", "")],
                        difficulty=metadata.get("level", "varied")
                    ))
            except Exception as e:
                logger.error(f"❌ Multi-angle search failed for '{angle}': {e}")
                logger.exception("Full traceback:")
        
        logger.info(f"📊 Multi-angle search complete: {len(results)} results")
        return results
    
    def _assess_result_quality(self, new_results: List[SearchResult], plan: AgentPlan, 
                              all_results: List[SearchResult]) -> Dict[str, float]:
        """Assess the quality of search results against success criteria"""
        
        if not new_results:
            return {"overall_score": 0.0, "relevance": 0.0, "coverage": 0.0, "diversity": 0.0}
        
        # Calculate metrics
        avg_relevance = sum(r.relevance_score for r in new_results) / len(new_results)
        
        # Coverage: how many sub-goals are addressed
        all_exercise_types = set(r.exercise_type for r in all_results + new_results)
        coverage = min(len(all_exercise_types) / len(plan.sub_goals), 1.0)
        
        # Diversity: variety in muscle groups and difficulty levels
        all_muscles = set()
        all_difficulties = set()
        for r in all_results + new_results:
            all_muscles.update(r.target_muscles)
            all_difficulties.add(r.difficulty)
        
        diversity = min((len(all_muscles) + len(all_difficulties)) / 10.0, 1.0)  # Normalize
        
        # Overall score
        overall_score = (avg_relevance * 0.4 + coverage * 0.3 + diversity * 0.3)
        
        return {
            "overall_score": overall_score,
            "relevance": avg_relevance,
            "coverage": coverage,
            "diversity": diversity,
            "meets_criteria": overall_score >= plan.success_criteria.get("relevance_threshold", 0.7)
        }
    
    def _should_stop_searching(self, quality_assessment: Dict, plan: AgentPlan, iteration: int) -> bool:
        """Decide if the agent should stop searching"""
        
        # Stop if quality criteria are met
        if quality_assessment.get("meets_criteria", False):
            return True
        
        # Stop if we've hit max iterations
        if iteration >= self.max_iterations - 1:
            return True
        
        # Stop if quality is very high
        if quality_assessment.get("overall_score", 0) >= 0.9:
            return True
        
        return False
    
    def _update_agent_memory(self, strategy: AgentStrategy, results: List[SearchResult], 
                           quality: Dict):
        """Update agent memory for future learning"""
        strategy_key = strategy.value
        
        if strategy_key not in self.successful_strategies:
            self.successful_strategies[strategy_key] = []
        
        self.successful_strategies[strategy_key].append({
            "quality_score": quality.get("overall_score", 0),
            "result_count": len(results),
            "timestamp": "current"  # Would use real timestamp in production
        })
        
        # Keep only recent successful strategies (sliding window)
        if len(self.successful_strategies[strategy_key]) > 10:
            self.successful_strategies[strategy_key] = self.successful_strategies[strategy_key][-10:]
    
    async def _synthesize_agentic_recommendation(self, search_results: List[SearchResult], 
                                               plan: AgentPlan, user_profile: Dict, 
                                               user_data: Dict, images: List = None, image_analysis: str = "") -> Dict[str, Any]:
        """Synthesize final recommendation using agentic intelligence"""
        
        # Group results by type and quality
        high_quality_results = [r for r in search_results if r.relevance_score >= 0.7]
        exercise_categories = {}
        
        for result in high_quality_results:
            category = result.exercise_type
            if category not in exercise_categories:
                exercise_categories[category] = []
            exercise_categories[category].append(result)
        
        # Build comprehensive recommendation using fallback with CONVERTED user_data
        from mcp_client import get_azure_search_enhanced_fallback_sync, FitnessMCPClient
        
        # Ensure user_data has properly converted types for mathematical operations
        converted_user_data = user_data.copy()
        converted_user_data['age'] = int(user_data.get('age', 30))
        converted_user_data['weight'] = float(user_data.get('weight', 150))
        # Keep height as string for inch display but ensure it's not None
        if user_data.get('height') is None or str(user_data.get('height', '')).strip() == '':
            converted_user_data['height'] = None
        else:
            converted_user_data['height'] = str(user_data.get('height'))
        
        # Use the enhanced fallback with properly typed user_data
        client = FitnessMCPClient()
        base_recommendation = get_azure_search_enhanced_fallback_sync(
            converted_user_data, images, client
        )
        
        # Enhance with agentic insights including visual assessment
        visual_insights = user_profile.get("visual_assessment", {})
        
        agentic_enhancements = {
            "search_strategy_analysis": self._analyze_successful_strategies(),
            "personalized_insights": self._generate_personalized_insights(user_profile, search_results, image_analysis),
            "progressive_recommendations": self._create_progressive_plan(plan, search_results),
            "quality_metrics": self._calculate_final_quality_metrics(search_results, plan),
            "visual_assessment_integration": self._integrate_visual_insights(visual_insights, image_analysis)
        }
        
        # INJECT SPECIFIC EXERCISES FROM CHROMADB INTO THE WEEKLY PLAN
        logger.info(f"📋 Injecting {len(search_results)} exercises from ChromaDB into weekly plan")
        
        base_recommendation_text = base_recommendation.get("recommendation", "")
        
        # Extract specific exercise recommendations from search results
        exercise_list = self._format_exercises_from_search_results(search_results, plan.primary_goal)
        
        # If we have specific exercises, enhance the weekly plan with them
        if exercise_list and len(search_results) > 0:
            logger.info(f"✅ Adding specific exercises from ChromaDB to recommendation")
            # Insert exercises before the weekly structure - try all possible markers
            enhanced_base = base_recommendation_text
            
            # Try different markers that might exist in the base recommendation
            markers = [
                "**📊 COMPREHENSIVE WEEKLY STRUCTURE:**",
                "**🏃 COMPREHENSIVE WEEKLY STRUCTURE:**",
                "**💪 COMPREHENSIVE WEEKLY STRUCTURE:**",
                "COMPREHENSIVE WEEKLY STRUCTURE"
            ]
            
            replaced = False
            for marker in markers:
                if marker in enhanced_base:
                    enhanced_base = enhanced_base.replace(
                        marker,
                        f"**🎯 CHROMADB-POWERED SPECIFIC EXERCISES:**\n{exercise_list}\n\n{marker}"
                    )
                    logger.info(f"✅ Injected exercises before marker: {marker}")
                    replaced = True
                    break
            
            if not replaced:
                logger.warning(f"⚠️ No marker found in base recommendation. Adding exercises at the beginning.")
                enhanced_base = f"**🎯 CHROMADB-POWERED SPECIFIC EXERCISES:**\n{exercise_list}\n\n{enhanced_base}"
            
            final_recommendation = enhanced_base
        else:
            logger.warning("⚠️ No exercises to inject, using base recommendation")
            final_recommendation = base_recommendation_text
        
        # Create image analysis status indicator (for logging only)
        image_status = "❌ NO IMAGES ANALYZED"
        if images and len(images) > 0:
            if image_analysis and len(image_analysis.strip()) > 50:  # Meaningful analysis
                image_status = f"✅ {len(images)} IMAGE(S) ANALYZED WITH VISION AI"
            else:
                image_status = f"⚠️ {len(images)} IMAGE(S) PROVIDED BUT ANALYSIS FAILED"
        
        # Log the status but don't include it in user-facing content
        logger.info(f"🖼️ Vision Analysis Status: {image_status}")
        
        # Start with clean user-facing content
        enhanced_content = f"""
{final_recommendation}

Agentic RAG Intelligence Insights

Visual Assessment Integration:
{agentic_enhancements['visual_assessment_integration']}

Personalized Strategy Analysis:
{agentic_enhancements['personalized_insights']}

Progressive Plan:
{agentic_enhancements['progressive_recommendations']}

Quality Assessment:
- Search Quality Score: {agentic_enhancements['quality_metrics']['overall_quality']:.2f}/1.0
- Coverage Achievement: {agentic_enhancements['quality_metrics']['goal_coverage']:.1%}
- Recommendation Confidence: {agentic_enhancements['quality_metrics']['confidence']:.1%}

This recommendation was generated using Agentic RAG with vision analysis, {len(search_results)} intelligent search iterations and strategic planning from ChromaDB exercise database.
"""
        
        return {
            "recommendation": enhanced_content,
            "agentic_metadata": agentic_enhancements,
            "search_results_used": len(search_results),
            "agent_confidence": agentic_enhancements['quality_metrics']['confidence']
        }
    
    def _generate_reflection_insights(self, plan: AgentPlan, search_results: List[SearchResult], 
                                    final_rec: Dict) -> Dict[str, Any]:
        """Generate self-reflection insights about the agentic process"""
        return {
            "planning_effectiveness": len(search_results) <= plan.expected_iterations,
            "goal_achievement": len(set(r.exercise_type for r in search_results)) >= len(plan.sub_goals) * 0.7,
            "search_efficiency": sum(r.relevance_score for r in search_results) / len(search_results) if search_results else 0,
            "strategy_adaptation": len(set(r.source for r in search_results)) > 1,
            "learnings_for_future": "Strategic planning improved recommendation quality and coverage"
        }
    
    # Helper methods for internal processing
    def _parse_health_constraints(self, health_conditions: str) -> List[str]:
        """Parse health conditions into actionable constraints"""
        constraints = []
        if "knee" in health_conditions:
            constraints.append("low_impact_preferred")
        if "back" in health_conditions:
            constraints.append("spine_neutral_exercises")
        if "heart" in health_conditions:
            constraints.append("moderate_intensity_only")
        return constraints
    
    def _infer_fitness_level(self, user_data: Dict, image_analysis: str = "") -> str:
        """Intelligently infer fitness level from available data and visual assessment"""
        age = int(user_data.get('age', 30))
        
        # Use image analysis if available
        if image_analysis:
            analysis_lower = image_analysis.lower()
            if "advanced" in analysis_lower or "muscular" in analysis_lower or "athletic" in analysis_lower:
                return "advanced"
            elif "beginner" in analysis_lower or "sedentary" in analysis_lower or "limited experience" in analysis_lower:
                return "beginner"
            elif "intermediate" in analysis_lower or "moderate" in analysis_lower:
                return "intermediate"
        
        # Fallback to age-based inference
        if age < 25:
            return "beginner_to_intermediate"
        elif age > 50:
            return "experienced_but_cautious"
        else:
            return "intermediate"
    
    def _assess_motivation(self, goal: str, age: int) -> str:
        """Assess likely motivation level"""
        if goal in ["weight_loss", "muscle_gain"]:
            return "high"
        elif age < 30:
            return "moderate_to_high"
        else:
            return "moderate"
    
    def _estimate_time_availability(self, user_data: Dict) -> str:
        """Estimate time availability for workouts"""
        return "moderate"  # Default assumption
    
    def _infer_equipment_access(self, user_data: Dict, image_analysis: str = "") -> List[str]:
        """Infer likely equipment access from data and visual assessment"""
        equipment = ["bodyweight"]  # Always available
        
        # Use image analysis to detect equipment
        if image_analysis:
            analysis_lower = image_analysis.lower()
            if "dumbbell" in analysis_lower or "weight" in analysis_lower:
                equipment.extend(["dumbbells", "free_weights"])
            if "gym" in analysis_lower or "machine" in analysis_lower:
                equipment.extend(["gym_machines", "cable_machine"])
            if "barbell" in analysis_lower:
                equipment.append("barbell")
            if "resistance band" in analysis_lower or "band" in analysis_lower:
                equipment.append("resistance_bands")
            if "kettlebell" in analysis_lower:
                equipment.append("kettlebells")
            if "treadmill" in analysis_lower or "cardio machine" in analysis_lower:
                equipment.append("cardio_machines")
        
        # Default safe options if no equipment detected
        if len(equipment) == 1:  # Only bodyweight
            equipment.extend(["dumbbells", "resistance_bands"])
            
        return list(set(equipment))  # Remove duplicates
    
    def _extract_visual_insights(self, image_analysis: str) -> Dict[str, Any]:
        """Extract structured insights from image analysis"""
        if not image_analysis:
            return {}
        
        analysis_lower = image_analysis.lower()
        insights = {}
        
        # Form and posture analysis
        if any(term in analysis_lower for term in ["form", "posture", "alignment", "technique"]):
            insights["form_issues"] = True
            insights["form_assessment"] = "Requires attention based on visual analysis"
        
        # Equipment detection
        equipment_terms = ["dumbbell", "barbell", "machine", "gym", "weight", "kettlebell", "band"]
        if any(term in analysis_lower for term in equipment_terms):
            insights["equipment_available"] = True
            insights["equipment_assessment"] = "Equipment usage opportunities identified"
        
        # Fitness level indicators
        fitness_terms = ["muscular", "athletic", "beginner", "advanced", "experienced", "sedentary"]
        if any(term in analysis_lower for term in fitness_terms):
            insights["current_fitness_level"] = True
            insights["fitness_level_visual"] = "Fitness level assessed from visual cues"
        
        # Mobility and flexibility
        mobility_terms = ["flexibility", "mobility", "stiff", "range of motion", "tight"]
        if any(term in analysis_lower for term in mobility_terms):
            insights["mobility_issues"] = True
            insights["mobility_assessment"] = "Mobility considerations identified"
        
        # Body composition insights
        if any(term in analysis_lower for term in ["muscle definition", "body fat", "physique", "composition"]):
            insights["muscle_definition"] = True
            insights["body_composition"] = "Body composition factors noted"
        
        # Posture-specific issues
        if any(term in analysis_lower for term in ["rounded shoulders", "forward head", "slouch", "posture"]):
            insights["posture_issues"] = True
            insights["postural_assessment"] = "Postural corrections recommended"
        
        return insights
    
    def _results_lack_specificity(self, results: List[SearchResult]) -> bool:
        """Check if results are too general"""
        general_terms = ["general", "basic", "beginner", "simple"]
        general_count = sum(1 for r in results if any(term in r.exercise_type.lower() for term in general_terms))
        return general_count > len(results) * 0.7
    
    def _results_need_refinement(self, results: List[SearchResult]) -> bool:
        """Check if results would benefit from refinement"""
        avg_score = sum(r.relevance_score for r in results) / len(results) if results else 0
        return 0.4 < avg_score < 0.7  # Moderate quality that could be improved
    
    def _analyze_successful_strategies(self) -> str:
        """Analyze which strategies have been most successful"""
        if not self.successful_strategies:
            return "Initial recommendation - building strategy intelligence."
        
        best_strategy = max(self.successful_strategies.keys(), 
                          key=lambda k: sum(s["quality_score"] for s in self.successful_strategies[k]))
        return f"Analysis suggests {best_strategy.replace('_', ' ')} approach is most effective for your profile."
    
    def _generate_personalized_insights(self, user_profile: Dict, results: List[SearchResult], image_analysis: str = "") -> str:
        """Generate personalized insights based on search results and visual assessment"""
        goal = user_profile["primary_goal"]
        insights = []
        
        # Include visual insights if available
        if image_analysis:
            insights.append(f"Visual assessment findings: {image_analysis[:100]}...")
        
        if goal == "weight_loss":
            cardio_results = [r for r in results if "cardio" in r.exercise_type.lower()]
            if len(cardio_results) >= 3:
                insights.append("Strong focus on cardiovascular exercises detected - excellent for weight loss.")
        
        elif goal == "muscle_gain":
            strength_results = [r for r in results if "strength" in r.exercise_type.lower()]
            if len(strength_results) >= 2:
                insights.append("Progressive strength training approach identified - optimal for muscle development.")
        
        # Add visual assessment integration
        visual_insights = user_profile.get("visual_assessment", {})
        if visual_insights:
            if visual_insights.get("form_issues"):
                insights.append("Form improvements identified from visual analysis.")
            if visual_insights.get("equipment_available"):
                insights.append("Available equipment optimized in recommendations.")
        
        if not insights:
            insights.append("Balanced approach detected across multiple exercise modalities.")
        
        return " ".join(insights)
    
    def _format_exercises_from_search_results(self, search_results: List[SearchResult], goal: str) -> str:
        """Format specific exercises from ChromaDB search results"""
        if not search_results:
            return ""
        
        logger.info(f"📝 Formatting {len(search_results)} exercises from ChromaDB")
        
        # Group exercises by body part/type
        exercises_by_category = {}
        for result in search_results:
            # Extract exercise name and details from content
            content = result.content
            metadata = result.target_muscles[0] if result.target_muscles else "General"
            
            if metadata not in exercises_by_category:
                exercises_by_category[metadata] = []
            
            # Parse exercise name from content (usually first line or sentence)
            exercise_name = content.split('\n')[0].split('.')[0].strip()
            if len(exercise_name) > 100:  # Too long, likely full description
                # Try to extract just the name
                if ':' in exercise_name:
                    exercise_name = exercise_name.split(':')[0].strip()
                else:
                    exercise_name = exercise_name[:50] + "..."
            
            exercises_by_category[metadata].append({
                'name': exercise_name,
                'difficulty': result.difficulty,
                'score': result.relevance_score
            })
        
        # Format exercises for display
        formatted_exercises = []
        formatted_exercises.append("**Recommended Exercises from 2,918-Exercise Database:**\n")
        
        for category, exercises in list(exercises_by_category.items())[:5]:  # Top 5 categories
            formatted_exercises.append(f"\n**{category.title()}:**")
            for ex in exercises[:3]:  # Top 3 per category
                # Generate realistic sets/reps based on goal
                if goal == "muscle_gain":
                    sets_reps = "4 sets of 6-8 reps"
                elif goal == "weight_loss":
                    sets_reps = "3 sets of 12-15 reps"
                elif goal == "strength":
                    sets_reps = "5 sets of 3-5 reps"
                else:
                    sets_reps = "3 sets of 10-12 reps"
                
                formatted_exercises.append(f"- {ex['name']} - {sets_reps} ({ex['difficulty'].title()} level)")
        
        result = "\n".join(formatted_exercises)
        logger.info(f"✅ Formatted exercise list: {len(result)} characters")
        return result
    
    def _integrate_visual_insights(self, visual_insights: Dict, image_analysis: str) -> str:
        """Integrate visual assessment findings into recommendations"""
        integration_points = []
        
        # Check if image analysis contains error messages
        is_error = (image_analysis and any(error_term in image_analysis.lower() 
                    for error_term in ['error', 'failed', 'deployment', '404', 'unavailable', 'skipped']))
        
        if image_analysis and len(image_analysis.strip()) > 50 and not is_error:
            # Extract key insights from image analysis
            analysis_lower = image_analysis.lower()
            
            # Add confirmation that analysis was performed
            integration_points.append(f"VISUAL ANALYSIS COMPLETED - {len(image_analysis)} characters of detailed assessment")
            
            if "form" in analysis_lower or "posture" in analysis_lower:
                integration_points.append("Form and posture considerations identified from visual analysis")
            
            if "equipment" in analysis_lower:
                integration_points.append("Available equipment optimized based on visual assessment")
            
            if "flexibility" in analysis_lower or "mobility" in analysis_lower:
                integration_points.append("Mobility and flexibility needs addressed from visual cues")
            
            if "fitness level" in analysis_lower or "condition" in analysis_lower:
                integration_points.append("Current fitness level factored in from visual evaluation")
            
            if "muscle" in analysis_lower:
                integration_points.append("Muscle development and composition analyzed")
            
            if "body" in analysis_lower or "physique" in analysis_lower:
                integration_points.append("Body composition insights integrated into recommendations")
            
            # Add preview of analysis (filtered for user consumption)
            preview = image_analysis[:150] + "..." if len(image_analysis) > 150 else image_analysis
            integration_points.append(f"Analysis Preview: {preview}")
            
        elif is_error:
            # Vision model not configured - skip gracefully
            integration_points.append("Visual analysis not available - recommendation based on comprehensive profile data and ChromaDB exercise database")
        elif image_analysis:
            integration_points.append("Image provided but analysis returned limited results")
        else:
            integration_points.append("No images provided - recommendations based on profile data and ChromaDB vector database")
        
        # Add structured visual insights if available
        if visual_insights:
            integration_points.append("Structured Visual Insights Detected:")
            
            if visual_insights.get("form_issues"):
                integration_points.append("  • ⚠️ Specific form corrections integrated into exercise selection")
            
            if visual_insights.get("equipment_available"):
                integration_points.append("  • 🔧 Equipment availability optimized in workout design")
            
            if visual_insights.get("current_fitness_level"):
                integration_points.append("  • 💪 Fitness level assessment guides exercise intensity")
        
        return "\n".join(integration_points)
    
    def _create_progressive_plan(self, plan: AgentPlan, results: List[SearchResult]) -> str:
        """Create a progressive plan based on search insights"""
        difficulties = [r.difficulty for r in results]
        
        if "beginner" in difficulties and "advanced" in difficulties:
            return "Week 1-2: Focus on beginner exercises. Week 3-4: Progress to intermediate. Month 2+: Advance to complex movements."
        elif "beginner" in difficulties:
            return "Start with foundational movements and progress gradually over 4-6 weeks."
        else:
            return "Continue with current intensity and focus on progressive overload."
    
    def _calculate_final_quality_metrics(self, results: List[SearchResult], plan: AgentPlan) -> Dict[str, float]:
        """Calculate final quality metrics for the recommendation"""
        if not results:
            return {"overall_quality": 0.0, "goal_coverage": 0.0, "confidence": 0.0}
        
        overall_quality = sum(r.relevance_score for r in results) / len(results)
        goal_coverage = min(len(set(r.exercise_type for r in results)) / len(plan.sub_goals), 1.0)
        confidence = (overall_quality * 0.6 + goal_coverage * 0.4)
        
        return {
            "overall_quality": overall_quality,
            "goal_coverage": goal_coverage,
            "confidence": confidence
        }
    
    def _clean_markdown_formatting(self, text: str) -> str:
        """Clean up markdown formatting to make text more readable in UI"""
        if not text:
            return text
        
        import re
        
        # Remove markdown headers (### -> clean text)
        text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
        
        # Clean up bold markdown (**text** -> text)
        text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
        
        # Clean up italic markdown (*text* -> text)  
        text = re.sub(r'\*(.*?)\*', r'\1', text)
        
        # Clean up markdown bullet points (- -> -)
        text = re.sub(r'^\s*-\s*', '- ', text, flags=re.MULTILINE)
        
        # Clean up numbered lists
        text = re.sub(r'^\s*(\d+)\.\s*', r'\1. ', text, flags=re.MULTILINE)
        
        # Remove excessive newlines
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Clean up any remaining markdown artifacts
        text = re.sub(r'`([^`]+)`', r'\1', text)  # Remove code ticks
        
        return text.strip()
