"""
Local Vector Store for Fitness Advisor
Uses ChromaDB for persistent, local vector storage
App Store Compatible - runs on your backend server
"""

import chromadb
from chromadb.utils import embedding_functions
import json
from datetime import datetime
import os

class FitnessVectorStore:
    def __init__(self, persist_directory=None):
        """
        Initialize ChromaDB with persistent storage
        
        Storage Location:
        - Local dev: ./chroma_db folder in backend directory
        - Cloud deployment: Server disk storage (e.g., /var/data/chroma_db)
        - Data persists across server restarts
        - NOT on user's device - runs on your server
        """
        if persist_directory is None:
            # Use environment variable for cloud deployment, default for local
            persist_directory = os.getenv('CHROMA_DB_PATH', './chroma_db')
        
        # New ChromaDB API (v1.3+)
        self.client = chromadb.PersistentClient(
            path=persist_directory,
            settings=chromadb.Settings(anonymized_telemetry=False)
        )
        
        print(f"📦 Vector store location: {persist_directory}")
        
        # Use default embedding function (sentence-transformers)
        # This runs locally, no API calls
        self.embedding_fn = embedding_functions.DefaultEmbeddingFunction()
        
        # Create collections
        self.users_collection = self.client.get_or_create_collection(
            name="fitness_users",
            embedding_function=self.embedding_fn,
            metadata={"description": "User fitness profiles"}
        )
        
        self.workouts_collection = self.client.get_or_create_collection(
            name="workout_plans",
            embedding_function=self.embedding_fn,
            metadata={"description": "User workout plans"}
        )
        
        self.food_collection = self.client.get_or_create_collection(
            name="food_recommendations",
            embedding_function=self.embedding_fn,
            metadata={"description": "Food recommendations"}
        )
        
        self.exercise_collection = self.client.get_or_create_collection(
            name="exercise_database",
            embedding_function=self.embedding_fn,
            metadata={"description": "Exercise database for RAG recommendations"}
        )
        
        print("✅ Vector store initialized (local, App Store compatible)")
        print(f"📊 Exercise collection count: {self.exercise_collection.count()}")
    
    def store_user_profile(self, user_data):
        """Store user profile with semantic search capability (including password if provided)"""
        email = user_data.get('email')
        
        # Handle medicalConditions - convert list to string or keep as is
        medical_conditions = user_data.get('medicalConditions', [])
        if isinstance(medical_conditions, list):
            medical_conditions_text = ', '.join(medical_conditions) if medical_conditions else 'None'
        else:
            medical_conditions_text = str(medical_conditions)
        
        # Create searchable text
        profile_text = f"""
        User: {user_data.get('username')} ({user_data.get('firstName')} {user_data.get('middleName', '')} {user_data.get('lastName')})
        Age: {user_data.get('age')}, Gender: {user_data.get('gender')}
        Weight: {user_data.get('weight')} lbs, Height: {user_data.get('height')} inches
        Fitness Level: {user_data.get('fitnessLevel')}
        Coach Type: {user_data.get('agentType')}
        Medical Conditions: {medical_conditions_text}
        """.strip()
        
        # Create metadata - ensure medicalConditions is a string
        metadata = dict(user_data)
        metadata['medicalConditions'] = medical_conditions_text
        metadata['created_at'] = datetime.utcnow().isoformat()
        metadata['type'] = 'user_profile'
        # Password is stored in metadata (hashed) if provided
        if 'password' in user_data:
            metadata['password'] = user_data['password']
        
        # Store with metadata
        self.users_collection.upsert(
            documents=[profile_text],
            metadatas=[metadata],
            ids=[email]
        )
        
        print(f"✅ User profile stored: {email}")
        return True
    
    def store_workout_plan(self, email, workout_plan):
        """Store workout plan for semantic search"""
        plan_id = f"{email}_{datetime.utcnow().timestamp()}"
        
        plan_text = f"Workout plan for {email}: {json.dumps(workout_plan)}"
        
        self.workouts_collection.add(
            documents=[plan_text],
            metadatas=[{
                'email': email,
                'plan': json.dumps(workout_plan),
                'created_at': datetime.utcnow().isoformat(),
                'type': 'workout_plan'
            }],
            ids=[plan_id]
        )
        
        return plan_id
    
    def store_food_recommendation(self, email, recommendation):
        """Store food recommendation"""
        rec_id = f"{email}_{datetime.utcnow().timestamp()}"
        
        rec_text = f"Food recommendation for {email}: {json.dumps(recommendation)}"
        
        self.food_collection.add(
            documents=[rec_text],
            metadatas=[{
                'email': email,
                'recommendation': json.dumps(recommendation),
                'created_at': datetime.utcnow().isoformat(),
                'type': 'food_recommendation'
            }],
            ids=[rec_id]
        )
        
        return rec_id
    
    def store_weekly_plan(self, email, weekly_plan):
        """Store weekly fitness plan in ChromaDB"""
        # Use email as ID so each user only has one current weekly plan
        plan_id = f"weekly_plan_{email}"
        
        plan_text = f"Weekly fitness plan for {email}: {json.dumps(weekly_plan)}"
        
        metadata = {
            'email': email,
            'plan': json.dumps(weekly_plan),
            'created_at': datetime.utcnow().isoformat(),
            'type': 'weekly_plan'
        }
        
        # Upsert to replace existing plan
        self.workouts_collection.upsert(
            documents=[plan_text],
            metadatas=[metadata],
            ids=[plan_id]
        )
        
        print(f"✅ Weekly plan stored in ChromaDB for: {email}")
        return plan_id
    
    def get_weekly_plan(self, email):
        """Get the weekly fitness plan for a user from ChromaDB"""
        plan_id = f"weekly_plan_{email}"
        try:
            result = self.workouts_collection.get(ids=[plan_id])
            if result['ids'] and result['metadatas']:
                metadata = result['metadatas'][0]
                return json.loads(metadata['plan'])
            return None
        except Exception as e:
            print(f"Error getting weekly plan: {e}")
            return None
    
    def delete_weekly_plan(self, email):
        """Delete the weekly fitness plan for a user from ChromaDB"""
        plan_id = f"weekly_plan_{email}"
        try:
            self.workouts_collection.delete(ids=[plan_id])
            print(f"✅ Weekly plan deleted from ChromaDB for: {email}")
            return True
        except Exception as e:
            print(f"Error deleting weekly plan: {e}")
            return False
            return None
    
    def get_user_by_email(self, email):
        """Get user profile by exact email match"""
        try:
            result = self.users_collection.get(ids=[email])
            if result['ids']:
                return result['metadatas'][0]
            return None
        except Exception as e:
            print(f"Error getting user: {e}")
            return None
    
    def get_user_by_username(self, username):
        """Get user by username"""
        results = self.users_collection.get(
            where={"username": username}
        )
        
        if results['ids']:
            return results['metadatas'][0]
        return None
    
    def semantic_search_users(self, query, n_results=5):
        """Semantic search across user profiles"""
        results = self.users_collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        return {
            'users': results['metadatas'][0] if results['metadatas'] else [],
            'distances': results['distances'][0] if results['distances'] else []
        }
    
    def get_user_workout_plans(self, email, n_results=10):
        """Get all workout plans for a user"""
        results = self.workouts_collection.get(
            where={"email": email}
        )
        
        return results['metadatas'] if results['metadatas'] else []
    
    def get_user_food_recommendations(self, email, n_results=10):
        """Get all food recommendations for a user"""
        results = self.food_collection.get(
            where={"email": email}
        )
        
        return results['metadatas'] if results['metadatas'] else []
    
    def semantic_search_workouts(self, query, email=None, n_results=5):
        """Semantic search for workout plans"""
        where_filter = {"email": email} if email else None
        
        results = self.workouts_collection.query(
            query_texts=[query],
            n_results=n_results,
            where=where_filter
        )
        
        return results['metadatas'][0] if results['metadatas'] else []
    
    def delete_user_data(self, email):
        """Delete all data for a user (GDPR compliance)"""
        try:
            # Delete user profile
            self.users_collection.delete(ids=[email])
            
            # Delete workouts
            workouts = self.workouts_collection.get(where={"email": email})
            if workouts['ids']:
                self.workouts_collection.delete(ids=workouts['ids'])
            
            # Delete food recommendations
            food_recs = self.food_collection.get(where={"email": email})
            if food_recs['ids']:
                self.food_collection.delete(ids=food_recs['ids'])
            
            print(f"✅ Deleted all data for {email}")
            return True
        except Exception as e:
            print(f"Error deleting user data: {e}")
            return False
    
    def get_stats(self):
        """Get database statistics"""
        return {
            'total_users': self.users_collection.count(),
            'total_workouts': self.workouts_collection.count(),
            'total_food_recs': self.food_collection.count(),
            'total_exercises': self.exercise_collection.count()
        }
    
    def load_exercises_from_csv(self, csv_path):
        """Load exercises from megaGymDataset.csv into ChromaDB"""
        import csv
        print(f"📥 Loading exercises from {csv_path}")
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                exercises = []
                metadatas = []
                ids = []
                
                for idx, row in enumerate(reader):
                    # Create searchable text combining all fields
                    title = row.get('Title', '').strip()
                    desc = row.get('Desc', '').strip()
                    exercise_type = row.get('Type', '').strip()
                    body_part = row.get('BodyPart', '').strip()
                    equipment = row.get('Equipment', '').strip()
                    level = row.get('Level', '').strip()
                    
                    if not title:  # Skip empty rows
                        continue
                    
                    # Create rich searchable text
                    searchable_text = f"""
                    Exercise: {title}
                    Description: {desc}
                    Type: {exercise_type}
                    Body Part: {body_part}
                    Equipment: {equipment}
                    Level: {level}
                    """.strip()
                    
                    # Create metadata
                    metadata = {
                        'title': title,
                        'description': desc,
                        'type': exercise_type,
                        'body_part': body_part,
                        'equipment': equipment,
                        'level': level,
                        'rating': row.get('Rating', ''),
                        'rating_desc': row.get('RatingDesc', '')
                    }
                    
                    exercises.append(searchable_text)
                    metadatas.append(metadata)
                    ids.append(f"exercise_{idx}")
                    
                    # Batch insert every 100 exercises
                    if len(exercises) >= 100:
                        self.exercise_collection.add(
                            documents=exercises,
                            metadatas=metadatas,
                            ids=ids
                        )
                        print(f"  ✅ Loaded {len(ids)} exercises...")
                        exercises = []
                        metadatas = []
                        ids = []
                
                # Insert remaining exercises
                if exercises:
                    self.exercise_collection.add(
                        documents=exercises,
                        metadatas=metadatas,
                        ids=ids
                    )
                    print(f"  ✅ Loaded final {len(ids)} exercises")
                
                total = self.exercise_collection.count()
                print(f"✅ Successfully loaded {total} exercises into ChromaDB")
                return True
                
        except Exception as e:
            print(f"❌ Error loading exercises: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def search_exercises(self, query, filters=None, top_k=10):
        """
        Search exercises using semantic similarity
        
        Args:
            query: Search query (e.g., "chest exercises for beginners")
            filters: Dict of metadata filters (e.g., {'level': 'Beginner', 'equipment': 'Bodyweight'})
            top_k: Number of results to return
        """
        try:
            where_filter = {}
            if filters:
                # Build ChromaDB where filter
                for key, value in filters.items():
                    if value:
                        where_filter[key] = value
            
            results = self.exercise_collection.query(
                query_texts=[query],
                n_results=top_k,
                where=where_filter if where_filter else None
            )
            
            # Format results
            exercises = []
            if results['documents'] and results['documents'][0]:
                for i in range(len(results['documents'][0])):
                    exercise = {
                        'content': results['documents'][0][i],
                        'metadata': results['metadatas'][0][i],
                        'distance': results['distances'][0][i] if 'distances' in results else None
                    }
                    exercises.append(exercise)
            
            print(f"🔍 Found {len(exercises)} exercises for query: '{query}'")
            return exercises
            
        except Exception as e:
            print(f"❌ Error searching exercises: {e}")
            return []
    
    def get_exercises_by_bodypart(self, body_part, level=None, top_k=20):
        """Get exercises for specific body part"""
        query = f"{body_part} exercises"
        filters = {'body_part': body_part}
        if level:
            filters['level'] = level
        return self.search_exercises(query, filters, top_k)
    
    def get_exercises_by_equipment(self, equipment, level=None, top_k=20):
        """Get exercises for specific equipment"""
        query = f"{equipment} exercises"
        filters = {'equipment': equipment}
        if level:
            filters['level'] = level
        return self.search_exercises(query, filters, top_k)
    
    def get_exercises_by_goal(self, goal, level=None, top_k=20):
        """Get exercises for specific fitness goal"""
        # Map goals to search queries
        goal_queries = {
            'weight_loss': 'cardio fat burning high intensity exercises',
            'muscle_gain': 'strength muscle building hypertrophy exercises',
            'strength': 'powerlifting strength heavy compound exercises',
            'cardio': 'cardio endurance running cycling exercises',
            'general': 'beginner full body functional fitness exercises'
        }
        
        query = goal_queries.get(goal, f'{goal} exercises')
        filters = {}
        if level:
            filters['level'] = level
        
        return self.search_exercises(query, filters, top_k)

# Singleton instance
vector_store = FitnessVectorStore()
