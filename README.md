# �‍♂️ FitFusion AI

A comprehensive AI-powered fitness application that provides personalized workout plans, nutrition guidance, real-time coaching, and progress tracking through advanced machine learning and voice interaction.

## 🌟 Key Features

### 🤖 AI-Powered Fitness Analysis
- **Body Scan Technology**: Upload photos for AI-powered body composition analysis
- **Personalized Recommendations**: Custom workout plans based on your fitness goals and body type
- **Multi-Modal Analysis**: Supports both quick analysis (15-30s) and comprehensive analysis (45-90s)
- **Agent-Specific Coaching**: 6 specialized fitness agents for different goals

### 🍎 Smart Nutrition System
- **Food Recognition**: AI-powered food identification from photos
- **Ingredient Analysis**: Get healthy recipe suggestions from ingredient photos
- **Personalized Meal Plans**: Custom nutrition recommendations based on fitness goals
- **Nutritional Tracking**: Detailed calorie and macro analysis with height in inches
- **Dietary Restrictions**: Support for allergies and dietary preferences

### 📊 Comprehensive Progress Monitoring
- **Activity Logging**: Track workouts, calories burned, steps, miles run
- **Feeling Ratings**: Daily mood and energy level tracking with clear numerical indicators (1-5 scale)
- **Weekly Planning**: Structured workout schedules with progress tracking
- **Visual Analytics**: Charts and graphs showing your fitness journey
- **Goal Achievement**: Monitor progress towards specific fitness objectives

### 🎤 Voice-Powered AI Coach (NEW!)
- **Real-time Conversation**: Natural voice interaction with your AI fitness coach
- **WebRTC Integration**: Low-latency voice communication for seamless experience
- **Contextual Responses**: AI coach aware of your workout plans and progress data
- **Hands-free Operation**: Perfect for during workouts - no need to look at screen
- **Function Calling**: AI can access your profile, progress data, and today's workout plan

### 🔐 Secure User Management
- **Authentication System**: Secure registration and login
- **Profile Management**: Comprehensive fitness profiles with auto-save functionality
- **Data Persistence**: All data stored securely in Azure Search
- **Cross-device Sync**: Access your information from any device

### 📱 Modern User Interface
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Clean Material Design**: Modern UI with consistent blue and green theming
- **Intuitive Navigation**: Easy-to-use interface with clear visual hierarchy
- **Real-time Feedback**: Immediate responses and loading states

## 🛠 Technology Stack

### Frontend
- **React.js 18** - Modern UI framework with hooks
- **Bootstrap 5** - Responsive design and components
- **CSS3** - Custom styling with advanced animations
- **WebRTC** - Real-time voice communication
- **Axios** - HTTP client for API communication

### Backend
- **Python Flask** - RESTful API server
- **Azure OpenAI GPT-4o** - Advanced AI analysis and recommendations
- **Azure AI Search** - Intelligent data storage and retrieval
- **WebRTC Server** - Voice chat infrastructure
- **Model Context Protocol (MCP)** - Structured fitness data access

### AI & Machine Learning
- **Azure OpenAI GPT-4o Vision** - Image analysis and natural language processing
- **Computer Vision** - Body composition and food recognition analysis
- **Azure Cognitive Services** - Enhanced AI capabilities
- **Retrieval-Augmented Generation (RAG)** - Context-aware recommendations

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **Python** (v3.9 or higher)
- **Azure Account** with the following services:
  - Azure OpenAI Service (GPT-4o deployment)
  - Azure AI Search
  - Azure Storage (optional)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/FitFusion-AI-React.git
cd FitFusion-AI-React
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
```

### 4. Environment Configuration
Create a `.env` file in the backend directory:
```env
# Azure OpenAI Configuration
AZURE_OPENAI_API_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_api_key_here
AZURE_OPENAI_API_VERSION=2024-02-15-preview
AZURE_OPENAI_MODEL=gpt-4o

# Azure AI Search Configuration
AZURE_SEARCH_ENDPOINT=https://your-search-service.search.windows.net
AZURE_SEARCH_ADMIN_KEY=your_search_admin_key
AZURE_SEARCH_INDEX_NAME=fitness-index

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=True
```

### 5. Run the Application

**Start Backend:**
```bash
cd backend
python app.py
```
Server runs on `http://127.0.0.1:5000`

