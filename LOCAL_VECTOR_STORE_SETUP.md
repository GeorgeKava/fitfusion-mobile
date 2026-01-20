# Local Vector Store Implementation Guide

## Overview
This guide explains how to implement a local, free vector store for the Fitness Advisor app to store and retrieve user data, workout plans, and recommendations using semantic search.

## Recommended Solution: Vectra

**Vectra** is a lightweight, local vector database for Node.js that:
- Runs entirely locally (no cloud dependencies)
- Free and open-source
- Works with any embedding model
- Supports metadata filtering
- Perfect for storing user fitness data

## Installation

```bash
cd backend
npm install vectra
npm install @xenova/transformers  # For generating embeddings
```

## Implementation

### 1. Create Vector Store Module (`backend/vectorStore.js`)

```javascript
const { LocalIndex } = require('vectra');
const { pipeline } = require('@xenova/transformers');
const path = require('path');
const fs = require('fs').promises;

class FitnessVectorStore {
  constructor() {
    this.index = null;
    this.embedder = null;
    this.indexPath = path.join(__dirname, 'vector_db');
  }

  async initialize() {
    // Create embedder using Xenova transformers (runs locally)
    this.embedder = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2'  // Small, fast model
    );

    // Create or load index
    this.index = new LocalIndex(this.indexPath);
    
    if (!(await this.index.isIndexCreated())) {
      await this.index.createIndex();
      console.log('Vector index created');
    } else {
      console.log('Vector index loaded');
    }
  }

  async generateEmbedding(text) {
    const output = await this.embedder(text, {
      pooling: 'mean',
      normalize: true
    });
    return Array.from(output.data);
  }

  // Store user profile with vector embedding
  async storeUserProfile(userData) {
    const { 
      email, 
      username,
      firstName, 
      middleName, 
      lastName, 
      age, 
      weight, 
      height, 
      gender,
      fitnessLevel,
      agentType,
      medicalConditions 
    } = userData;

    // Create searchable text representation
    const profileText = `
      User: ${username} (${firstName} ${middleName} ${lastName})
      Email: ${email}
      Age: ${age}, Gender: ${gender}
      Weight: ${weight} lbs, Height: ${height} inches
      Fitness Level: ${fitnessLevel}
      Coach Type: ${agentType}
      Medical Conditions: ${medicalConditions.join(', ')}
    `.trim();

    // Generate embedding
    const embedding = await this.generateEmbedding(profileText);

    // Store in vector database
    await this.index.insertItem({
      vector: embedding,
      metadata: {
        type: 'user_profile',
        email,
        username,
        firstName,
        middleName,
        lastName,
        age,
        weight,
        height,
        gender,
        fitnessLevel,
        agentType,
        medicalConditions,
        createdAt: new Date().toISOString()
      }
    });

    console.log(`User profile stored: ${email}`);
  }

  // Store workout plan
  async storeWorkoutPlan(email, workoutPlan) {
    const planText = `
      Workout plan for ${email}
      ${JSON.stringify(workoutPlan)}
    `.trim();

    const embedding = await this.generateEmbedding(planText);

    await this.index.insertItem({
      vector: embedding,
      metadata: {
        type: 'workout_plan',
        email,
        plan: workoutPlan,
        createdAt: new Date().toISOString()
      }
    });
  }

  // Store food recommendation
  async storeFoodRecommendation(email, recommendation) {
    const recText = `
      Food recommendation for ${email}
      ${JSON.stringify(recommendation)}
    `.trim();

    const embedding = await this.generateEmbedding(recText);

    await this.index.insertItem({
      vector: embedding,
      metadata: {
        type: 'food_recommendation',
        email,
        recommendation,
        createdAt: new Date().toISOString()
      }
    });
  }

  // Semantic search
  async search(query, type = null, topK = 5) {
    const queryEmbedding = await this.generateEmbedding(query);
    
    const results = await this.index.queryItems(queryEmbedding, topK);
    
    // Filter by type if specified
    if (type) {
      return results.filter(r => r.item.metadata.type === type);
    }
    
    return results;
  }

  // Get user by email (exact match)
  async getUserByEmail(email) {
    const results = await this.index.listItems();
    return results.find(
      item => item.metadata.type === 'user_profile' && 
              item.metadata.email === email
    );
  }

  // Get user by username
  async getUserByUsername(username) {
    const results = await this.index.listItems();
    return results.find(
      item => item.metadata.type === 'user_profile' && 
              item.metadata.username === username
    );
  }

  // Get all workout plans for user
  async getUserWorkoutPlans(email) {
    const results = await this.index.listItems();
    return results.filter(
      item => item.metadata.type === 'workout_plan' && 
              item.metadata.email === email
    );
  }

  // Get all food recommendations for user
  async getUserFoodRecommendations(email) {
    const results = await this.index.listItems();
    return results.filter(
      item => item.metadata.type === 'food_recommendation' && 
              item.metadata.email === email
    );
  }

  // Delete user data
  async deleteUserData(email) {
    const items = await this.index.listItems();
    const userItems = items.filter(item => item.metadata.email === email);
    
    for (const item of userItems) {
      await this.index.deleteItem(item.id);
    }
    
    console.log(`Deleted ${userItems.length} items for ${email}`);
  }
}

module.exports = new FitnessVectorStore();
```

