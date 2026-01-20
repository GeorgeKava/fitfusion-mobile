# 🏋️ FitFusion Mobile

> AI-powered fitness advisor app with iOS support, featuring personalized workout plans, real-time voice coaching, and intelligent nutrition tracking.

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Capacitor](https://img.shields.io/badge/Capacitor-7.0-brightgreen.svg)](https://capacitorjs.com/)
[![Flask](https://img.shields.io/badge/Flask-3.x-lightgrey.svg)](https://flask.palletsprojects.com/)
[![Azure OpenAI](https://img.shields.io/badge/Azure-OpenAI-0078D4.svg)](https://azure.microsoft.com/en-us/products/ai-services/openai-service)

## ✨ Features

### 🤖 AI-Powered Fitness Analysis
- **GPT-4o Vision Integration**: Upload photos for instant fitness assessment
- **Personalized Recommendations**: Get tailored workout and nutrition advice based on your body composition
- **History Tracking**: Access all your previous fitness analyses without rate limits

### 🎙️ Real-Time Voice Chat
- **Azure Real-Time API**: Natural voice conversations with your AI fitness coach
- **WebRTC Integration**: Low-latency voice interactions
- **Contextual Coaching**: Get answers to fitness questions on-the-go

### 📊 Comprehensive Tracking
- **Weekly Workout Plans**: Customized exercise routines with 50+ unique exercises
- **Progress Monitoring**: Track your fitness journey over time
- **Activity Logging**: Record workouts, meals, and progress photos
- **Metrics Dashboard**: Visualize your fitness data and trends

### 🍎 Nutrition Intelligence
- **Food Identification**: Use AI to identify meals from photos
- **Calorie Analysis**: Get detailed nutritional breakdowns
- **Meal Recommendations**: Personalized suggestions based on your goals

### 📱 iOS Native Experience
- **Capacitor 7**: Full iOS native functionality
- **Camera Integration**: Seamless photo capture and upload
- **Offline-First**: Local storage for uninterrupted access
- **Responsive Design**: Optimized mobile UI/UX

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **Xcode** 15+ (for iOS development)
- **Azure Account** with:
  - Azure OpenAI Service (GPT-4o model)
  - Azure Vision API
  - Azure Real-Time API access

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/GeorgeKava/fitfusion-mobile.git
   cd fitfusion-mobile
   ```

2. **Backend Setup**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Create .env file from example
   cp .env.example .env
   # Edit .env with your Azure API keys (see Configuration section)
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   
   # Install dependencies
   npm install
   
   # Update API configuration
   # Edit src/config/api.js with your backend URL
   ```

4. **iOS Setup** (Optional - for mobile development)
   ```bash
   # Build React app
   npm run build
   
   # Sync with iOS
   npx cap sync ios
   
   # Open in Xcode
   npx cap open ios
   ```

### Configuration

#### Backend Environment Variables

Create `backend/.env` with your Azure credentials:

```bash
# Azure OpenAI Configuration
AZURE_OPENAI_API_KEY="your-api-key"
AZURE_OPENAI_API_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_OPENAI_MODEL="gpt-4o"
AZURE_OPENAI_API_VERSION="2024-05-01-preview"

# Azure Vision API
AZURE_VISION_ENDPOINT="https://your-vision.cognitiveservices.azure.com/"
AZURE_VISION_KEY="your-vision-key"

# Azure Real-Time API
WEBRTC_URL="https://swedencentral.realtimeapi-preview.ai.azure.com/v1/realtimertc"
SESSIONS_URL="https://your-resource.openai.azure.com/openai/realtimeapi/sessions?api-version=2025-04-01-preview"
API_KEY="your-realtime-api-key"
DEPLOYMENT="gpt-4o-realtime-preview"

# Flask Configuration
FLASK_HOST="127.0.0.1"
FLASK_PORT="5001"
FLASK_DEBUG="true"
```

**🔑 Where to get API keys:**
- Azure OpenAI: [Azure Portal](https://portal.azure.com) → Your OpenAI resource → Keys and Endpoint
- Azure Vision: Azure Portal → Your Computer Vision resource → Keys and Endpoint
- Real-Time API: Requires preview access from Azure

#### Frontend Configuration

Update `frontend/src/config/api.js`:

```javascript
const API_CONFIG = {
  development: {
    baseURL: 'http://localhost:5001',
  },
  mobile: {
    baseURL: 'http://YOUR_LOCAL_IP:5001', // e.g., 192.168.1.100:5001
  },
  production: {
    baseURL: 'https://your-production-api.com',
  }
};
```

## 🏃 Running the App

### Web Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate
python app.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm start
```

Visit: `http://localhost:3000`

### iOS Development Mode

1. **Start backend** (same as above)

2. **Update mobile API URL** in `frontend/src/config/api.js`:
   ```javascript
   // Use your Mac's local IP address
   baseURL: 'http://192.168.1.XXX:5001'
   ```

3. **Build and sync:**
   ```bash
   cd frontend
   npm run build
   npx cap sync ios
   npx cap open ios
   ```

4. **Run from Xcode** on your device or simulator

## 📁 Project Structure

```
fitfusion-mobile/
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── ai.py                  # AI recommendation engine
│   ├── voice_chat.py          # Real-time voice chat
│   ├── daily_plan_generator.py# Workout plan generator
│   ├── vector_store.py        # Vector database for RAG
│   ├── requirements.txt       # Python dependencies
│   └── .env.example          # Environment template
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── DashboardPageMobile.jsx
│   │   │   ├── FitnessAdvisorPageMobile.jsx
│   │   │   ├── VoiceChatWebRTC.jsx
│   │   │   ├── WeeklyPlanPageMobile.jsx
│   │   │   ├── ProgressPageMobile.jsx
│   │   │   └── ...
│   │   ├── config/
│   │   │   └── api.js        # API configuration
│   │   └── styles/
│   ├── ios/                   # iOS native project
│   │   └── App/
│   │       └── App.xcodeproj
│   ├── capacitor.config.ts    # Capacitor configuration
│   └── package.json
└── README.md
```

## 🛠️ Tech Stack

### Frontend
- **React** 18.2.0 - UI framework
- **React Router** - Navigation
- **Capacitor** 7 - Native iOS bridge
- **Axios** - HTTP client
- **React Icons** - Icon library

### Backend
- **Flask** - Python web framework
- **Azure OpenAI** - GPT-4o for AI recommendations
- **Azure Vision** - Image analysis
- **Azure Real-Time API** - Voice chat
- **ChromaDB** - Vector database (optional)
- **Pandas** - Data processing

### iOS
- **Xcode** 15+
- **Swift** - Native iOS code
- **CocoaPods** - Dependency management

## 🔒 Security

- ✅ Environment variables for all API keys
- ✅ `.gitignore` configured to exclude secrets
- ✅ JWT authentication (optional, can be implemented)
- ✅ Input validation and sanitization
- ✅ Rate limiting on API endpoints
- ✅ CORS configuration for secure origins

**⚠️ Important:** Never commit your `.env` file or API keys to version control!

## 📸 Screenshots

*(Add screenshots of your app here)*

- Dashboard with fitness metrics
- AI fitness analysis results
- Voice chat interface
- Weekly workout plan
- Food identification

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test
```

## 📦 Building for Production

### Web Build
```bash
cd frontend
npm run build
# Deploy the 'build' folder to your hosting service
```

### iOS Build
```bash
cd frontend
npm run build
npx cap sync ios
npx cap open ios

# In Xcode:
# 1. Select your device or "Any iOS Device"
# 2. Product → Archive
# 3. Distribute App → App Store Connect
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Azure OpenAI for GPT-4o API
- Azure Cognitive Services for Vision API
- Capacitor team for the amazing iOS bridge
- React community for excellent documentation

## 📧 Contact

George Kavalaparambil

Project Link: [https://github.com/GeorgeKava/fitfusion-mobile](https://github.com/GeorgeKava/fitfusion-mobile)

## 🗺️ Roadmap

- [ ] Android support via Capacitor
- [ ] Apple Watch integration
- [ ] Social features (share workouts)
- [ ] Integration with fitness trackers
- [ ] Meal planning AI assistant
- [ ] Workout video library
- [ ] Progress photo comparisons with AI analysis

---