**Start Frontend:**
```bash
cd frontend
npm start
```
Application opens at `http://localhost:3000`

## 📱 Application Features

### 🏠 Dashboard
- Overview of fitness progress and recent activities
- Quick access to all features and navigation
- Weekly plan summary and today's workout preview
- Recent recommendations and activity history

### 🏋️ Fitness Advisor
- Upload body photos for comprehensive AI analysis
- Get personalized workout recommendations
- Full analysis using Azure AI technologies and MCP
- Multiple analysis modes for different needs

### 🍽️ Food Recommendations
- Generate personalized meal plans based on goals
- Input dietary restrictions and preferences
- Height tracking in inches (US standard)
- Macro and calorie recommendations

### 🔍 AI Food Analysis
- **Food Mode**: Analyze prepared meals for nutritional content
- **Ingredient Mode**: Get healthy recipe suggestions from ingredients
- Camera capture or photo upload support
- Detailed nutritional breakdowns with portion analysis

### 📈 Progress Tracking
- Log daily activities with enhanced UI
- Track calories, steps, miles, and feeling ratings (1-5 scale with descriptions)
- View progress charts and weekly analytics
- Monitor workout completion and goal achievement
- Access to weekly plans and scheduled exercises

### 🎤 Voice Chat (NEW!)
- Real-time conversation with AI fitness coach
- Voice-powered workout guidance and motivation
- Contextual responses based on your profile and progress
- Hands-free operation during workouts
- AI can access your workout plans and provide real-time coaching

## 🔧 API Endpoints

### Authentication & User Management
```
POST /api/register          - User registration
POST /api/login             - User authentication
GET  /api/user-profile      - Get user profile data
POST /api/update-profile    - Update user profile
```

### Fitness Analysis & Planning
```
POST /api/analyze_body              - Body composition analysis
POST /api/generate-weekly-plan      - Generate structured workout plans
GET  /api/get-weekly-plan          - Retrieve existing workout plans
POST /api/functions/get_progress_data - Progress analytics and charts
```

### Nutrition & Food Analysis
```
POST /api/get_food_recommendations  - Generate personalized meal plans
POST /api/identify_food            - Food/ingredient analysis and recognition
GET  /api/get_existing_food_recommendations - Retrieve saved meal plans
```

### Voice Chat & Real-time Communication
```
POST /api/start-session            - Initialize voice chat session
POST /api/webrtc-sdp              - WebRTC connection setup
GET  /api/get-session-configuration - Voice chat configuration
POST /api/functions/get_user_profile - Voice chat profile access
POST /api/functions/get_todays_plan - Voice chat workout plan access
```

### Activity & Progress Tracking
```
POST /api/log-activity        - Log workout activities and progress
GET  /api/get-activities      - Retrieve activity history
POST /api/functions/get_fitness_recommendations - Context-aware fitness advice
```

## 🎨 User Interface Highlights

### Modern Design Language
- **Consistent Theming**: Blue and green color scheme throughout
- **Material Design Elements**: Cards, shadows, and smooth transitions
- **Responsive Layout**: Optimized for all screen sizes
- **Accessibility**: WCAG compliant with keyboard navigation

### Enhanced User Experience
- **Real-time Feedback**: Immediate visual responses to user actions
- **Smart Loading States**: Detailed progress indicators during AI processing
- **Error Handling**: User-friendly error messages and recovery options
- **Progressive Enhancement**: Core functionality works without JavaScript

### Voice Chat Interface
- **Modern Chat Design**: Message bubbles similar to popular messaging apps
- **Glass Morphism**: Semi-transparent elements with blur effects
- **Smooth Animations**: Message animations and transitions
- **Clear Visual Hierarchy**: Easy to distinguish between user and AI messages

## 🔒 Security & Privacy

- **Secure Authentication**: Bcrypt password hashing and session management
- **Data Encryption**: All sensitive data encrypted in transit and at rest
- **Privacy-First Design**: User data isolated and access controlled
- **Azure Enterprise Security**: Leverages Azure's enterprise-grade security features
- **No Data Leakage**: Sensitive configuration kept in environment variables

## 🏃‍♂️ Usage Guide