### 2. Update Flask Backend (`backend/app.py`)

Add vector store initialization:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json

app = Flask(__name__)
CORS(app)

# Initialize Node.js vector store process
vector_store_process = None

def init_vector_store():
    global vector_store_process
    # Start Node.js vector store as a subprocess
    vector_store_process = subprocess.Popen(
        ['node', 'vectorStoreServer.js'],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    print("Vector store initialized")

# Call on startup
init_vector_store()

@app.route('/api/vector/store-profile', methods=['POST'])
def store_profile_vector():
    try:
        data = request.json
        # Send to Node.js vector store via HTTP or IPC
        # Implementation depends on your setup
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

### 3. Create Vector Store Server (`backend/vectorStoreServer.js`)

```javascript
const express = require('express');
const vectorStore = require('./vectorStore');
const app = express();
const PORT = 5002;

app.use(express.json());

// Initialize vector store
vectorStore.initialize().then(() => {
  console.log('Vector store ready');
});

// Store user profile
app.post('/store-profile', async (req, res) => {
  try {
    await vectorStore.storeUserProfile(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search
app.post('/search', async (req, res) => {
  try {
    const { query, type, topK } = req.body;
    const results = await vectorStore.search(query, type, topK);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user by email
app.get('/user/:email', async (req, res) => {
  try {
    const user = await vectorStore.getUserByEmail(req.params.email);
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Vector store server running on port ${PORT}`);
});
```

### 4. Alternative: Pure Python Solution with ChromaDB

If you prefer to stay in Python:

```bash
pip install chromadb
```

```python
import chromadb
from chromadb.config import Settings

# Initialize ChromaDB (persistent, local)
client = chromadb.Client(Settings(
    chroma_db_impl="duckdb+parquet",
    persist_directory="./chroma_db"
))

# Create collection
collection = client.get_or_create_collection(
    name="fitness_users",
    metadata={"description": "User fitness profiles"}
)

# Store user profile
def store_user_profile(user_data):
    collection.add(
        documents=[f"{user_data['username']} {user_data['firstName']} {user_data['lastName']}"],
        metadatas=[user_data],
        ids=[user_data['email']]
    )

# Search users
def search_users(query, n_results=5):
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    return results
```

## Benefits

1. **No Cloud Dependencies**: Runs entirely on your local machine
2. **Free**: No API costs or subscriptions
3. **Fast**: Local processing, no network latency
4. **Privacy**: User data never leaves your server
5. **Semantic Search**: Find similar users, workouts, and recommendations
6. **Flexible**: Works with any embedding model

## Usage Examples

```javascript
// Store user profile
await vectorStore.storeUserProfile({
  email: 'user@example.com',
  username: 'johndoe',
  firstName: 'John',
  middleName: '',
  lastName: 'Doe',
  age: 30,
  weight: 180,
  height: 72,
  gender: 'male',
  fitnessLevel: 'intermediate',
  agentType: 'personal_trainer',
  medicalConditions: ['knee injury']
});

// Semantic search
const results = await vectorStore.search(
  'users with knee problems who want to lose weight',
  'user_profile',
  5
);

// Get user by email
const user = await vectorStore.getUserByEmail('user@example.com');

// Get user's workout history
const workouts = await vectorStore.getUserWorkoutPlans('user@example.com');
```

## Next Steps

1. Install dependencies
2. Create vectorStore.js module
3. Initialize on app startup
4. Update registration to store in vector DB
5. Add semantic search endpoints
6. Integrate with existing features

## Notes

- Vector DB files will be stored in `backend/vector_db/`
- First run downloads the embedding model (~25MB)
- Model runs entirely offline after download
- No GPU required (CPU is sufficient)
