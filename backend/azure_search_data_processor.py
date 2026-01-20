
import os
import json
import csv
import asyncio
import logging
from typing import Dict, List, Any
from datetime import datetime
from dotenv import load_dotenv
from azure.search.documents import SearchClient
from azure.search.documents.aio import SearchClient as AsyncSearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import *
from azure.core.credentials import AzureKeyCredential

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FitnessDataProcessor:
    """Process and upload fitness datasets to Azure AI Search"""
    
    def __init__(self):
        self.search_endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
        self.search_key = os.getenv("AZURE_SEARCH_ADMIN_KEY") or os.getenv("AZURE_SEARCH_KEY")
        self.index_name = os.getenv("AZURE_SEARCH_INDEX_NAME", "fitness-index")
        
        if not self.search_endpoint or not self.search_key:
            raise ValueError("Azure Search credentials not configured. Please set AZURE_SEARCH_ENDPOINT and AZURE_SEARCH_KEY (or AZURE_SEARCH_ADMIN_KEY) environment variables.")
        
        self.credential = AzureKeyCredential(self.search_key)
        self.index_client = SearchIndexClient(
            endpoint=self.search_endpoint,
            credential=self.credential
        )
    
    def delete_index_if_exists(self):
        """Delete the existing index if it exists"""
        try:
            self.index_client.delete_index(self.index_name)
            logger.info(f"✅ Deleted existing index: {self.index_name}")
            return True
        except Exception as e:
            if "not found" in str(e).lower():
                logger.info(f"Index {self.index_name} does not exist, proceeding with creation")
                return True
            else:
                logger.error(f"Failed to delete index: {e}")
                return False
    
    def create_search_index(self):
        """Create the Azure AI Search index with comprehensive schema"""
        
        # Define fields for the fitness index
        fields = [
            SimpleField(name="id", type=SearchFieldDataType.String, key=True, sortable=True),
            SimpleField(name="type", type=SearchFieldDataType.String, filterable=True, facetable=True),
            
            # Exercise data fields
            SearchableField(name="title", type=SearchFieldDataType.String, analyzer_name="en.microsoft"),
            SearchableField(name="description", type=SearchFieldDataType.String, analyzer_name="en.microsoft"),
            SearchableField(name="instructions", type=SearchFieldDataType.String, analyzer_name="en.microsoft"),
            
            # Categories and classifications
            SimpleField(name="bodypart", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="equipment", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="target", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="level", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="category", type=SearchFieldDataType.String, filterable=True, facetable=True),
            
            # Muscle group fields (from megaGymDataset)
            SearchableField(name="secondaryMuscles", type=SearchFieldDataType.String, filterable=True),
            
            # Rating and metrics
            SimpleField(name="rating", type=SearchFieldDataType.Double, sortable=True, filterable=True),
            SimpleField(name="ratingDesc", type=SearchFieldDataType.String, filterable=True, facetable=True),
            
            # User tracking data fields (from gym_members_exercise_tracking)
            SimpleField(name="age", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="gender", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="weight", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="height", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="maxBPM", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="avgBPM", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="restingBPM", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="sessionDuration", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="caloriesBurned", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="workoutType", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="fatPercentage", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="waterIntake", type=SearchFieldDataType.Double, filterable=True),
            SimpleField(name="workoutFrequency", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="experienceLevel", type=SearchFieldDataType.Int32, filterable=True),
            SimpleField(name="BMI", type=SearchFieldDataType.Double, filterable=True),
            
            # Structured exercise data (from data.csv)
            SimpleField(name="muscle", type=SearchFieldDataType.String, filterable=True, facetable=True),
            
            # Metadata
            SimpleField(name="dataSource", type=SearchFieldDataType.String, filterable=True, facetable=True),
            SimpleField(name="uploadDate", type=SearchFieldDataType.DateTimeOffset, sortable=True),
            
            # Vector field for semantic search (if needed)
            SearchField(name="contentVector", type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                       searchable=True, vector_search_dimensions=1536, vector_search_profile_name="vector-profile")
        ]
        
        # Configure vector search
        vector_search = VectorSearch(
            profiles=[
                VectorSearchProfile(
                    name="vector-profile",
                    algorithm_configuration_name="vector-config"
                )
            ],
            algorithms=[
                HnswAlgorithmConfiguration(
                    name="vector-config",
                    parameters=HnswParameters(metric=VectorSearchAlgorithmMetric.COSINE)
                )
            ]
        )
        
        # Create the index
        index = SearchIndex(
            name=self.index_name,
            fields=fields,
            vector_search=vector_search,
            semantic_search=SemanticSearch(
                configurations=[
                    SemanticConfiguration(
                        name="fitness-semantic-config",
                        prioritized_fields=SemanticPrioritizedFields(
                            title_field=SemanticField(field_name="title"),
                            content_fields=[
                                SemanticField(field_name="description"),
                                SemanticField(field_name="instructions")
                            ],
                            keywords_fields=[
                                SemanticField(field_name="bodypart"),
                                SemanticField(field_name="equipment"),
                                SemanticField(field_name="target")
                            ]
                        )
                    )
                ]
            )
        )
        
        try:
            result = self.index_client.create_or_update_index(index)
            logger.info(f"Successfully created/updated index: {result.name}")
            return True
        except Exception as e:
            logger.error(f"Failed to create index: {e}")
            return False
    
    def process_mega_gym_dataset(self, csv_file_path: str) -> List[Dict[str, Any]]:
        """Process megaGymDataset.csv (2,919 exercises)"""
        documents = []
        
        try:
            with open(csv_file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for i, row in enumerate(reader):
                    # Process secondary muscles (convert array to string)
                    secondary_muscles = ""
                    if row.get('secondaryMuscles'):
                        try:
                            muscles_array = json.loads(row['secondaryMuscles'])
                            secondary_muscles = ', '.join(muscles_array) if muscles_array else ""
                        except:
                            secondary_muscles = ""
                    
                    # Process instructions (convert array to string)
                    instructions = ""
                    if row.get('instructions'):
                        try:
                            instructions_array = json.loads(row.get('instructions', '[]'))
                            instructions = '\n'.join(instructions_array) if instructions_array else ""
                        except:
                            instructions = ""
                    
                    doc = {
                        "id": f"exercise_{i+1}",
                        "type": "exercise",
                        "title": row.get('Title', ''),  # Fixed column name
                        "description": row.get('Desc', ''),  # Use actual description from CSV
                        "instructions": row.get('Desc', ''),  # Use description as instructions for now
                        "bodypart": row.get('BodyPart', ''),  # Fixed column name
                        "equipment": row.get('Equipment', ''),  # Fixed column name
                        "target": row.get('BodyPart', ''),  # Use BodyPart as target
                        "level": row.get('Level', 'Intermediate'),  # Use actual level from CSV
                        "category": row.get('Type', 'Strength'),  # Use Type as category
                        "secondaryMuscles": "",  # Not available in this dataset
                        "dataSource": "megaGymDataset",
                        "uploadDate": datetime.utcnow().isoformat() + "Z"
                    }
                    documents.append(doc)
            
            logger.info(f"Processed {len(documents)} exercises from megaGymDataset")
            return documents
            
        except Exception as e:
            logger.error(f"Error processing megaGymDataset: {e}")
            return []
    
    def process_gym_members_dataset(self, csv_file_path: str) -> List[Dict[str, Any]]:
        """Process gym_members_exercise_tracking.csv (974 user records)"""
        documents = []
        
        try:
            with open(csv_file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for i, row in enumerate(reader):
                    
                    doc = {
                        "id": f"member_{i+1}",
                        "type": "member_data",
                        "title": f"Member {i+1} - {row.get('Workout_Type', '')} Training",
                        "description": f"Performance data for {row.get('Gender', '')} member doing {row.get('Workout_Type', '')} training",
                        "age": self._safe_int(row.get('Age')),
                        "gender": row.get('Gender', ''),
                        "weight": self._safe_float(row.get('Weight (kg)')),
                        "height": self._safe_float(row.get('Height (m)')),
                        "maxBPM": self._safe_int(row.get('Max_BPM')),
                        "avgBPM": self._safe_int(row.get('Avg_BPM')),
                        "restingBPM": self._safe_int(row.get('Resting_BPM')),
                        "sessionDuration": self._safe_float(row.get('Session_Duration (hours)')),
                        "caloriesBurned": self._safe_float(row.get('Calories_Burned')),
                        "workoutType": row.get('Workout_Type', ''),
                        "fatPercentage": self._safe_float(row.get('Fat_Percentage')),
                        "waterIntake": self._safe_float(row.get('Water_Intake (liters)')),
                        "workoutFrequency": self._safe_int(row.get('Workout_Frequency (days/week)')),
                        "experienceLevel": self._safe_int(row.get('Experience_Level')),
                        "BMI": self._safe_float(row.get('BMI')),
                        "level": self._map_experience_to_level(self._safe_int(row.get('Experience_Level', 0))),
                        "dataSource": "gym_members_tracking",
                        "uploadDate": datetime.utcnow().isoformat() + "Z"
                    }
                    documents.append(doc)
            
            logger.info(f"Processed {len(documents)} member records from gym tracking data")
            return documents
            
        except Exception as e:
            logger.error(f"Error processing gym members dataset: {e}")
            return []
    
    def process_structured_exercise_dataset(self, csv_file_path: str) -> List[Dict[str, Any]]:
        """Process data.csv (208 structured exercises)"""
        documents = []
        
        try:
            with open(csv_file_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for i, row in enumerate(reader):
                    
                    doc = {
                        "id": f"structured_exercise_{i+1}",
                        "type": "structured_exercise",
                        "title": row.get('Title', ''),
                        "description": row.get('Desc', ''),
                        "muscle": row.get('Type', ''),
                        "bodypart": row.get('Type', ''),  # Map Type to bodypart
                        "level": row.get('Level', ''),
                        "rating": self._safe_float(row.get('Rating')),
                        "ratingDesc": row.get('RatingDesc', ''),
                        "equipment": self._infer_equipment_from_title(row.get('Title', '')),
                        "target": row.get('Type', ''),
                        "dataSource": "structured_exercises",
                        "uploadDate": datetime.utcnow().isoformat() + "Z"
                    }
                    documents.append(doc)
            
            logger.info(f"Processed {len(documents)} structured exercises")
            return documents
            
        except Exception as e:
            logger.error(f"Error processing structured exercise dataset: {e}")
            return []
    
    def _safe_int(self, value: str) -> int:
        """Safely convert string to int"""
        try:
            return int(float(value)) if value else 0
        except:
            return 0
    
    def _safe_float(self, value: str) -> float:
        """Safely convert string to float"""
        try:
            return float(value) if value else 0.0
        except:
            return 0.0
    
    def _map_equipment_to_level(self, equipment: str) -> str:
        """Map equipment type to difficulty level"""
        equipment = equipment.lower()
        if 'body weight' in equipment or 'bodyweight' in equipment:
            return 'beginner'
        elif 'dumbbell' in equipment or 'cable' in equipment:
            return 'intermediate'
        elif 'barbell' in equipment or 'machine' in equipment:
            return 'advanced'
        else:
            return 'beginner'
    
    def _map_experience_to_level(self, experience: int) -> str:
        """Map experience level number to string"""
        if experience <= 1:
            return 'beginner'
        elif experience <= 2:
            return 'intermediate'
        else:
            return 'advanced'
    
    def _infer_equipment_from_title(self, title: str) -> str:
        """Infer equipment type from exercise title"""
        title = title.lower()
        if 'dumbbell' in title:
            return 'dumbbell'
        elif 'barbell' in title:
            return 'barbell'
        elif 'machine' in title:
            return 'machine'
        elif 'cable' in title:
            return 'cable'
        else:
            return 'bodyweight'
    
    async def upload_documents_to_index(self, documents: List[Dict[str, Any]], batch_size: int = 1000):
        """Upload documents to Azure AI Search index in batches"""
        
        async with AsyncSearchClient(
            endpoint=self.search_endpoint,
            index_name=self.index_name,
            credential=self.credential
        ) as search_client:
            
            total_uploaded = 0
            
            # Process in batches
            for i in range(0, len(documents), batch_size):
                batch = documents[i:i + batch_size]
                
                try:
                    result = await search_client.upload_documents(documents=batch)
                    successful_uploads = sum(1 for r in result if r.succeeded)
                    total_uploaded += successful_uploads
                    
                    logger.info(f"Uploaded batch {i//batch_size + 1}: {successful_uploads}/{len(batch)} documents successful")
                    
                    # Log any failures
                    failures = [r for r in result if not r.succeeded]
                    if failures:
                        for failure in failures:
                            logger.warning(f"Failed to upload document {failure.key}: {failure.error_message}")
                
                except Exception as e:
                    logger.error(f"Failed to upload batch {i//batch_size + 1}: {e}")
            
            logger.info(f"Total documents uploaded successfully: {total_uploaded}/{len(documents)}")
            return total_uploaded
    
    async def process_and_upload_all_datasets(self, dataset_paths: Dict[str, str]):
        """Process all three datasets and upload to Azure AI Search"""
        
        # Step 1: Create the index
        logger.info("Creating Azure AI Search index...")
        if not self.create_search_index():
            logger.error("Failed to create search index. Aborting upload.")
            return False
        
        all_documents = []
        
        # Step 2: Process each dataset
        if 'mega_gym' in dataset_paths:
            logger.info("Processing megaGymDataset...")
            mega_gym_docs = self.process_mega_gym_dataset(dataset_paths['mega_gym'])
            all_documents.extend(mega_gym_docs)
        
        # Skip gym members dataset to avoid member data in exercise searches
        # if 'gym_members' in dataset_paths:
        #     logger.info("Processing gym members dataset...")
        #     gym_members_docs = self.process_gym_members_dataset(dataset_paths['gym_members'])
        #     all_documents.extend(gym_members_docs)
        logger.info("Skipping gym members dataset to focus on exercise data only")
        
        if 'structured_exercises' in dataset_paths:
            logger.info("Processing structured exercises dataset...")
            structured_docs = self.process_structured_exercise_dataset(dataset_paths['structured_exercises'])
            all_documents.extend(structured_docs)
        
        # Step 3: Upload all documents
        logger.info(f"Uploading {len(all_documents)} total documents to Azure AI Search...")
        uploaded_count = await self.upload_documents_to_index(all_documents)
        
        logger.info(f"Data processing complete! {uploaded_count} documents uploaded to index '{self.index_name}'")
        return uploaded_count > 0


async def main():
    """Main function to process and upload fitness datasets"""
    
    # Initialize processor
    processor = FitnessDataProcessor()
    
    # Step 1: Delete existing index to start fresh
    logger.info("🗑️  Deleting existing index to avoid member data contamination...")
    if not processor.delete_index_if_exists():
        logger.error("Failed to delete existing index")
        return
    
    # Step 2: Create fresh index
    logger.info("🏗️  Creating fresh index for exercise data only...")
    if not processor.create_search_index():
        logger.error("Failed to create new index")
        return
    
    # Define dataset paths (excluding gym_members to avoid member data pollution)
    dataset_paths = {
        'mega_gym': 'megaGymDataset.csv',
        # 'gym_members': 'gym_members_exercise_tracking.csv',  # Excluded to focus on exercise data
        'structured_exercises': 'data.csv'
    }
    
    # Check if files exist
    missing_files = []
    for name, path in dataset_paths.items():
        if not os.path.exists(path):
            missing_files.append(path)
    
    if missing_files:
        logger.warning(f"Missing dataset files: {missing_files}")
        logger.info("Please ensure the CSV files are in the same directory as this script or update the paths.")
        
        # For demonstration, create sample data structure
        logger.info("Creating sample index structure for demonstration...")
        if processor.create_search_index():
            logger.info("Index created successfully. Upload your CSV files and run again to populate data.")
        return
    
    # Process and upload all datasets
    success = await processor.process_and_upload_all_datasets(dataset_paths)
    
    if success:
        logger.info("✅ All datasets processed and uploaded successfully!")
        logger.info(f"Your Azure AI Search index '{processor.index_name}' is ready for Agentic RAG!")
    else:
        logger.error("❌ Failed to process and upload datasets")


if __name__ == "__main__":
    asyncio.run(main())