### Getting Started
1. **Register/Login**: Create account or login with existing credentials
2. **Complete Profile**: Add personal information for better recommendations
3. **Choose Analysis Type**: Select quick or comprehensive analysis mode
4. **Upload Photos**: Body photos for fitness analysis or food photos for nutrition
5. **Get Recommendations**: Receive personalized advice and workout plans

### Voice Coaching
1. **Start Voice Session**: Click the green "Start Voice Chat" button
2. **Grant Microphone Access**: Allow browser to access your microphone
3. **Natural Conversation**: Speak naturally with your AI coach
4. **Real-time Guidance**: Get immediate responses and workout coaching
5. **Contextual Help**: AI knows your plans and can provide specific guidance

### Progress Tracking
1. **Daily Logging**: Record workouts, activities, and how you feel
2. **Weekly Planning**: Generate and follow structured workout schedules
3. **Progress Monitoring**: Track improvements over time with visual charts
4. **Goal Setting**: Set and monitor specific fitness objectives

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow React best practices and hooks patterns
- Use consistent naming conventions
- Write clean, documented code
- Test thoroughly before submitting
- Ensure responsive design works on all devices

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Azure OpenAI** for advanced AI capabilities and vision analysis
- **React Community** for excellent documentation and ecosystem
- **Bootstrap Team** for responsive design components
- **Flask Community** for robust backend framework
- **WebRTC Community** for real-time communication standards

## 📞 Support & Contact

- **Issues**: Create an issue in this repository
- **Email**: support@fitfusion-ai.app
- **Documentation**: Full API documentation available in `/docs`

## 🚀 Recent Updates

### v2.1 - Voice Chat & Enhanced UI (Latest)
- ✅ **Voice Chat Integration**: Real-time AI fitness coaching with WebRTC
- ✅ **Enhanced Progress Tracking**: Improved activity logging with feeling ratings
- ✅ **Modern UI Updates**: Refreshed interface with better visual hierarchy
- ✅ **Height in Inches**: Updated food recommendations to use US standard measurements
- ✅ **Improved Navigation**: Better user flow between features

### v2.0 - Full Nutrition & Progress System
- ✅ **Food Analysis System**: Complete nutrition analysis and meal planning
- ✅ **Progress Tracking**: Comprehensive activity logging and analytics
- ✅ **Weekly Plans**: Structured workout scheduling with Azure Search integration
- ✅ **Enhanced Authentication**: Secure user management with profile persistence

---

**Built with ❤️ for fitness enthusiasts worldwide**
```
FitFusion-AI-React/
├── frontend/
│   ├── public/
│   │   └── index.html          # Bootstrap & Font Awesome integration
│   ├── src/
│   │   ├── components/
│   │   │   ├── FitnessAdvisorPage.jsx    # Main AI recommendation interface
│   │   │   ├── WeeklyPlanPage.jsx        # 7-day workout plan display
│   │   │   ├── LoginPage.jsx             # User authentication
│   │   │   ├── RegisterPage.jsx          # User registration
│   │   │   ├── ProfilePage.jsx           # Profile management
│   │   │   ├── NavBar.jsx               # Navigation with auth state
│   │   │   └── Footer.jsx               # Application footer
│   │   ├── App.jsx              # Main app with routing & auth logic
│   │   └── index.jsx           # Application entry point
│   └── package.json            # Frontend dependencies
├── backend/
│   ├── app.py                  # Main Flask application with weekly plan endpoints
│   ├── ai.py                   # Enhanced AI recommendations with weekly plan generation
│   ├── ai_fast.py             # Fast AI recommendations
│   ├── mcp_server.py          # MCP server for fitness data
│   ├── mcp_client.py          # MCP client integration
│   ├── requirements.txt        # Python dependencies
│   └── captured_images/        # Stored captured images
└── README.md                   # This file
```

---

## Installation

### Prerequisites
- **Node.js** (v14 or higher): For running the React frontend
- **Python 3.8+**: For running the Flask backend
- **pip**: Python package manager
- **Azure OpenAI Credentials**: Required for AI-powered recommendations
  - Azure OpenAI endpoint
  - API key
  - Model deployment name (GPT-4o Vision)

### Steps
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd FitFusion-AI-React
   ```

2. **Install Backend Dependencies**:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

3. **Set Up Environment Variables**:
   Create a `.env` file in the `backend` directory with your Azure credentials:
   ```env
   # Azure OpenAI Configuration
   AZURE_OPENAI_API_ENDPOINT="your_openai_endpoint"
   AZURE_OPENAI_API_KEY="your_openai_api_key"
   AZURE_OPENAI_API_VERSION="2024-02-15-preview"
   AZURE_OPENAI_MODEL="your_gpt4o_deployment_name"
   
   # Azure AI Search Configuration (for RAG mode)
   AZURE_SEARCH_ENDPOINT="https://your-search-service.search.windows.net"
   AZURE_SEARCH_ADMIN_KEY="your_search_admin_key"
   AZURE_SEARCH_INDEX_NAME="fitness-index"
   ```

4. **Set Up Azure AI Search (Optional - for RAG mode)**:
   ```bash
   cd backend
   # Install additional dependencies for Azure AI Search
   pip install azure-search-documents azure-core
   
   # Process and upload fitness datasets to Azure AI Search
   python azure_search_data_processor.py
   ```
   
   Note: Place your fitness datasets (`megaGymDataset.csv`, `gym_members_exercise_tracking.csv`, `data.csv`) in the backend directory before running the processor.

4. **Install Frontend Dependencies**:
   ```bash
   cd ../frontend
   npm install
   ```

5. **Start the Backend Server**:
   ```bash
   cd ../backend
   python app.py
   ```
   Backend runs on `http://localhost:5000`

6. **Start the Frontend Development Server**:
   ```bash
   cd ../frontend
   npm start
   ```
   Frontend runs on `http://localhost:3000`

7. **Access the Application**:
   Open your browser and navigate to `http://localhost:3000`

---

## Usage

### Getting Started
1. **Create an Account**:
   - Navigate to `/register` to create a new account
   - Fill in required fields: Name, Email, Password, Sex
   - Optionally add: Age, Weight, Preferred Fitness Agent
   - Account automatically logs you in after registration

2. **Login** (if you have an existing account):
   - Navigate to `/login`
   - Enter your email and password
   - Your profile data will be automatically loaded

### Using the Fitness Advisor

#### Profile Management
- **Access Profile**: Click your email in the top navigation → Profile
- **Edit Information**: Click "Edit Profile" to modify your details
- **Auto-Save**: Any changes made in the main app automatically save to your profile

#### Getting Recommendations
1. **Choose Analysis Mode**:
   - **Quick Analysis**: Fast recommendations (15-30 seconds)
   - **Enhanced Analysis**: Detailed recommendations with MCP integration (45-90 seconds)

2. **Select Your Fitness Agent**: Choose from 6 specialized coaches:
   - Personal Trainer (General fitness)
   - Strength Coach (Strength training focus)
   - Cardio Specialist (Endurance training)
   - Nutrition Expert (Diet planning)
   - Weight Loss Coach (Fat loss strategies)
   - Muscle Building Coach (Hypertrophy focus)

3. **Provide Your Information**:
   - Personal details auto-fill from your profile
   - Update any information as needed (auto-saves to profile)

4. **Submit Images**:
   - **Upload Option**: Select existing photos from your device
   - **Camera Option**: Click "Use Camera" to capture live photos
   - Support for multiple images (front, side, back views)

5. **Receive Personalized Recommendations**:
   - AI analyzes your images and profile data
   - Get tailored advice based on your selected fitness agent
   - Recommendations include exercise plans, nutrition guidance, and coaching tips

#### Weekly Workout Plans
1. **Generate Weekly Plans**: Click "Generate Weekly Plan" for structured 7-day programs
2. **Agent-Specific Programming**: Plans automatically adapt to your selected fitness agent
3. **Balanced Distribution**: Smart algorithms ensure even exercise distribution across the week
4. **Daily Breakdown**: View each day's exercises, goals, and focus areas
5. **Rest Day Management**: Appropriate recovery days with gentle activities
6. **Comprehensive Format**: Each day includes:
   - 3-4 specific exercises with sets/reps
   - Daily goals and focus areas
   - Training notes and tips
   - Rest day activities for recovery

### Navigation
- **Home**: Main fitness advisor interface
- **Weekly Plan**: Generate and view 7-day workout schedules
- **Profile**: Manage your personal information and fitness preferences
- **Logout**: Securely end your session (top navigation dropdown)

---

## API Endpoints

### Authentication & Profile
- **POST** `/api/fitness_recommendation`: Main endpoint for image analysis and recommendations
  - Accepts: Form data with images, gender, age, weight, agent_type, fast_mode
  - Returns: Personalized fitness recommendations

### Weekly Workout Plans
- **POST** `/api/generate-weekly-plan`: Generate structured 7-day workout plans
  - Accepts: JSON with user profile data (gender, age, weight, agent_type, health_conditions)
  - Returns: Complete weekly plan with daily exercises, goals, and schedules

### File Storage
- **Captured Images**: Automatically stored in `backend/captured_images/`
- **Profile Data**: Stored in browser localStorage (production would use proper database)

---

## Key Features Explained

### Weekly Workout Plan Generation
The application includes a sophisticated weekly planning system:
- **Balanced Distribution Algorithm**: Prevents exercise dumping where all exercises end up on one day
- **Agent-Specific Programming**: Each fitness agent (weight loss, muscle gain, etc.) has tailored weekly structures
- **Validation System**: Multi-layer validation ensures:
  - 7 complete days with appropriate content
  - 1-2 rest days with gentle activities
  - 3-4 exercises per training day
  - Maximum 8 exercises per day (prevents overload)
  - 15-35 total exercises per week
- **Comprehensive Fallback Plans**: When AI generation fails, detailed backup plans ensure users always receive quality programming
- **Rest Day Intelligence**: Rest days include gentle activities like yoga and walking instead of intense exercises

### MCP (Model Context Protocol) Integration
The enhanced analysis mode utilizes MCP for:
- **Structured Fitness Data**: Access to comprehensive exercise databases
- **Workout Plan Generation**: Customized routines based on goals and fitness level
- **Nutrition Calculations**: BMR/TDEE calculations with meal recommendations
- **Exercise Recommendations**: Targeted exercises for specific muscle groups

### Dual Analysis Modes
- **Fast Mode**: Direct GPT-4o vision analysis with optimized prompts
- **Enhanced Mode**: Combines vision analysis with MCP structured data for comprehensive recommendations

### Auto-Save Profile System
- Real-time saving of user inputs to profile
- Bidirectional sync between main app and profile page
- Automatic loading of profile data on login
- Visual feedback for save operations

---

## Development Notes

### Frontend Architecture
- React functional components with hooks
- React Router for navigation and route protection
- Bootstrap 5 for responsive design
- Local storage for session and profile management

### Backend Architecture
- Flask with CORS for API endpoints
- Modular AI processing (ai.py for enhanced, ai_fast.py for quick)
- Advanced weekly plan generation with validation and fallback systems
- MCP server/client architecture for structured data
- Image processing and storage management
- Robust error handling and timeout management

### Performance Optimizations
- Concurrent processing for faster recommendations
- Image compression for reduced upload times
- Timeout handling for long-running requests
- Progressive loading indicators with detailed feedback
- Intelligent fallback systems for reliable service
- Optimized weekly plan generation with validation layers
- Agent-specific caching for improved response times

---

## Recent Updates & Improvements

### Version 2.0 - Weekly Planning System
- **Complete Weekly Plan Generation**: Structured 7-day workout programs with balanced exercise distribution
- **Advanced Validation**: Multi-layer validation prevents unbalanced plans and exercise dumping
- **Agent-Specific Programming**: Tailored weekly structures for each fitness agent type
- **Comprehensive Fallback Plans**: Detailed backup plans for weight loss, muscle gain, cardio, strength, and general fitness
- **Smart Rest Day Management**: Intelligent rest day programming with appropriate recovery activities
- **Robust Error Handling**: Enhanced error handling and timeout management for reliable service

### Enhanced AI Integration
- **Improved Prompt Engineering**: Better structured prompts for consistent weekly plan formatting
- **MCP Timeout Handling**: Background MCP processing with timeout controls
- **Validation Functions**: Comprehensive plan validation ensuring quality and balance
- **Parsing Improvements**: Robust parsing of AI responses with fallback content generation

### User Experience Improvements
- **Weekly Plan Interface**: Dedicated page for viewing and managing workout schedules
- **Visual Plan Display**: Clean, organized presentation of daily workouts with cards
- **Exercise Detail Cards**: Comprehensive display of exercises, goals, and training notes
- **Mobile-Optimized Planning**: Responsive design for weekly plan viewing on all devices