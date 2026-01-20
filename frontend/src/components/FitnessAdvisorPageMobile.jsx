import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getApiUrl } from '../config/api';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IoCamera, IoCalendar, IoSearch, IoImages, IoBarbell, IoBody, IoFitness, IoNutrition, IoTime, IoCheckmarkCircle, IoTimeOutline, IoChevronForward, IoTrashOutline } from 'react-icons/io5';

// Helper function to parse recommendation into structured sections
const parseRecommendation = (text) => {
  if (!text) return { sections: [], rawText: '' };
  
  // Filter out ChromaDB and debugging mentions
  const debugPatterns = [
    /\*?Powered by ChromaDB[^*]*\*?/gi,
    /ChromaDB[- ]Powered[^:]*:/gi,
    /ChromaDB Vector Store[^*]*\*/gi,
    /\*?Note:.*Agentic RAG mode\)?\*?/gi,
    /Recommended Exercises from [\d,]+-Exercise Database:/gi,
    /from [\d,]+-Exercise Database/gi,
  ];
  
  let cleanedText = text;
  debugPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });
  
  const sections = [];
  const lines = cleanedText.split('\n');
  let currentSection = null;
  let currentContent = [];
  
  const sectionPatterns = [
    { pattern: /^#+\s*(.+)|^\*\*(.+)\*\*$/i, type: 'heading' },
    { pattern: /^[-•]\s+(.+)/i, type: 'bullet' },
    { pattern: /^\d+[.)]\s+(.+)/i, type: 'numbered' },
  ];
  
  const iconMap = {
    'fitness': IoFitness,
    'exercise': IoBarbell,
    'workout': IoBarbell,
    'body': IoBody,
    'analysis': IoBody,
    'assessment': IoBody,
    'visual': IoCamera,
    'image': IoCamera,
    'photo': IoCamera,
    'nutrition': IoNutrition,
    'diet': IoNutrition,
    'food': IoNutrition,
    'schedule': IoCalendar,
    'plan': IoCalendar,
    'weekly': IoCalendar,
    'time': IoTime,
    'duration': IoTime,
    'recommendation': IoCheckmarkCircle,
    'tip': IoCheckmarkCircle,
    'advice': IoCheckmarkCircle,
    'benefit': IoCheckmarkCircle,
    'health': IoCheckmarkCircle,
  };
  
  const getIconForSection = (title) => {
    const lowerTitle = title.toLowerCase();
    for (const [keyword, icon] of Object.entries(iconMap)) {
      if (lowerTitle.includes(keyword)) return icon;
    }
    return IoCheckmarkCircle;
  };
  
  // Section titles to skip (empty or debug sections)
  const skipSections = [
    'chromadb',
    'vector store',
    'database',
    'powered by',
    'exercise database',
  ];
  
  // Sections that should be prioritized at the top (visual analysis)
  const prioritySections = [
    'agentic rag',
    'intelligence insights',
    'visual assessment',
    'visual analysis',
    'image analysis',
    'photo analysis',
    'analysis preview',
    'form and posture',
    'body composition',
    'muscle development',
    'posture',
    'structured visual',
  ];
  
  const shouldSkipSection = (title) => {
    const lowerTitle = title.toLowerCase();
    return skipSections.some(skip => lowerTitle.includes(skip));
  };
  
  const isPrioritySection = (title) => {
    const lowerTitle = title.toLowerCase();
    return prioritySections.some(priority => lowerTitle.includes(priority));
  };
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      if (currentContent.length > 0) {
        currentContent.push('');
      }
      return;
    }
    
    // Check if this is a heading
    // Matches: # Heading, **Heading**, ALL CAPS, Emoji prefix, or specific known headers
    const knownHeaderPatterns = [
      /^Agentic RAG/i,
      /^Visual Assessment/i,
      /^Analysis Preview/i,
      /^YOUR FITNESS/i,
      /^HOLISTIC HEALTH/i,
      /^Structured Visual/i,
      /^Form and posture/i,
      /^Body composition/i,
      /^Muscle development/i,
      /^Mobility and flexibility/i,
      /^Current fitness level/i,
      /^Available equipment/i,
      /Integration:$/i,
    ];
    const isKnownHeader = knownHeaderPatterns.some(pattern => pattern.test(trimmedLine));
    const headingMatch = trimmedLine.match(/^#+\s*(.+)/) || 
                         trimmedLine.match(/^\*\*(.+)\*\*$/) ||
                         (trimmedLine.match(/^[🎯📸🏋️💪🥗✅📊⭐🌟💡🔥]/u) && trimmedLine.length < 80) ||
                         (trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length > 3 && trimmedLine.length < 60) ||
                         isKnownHeader;
    
    if (headingMatch) {
      // Save previous section
      if (currentSection) {
        const cleanContent = currentContent.join('\n').trim();
        if (cleanContent && !shouldSkipSection(currentSection)) {
          sections.push({
            title: currentSection,
            content: cleanContent,
            icon: getIconForSection(currentSection),
            isPriority: isPrioritySection(currentSection)
          });
        }
      }
      currentSection = headingMatch[1] || trimmedLine;
      currentSection = currentSection.replace(/[#*]/g, '').trim();
      currentContent = [];
    } else {
      currentContent.push(trimmedLine);
    }
  });
  
  // Add last section
  if (currentSection && currentContent.length > 0) {
    const cleanContent = currentContent.join('\n').trim();
    if (cleanContent && !shouldSkipSection(currentSection)) {
      sections.push({
        title: currentSection,
        content: cleanContent,
        icon: getIconForSection(currentSection),
        isPriority: isPrioritySection(currentSection)
      });
    }
  }
  
  // Filter out sections with very little content (likely just headers without content)
  const filteredSections = sections.filter(section => {
    // Remove sections with less than 10 characters of actual content
    const contentWithoutWhitespace = section.content.replace(/\s/g, '');
    return contentWithoutWhitespace.length >= 10;
  });
  
  // Merge all priority (visual analysis) sections into one
  const prioritySects = filteredSections.filter(s => s.isPriority);
  const nonPrioritySects = filteredSections.filter(s => !s.isPriority);
  
  let mergedSections = [];
  
  if (prioritySects.length > 0) {
    // Merge all priority sections into one "Visual Analysis" section
    const mergedContent = prioritySects.map(s => {
      // Include section title as a sub-header if it adds context
      const titleLower = s.title.toLowerCase();
      if (titleLower.includes('structured visual') || 
          titleLower.includes('agentic rag') ||
          titleLower.includes('visual assessment')) {
        return s.content;
      }
      return `**${s.title}**\n${s.content}`;
    }).join('\n\n');
    
    mergedSections.push({
      title: '📸 Visual Analysis',
      content: mergedContent,
      icon: IoCamera,
      isPriority: true
    });
  }
  
  // Add non-priority sections
  mergedSections = [...mergedSections, ...nonPrioritySects];
  
  // If no sections were found, create a single section with all content
  if (mergedSections.length === 0) {
    mergedSections.push({
      title: 'Your Fitness Recommendation',
      content: cleanedText,
      icon: IoFitness
    });
  }
  
  return { sections: mergedSections, rawText: cleanedText };
};

// Component to render formatted content
const FormattedContent = ({ content }) => {
  const lines = content.split('\n');
  
  return (
    <div>
      {lines.map((line, idx) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return <div key={idx} style={{ height: '8px' }} />;
        
        // Check for bullet points
        const bulletMatch = trimmedLine.match(/^[-•]\s+(.+)/);
        if (bulletMatch) {
          return (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '8px',
              marginBottom: '6px',
              paddingLeft: '4px'
            }}>
              <span style={{ color: 'var(--ios-blue)', flexShrink: 0 }}>•</span>
              <span>{bulletMatch[1]}</span>
            </div>
          );
        }
        
        // Check for numbered items
        const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)/);
        if (numberedMatch) {
          return (
            <div key={idx} style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: '8px',
              marginBottom: '6px',
              paddingLeft: '4px'
            }}>
              <span style={{ 
                color: 'var(--ios-blue)', 
                fontWeight: '600',
                minWidth: '20px'
              }}>{numberedMatch[1]}.</span>
              <span>{numberedMatch[2]}</span>
            </div>
          );
        }
        
        // Regular text
        return (
          <p key={idx} style={{ 
            margin: '0 0 8px 0',
            lineHeight: '1.5'
          }}>
            {trimmedLine}
          </p>
        );
      })}
    </div>
  );
};

function FitnessAdvisorPageMobile({ user }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [capturedImages, setCapturedImages] = useState([]);
  const [recommendation, setRecommendation] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [healthConditions, setHealthConditions] = useState('');
  const [agentType, setAgentType] = useState('general');
  const [fastMode, setFastMode] = useState(false);
  const [useRAG, setUseRAG] = useState(true);
  const [useMCP, setUseMCP] = useState(true);
  const [useHybrid, setUseHybrid] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [isGeneratingWeeklyPlan, setIsGeneratingWeeklyPlan] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Load profile data on component mount
  useEffect(() => {
    const loadProfileData = () => {
      console.log('FitnessAdvisorPage: Loading profile data...');
      
      const savedProfile = localStorage.getItem('userProfile');
      if (savedProfile) {
        try {
          const profile = JSON.parse(savedProfile);
          console.log('FitnessAdvisorPage: Profile data loaded:', profile);
          
          const profileGender = profile.sex || profile.gender;
          if (!gender && profileGender) {
            setGender(profileGender);
          }
          
          if (!age && profile.age) setAge(profile.age);
          if (!weight && profile.weight) setWeight(profile.weight);
          if (!height && profile.height) setHeight(profile.height);
          if (!healthConditions && profile.healthConditions) setHealthConditions(profile.healthConditions);
          
          const agentMapping = {
            'personal_trainer': 'general',
            'strength_coach': 'strength',
            'cardio_specialist': 'cardio',
            'nutrition_expert': 'general',
            'weight_loss_coach': 'weight_loss',
            'muscle_building_coach': 'muscle_gain'
          };
          
          if (profile.fitnessAgent || profile.agentType) {
            const agentValue = profile.fitnessAgent || profile.agentType;
            setAgentType(agentMapping[agentValue] || 'general');
          }
          
          if (profileGender || profile.age || profile.weight || profile.height || profile.fitnessAgent || profile.agentType || profile.healthConditions) {
            setProfileLoaded(true);
          }
        } catch (error) {
          console.error('FitnessAdvisorPage: Error loading profile data:', error);
        }
      }
      
      if (user?.email) {
        const userSpecificProfile = localStorage.getItem(`userProfile_${user.email}`);
        if (userSpecificProfile) {
          try {
            const profile = JSON.parse(userSpecificProfile);
            const profileGender = profile.sex || profile.gender;
            if (!gender && profileGender) setGender(profileGender);
            if (!age && profile.age) setAge(profile.age);
            if (!weight && profile.weight) setWeight(profile.weight);
            if (!height && profile.height) setHeight(profile.height);
          } catch (error) {
            console.error('FitnessAdvisorPage: Error loading user-specific profile:', error);
          }
        }
      }
    };
    
    loadProfileData();
  }, [user]);

  // Load analysis history
  useEffect(() => {
    const loadHistory = () => {
      try {
        let history = [];
        let loadedFrom = '';
        let userEmail = null;
        
        console.log('=== LOADING HISTORY ===');
        console.log('user prop:', user);
        console.log('user?.email:', user?.email);
        
        // First, determine what email to use (same logic as saving)
        // Try user-specific history first
        if (user?.email) {
          userEmail = user.email;
          loadedFrom = `user prop: ${user.email}`;
        }
        
        // Also check for any stored user email in localStorage
        if (!userEmail) {
          const storedUser = localStorage.getItem('user');
          console.log('storedUser in localStorage:', storedUser);
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              console.log('parsedUser:', parsedUser);
              if (parsedUser?.email) {
                userEmail = parsedUser.email;
                loadedFrom = `stored user: ${parsedUser.email}`;
              }
            } catch (e) {
              console.error('Error parsing stored user:', e);
            }
          }
        }
        
        // Use default if no email found
        if (!userEmail) {
          userEmail = 'default';
          loadedFrom = 'default key';
        }
        
        console.log('Resolved userEmail:', userEmail);
        console.log('Will load from key:', `fitnessRecommendationHistory_${userEmail}`);
        
        // Load history with the determined key
        const historyKey = `fitnessRecommendationHistory_${userEmail}`;
        history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        console.log('Loaded history from:', loadedFrom, 'Count:', history.length);
        console.log('=== END LOADING ===');
        setAnalysisHistory(history);
      } catch (error) {
        console.error('Error loading analysis history:', error);
        setAnalysisHistory([]);
      }
    };
    loadHistory();
  }, [user, recommendation]); // Reload when a new recommendation is added

  useEffect(() => {
    if (showCamera) {
      startVideoStream();
    } else {
      stopVideoStream();
    }
    return () => stopVideoStream();
  }, [showCamera]);

  const startVideoStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Camera access denied. Please enable camera permissions.');
      setShowCamera(false);
    }
  };

  const stopVideoStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const saveProfileData = (updatedData) => {
    try {
      const currentProfile = JSON.parse(localStorage.getItem('userProfile') || '{}');
      const updatedProfile = { ...currentProfile, ...updatedData };
      
      if (updatedData.sex) updatedProfile.gender = updatedData.sex;
      if (updatedData.gender) updatedProfile.sex = updatedData.gender;
      
      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      
      if (user?.email) {
        localStorage.setItem(`userProfile_${user.email}`, JSON.stringify(updatedProfile));
      }
    } catch (error) {
      console.error('Error saving profile data:', error);
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    setShowCamera(false);
    
    // Preview images
    const imageDataUrls = [];
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        imageDataUrls.push(e.target.result);
        if (imageDataUrls.length === files.length) {
          setCapturedImages(imageDataUrls);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Use native camera on mobile
  const handleTakePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      
      // Convert to blob for upload
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
      
      setSelectedFiles([file]);
      setCapturedImages([image.dataUrl]);
      setShowCamera(false);
    } catch (error) {
      if (error.message !== 'User cancelled photos app') {
        setError('Failed to capture photo. Please try again.');
      }
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      
      // Convert to blob for upload
      const response = await fetch(image.dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
      
      setSelectedFiles([file]);
      setCapturedImages([image.dataUrl]);
    } catch (error) {
      if (error.message !== 'User cancelled photos app') {
        setError('Failed to select photo. Please try again.');
      }
    }
  };

  const handleGenderChange = (e) => {
    const value = e.target.value;
    setGender(value);
    if (value) saveProfileData({ sex: value });
  };

  const handleAgeChange = (e) => {
    const value = e.target.value;
    setAge(value);
    if (value && !isNaN(value)) saveProfileData({ age: value });
  };

  const handleWeightChange = (e) => {
    const value = e.target.value;
    setWeight(value);
    if (value && !isNaN(value)) saveProfileData({ weight: value });
  };

  const handleHeightChange = (e) => {
    const value = e.target.value;
    setHeight(value);
    if (value && !isNaN(value)) saveProfileData({ height: value });
  };

  const handleHealthConditionsChange = (e) => {
    const value = e.target.value;
    setHealthConditions(value);
    if (value.trim()) saveProfileData({ healthConditions: value });
  };

  const handleAgentTypeChange = (e) => {
    const value = e.target.value;
    setAgentType(value);
    
    const reverseAgentMapping = {
      'general': 'personal_trainer',
      'strength': 'strength_coach',
      'cardio': 'cardio_specialist',
      'weight_loss': 'weight_loss_coach',
      'muscle_gain': 'muscle_building_coach'
    };
    
    const fitnessAgent = reverseAgentMapping[value] || 'personal_trainer';
    saveProfileData({ fitnessAgent });
  };

  const validateForm = () => {
    if (!gender || !age || !weight) {
      setError('Please fill in gender, age, and weight.');
      return false;
    }
    return true;
  };

  const handleAnalyze = async () => {
    if (!validateForm()) return;
    
    if (selectedFiles.length === 0 && !showCamera) {
      setError('Please select images or use camera.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Analyzing your fitness...');
    setError('');
    setRecommendation('');
    
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });
    formData.append('gender', gender);
    formData.append('age', age);
    formData.append('weight', weight);
    formData.append('height', height);
    formData.append('health_conditions', healthConditions);
    formData.append('agent_type', agentType);
    formData.append('user_email', user?.email || '');
    formData.append('fast_mode', fastMode.toString());
    formData.append('use_rag', useRAG.toString());
    formData.append('use_mcp', useMCP.toString());
    formData.append('use_hybrid', (useHybrid || (useRAG && useMCP)).toString());

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'multipart/form-data' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await axios.post(getApiUrl('/fitness_recommendation'), formData, {
        headers: headers,
        timeout: 60000,
      });
      setRecommendation(response.data.recommendation);
      setShowForm(false);
      
      const recommendationData = {
        recommendation: response.data.recommendation,
        timestamp: new Date().toISOString(),
        capturedImages: capturedImages,
        userProfile: { gender, age, weight, height, healthConditions, agentType },
        analysisMode: useHybrid || (useRAG && useMCP) ? 'Full Analysis' : 
                     fastMode ? 'Quick Analysis' : 'Enhanced Analysis',
        dateCreated: new Date().toLocaleDateString()
      };
      
      // Get user email from props or localStorage
      let userEmail = user?.email;
      if (!userEmail) {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            userEmail = parsedUser?.email;
          }
        } catch (e) {
          console.error('Error parsing stored user:', e);
        }
      }
      
      // Save with user email or fallback to default key
      const emailKey = userEmail || 'default';
      console.log('=== SAVING RECOMMENDATION ===');
      console.log('user prop:', user);
      console.log('user?.email:', user?.email);
      console.log('Resolved emailKey:', emailKey);
      console.log('Will save to key:', `fitnessRecommendationHistory_${emailKey}`);
      
      localStorage.setItem(`latestFitnessRecommendation_${emailKey}`, JSON.stringify(recommendationData));
      
      const history = JSON.parse(localStorage.getItem(`fitnessRecommendationHistory_${emailKey}`) || '[]');
      console.log('Current history length before adding:', history.length);
      history.unshift(recommendationData);
      if (history.length > 10) history.splice(10);
      localStorage.setItem(`fitnessRecommendationHistory_${emailKey}`, JSON.stringify(history));
      console.log('Saved to history. New length:', history.length);
      console.log('=== END SAVING ===');
      
      window.dispatchEvent(new CustomEvent('recommendationUpdated', { detail: recommendationData }));
    } catch (err) {
      if (err.code === 'ECONNABORTED') {
        setError('Request timed out. Please try Quick Analysis mode.');
      } else {
        setError('Failed to get recommendation. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  const handleCaptureImage = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!validateForm()) return;

    const video = videoRef.current;
    if (video.readyState < video.HAVE_ENOUGH_DATA || video.videoWidth === 0) {
      setError("Video not ready. Please wait a moment.");
      return;
    }

    setLoading(true);
    setLoadingMessage('Capturing image...');
    setError('');
    setRecommendation('');

    setTimeout(async () => {
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to capture image.');
          setLoading(false);
          setLoadingMessage('');
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          setCapturedImages([e.target.result]);
        };
        reader.readAsDataURL(blob);
        
        setLoadingMessage('Analyzing your fitness...');
        
        const formData = new FormData();
        formData.append('images', blob, 'captured_image.jpg');
        formData.append('gender', gender);
        formData.append('age', age);
        formData.append('weight', weight);
        formData.append('height', height);
        formData.append('health_conditions', healthConditions);
        formData.append('agent_type', agentType);
        formData.append('user_email', user?.email || '');
        formData.append('fast_mode', fastMode.toString());
        formData.append('use_rag', useRAG.toString());
        formData.append('use_mcp', useMCP.toString());
        formData.append('use_hybrid', (useHybrid || (useRAG && useMCP)).toString());

        try {
          const token = localStorage.getItem('token');
          const headers = { 'Content-Type': 'multipart/form-data' };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
          
          const response = await axios.post(getApiUrl('/fitness_recommendation'), formData, {
            headers: headers,
            timeout: 60000,
          });
          setRecommendation(response.data.recommendation);
          setShowForm(false);
          setShowCamera(false);
          
          const recommendationData = {
            recommendation: response.data.recommendation,
            timestamp: new Date().toISOString(),
            capturedImages: [reader.result],
            userProfile: { gender, age, weight, height, healthConditions, agentType },
            analysisMode: useHybrid || (useRAG && useMCP) ? 'Full Analysis' : 
                         fastMode ? 'Quick Analysis' : 'Enhanced Analysis',
            dateCreated: new Date().toLocaleDateString(),
            capturedFromCamera: true
          };
          
          // Get user email from props or localStorage
          let userEmail = user?.email;
          if (!userEmail) {
            try {
              const storedUser = localStorage.getItem('user');
              if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                userEmail = parsedUser?.email;
              }
            } catch (e) {
              console.error('Error parsing stored user:', e);
            }
          }
          
          // Save with user email or fallback to default key
          const emailKey = userEmail || 'default';
          console.log('Saving fitness recommendation (camera) with key:', emailKey);
          
          localStorage.setItem(`latestFitnessRecommendation_${emailKey}`, JSON.stringify(recommendationData));
          
          const history = JSON.parse(localStorage.getItem(`fitnessRecommendationHistory_${emailKey}`) || '[]');
          history.unshift(recommendationData);
          if (history.length > 10) history.splice(10);
          localStorage.setItem(`fitnessRecommendationHistory_${emailKey}`, JSON.stringify(history));
          console.log('Saved to history (camera). Total items:', history.length);
          
          window.dispatchEvent(new CustomEvent('recommendationUpdated', { detail: recommendationData }));
        } catch (err) {
          if (err.code === 'ECONNABORTED') {
            setError('Request timed out. Please try Quick Analysis mode.');
          } else {
            setError('Failed to analyze captured image. Please try again.');
          }
        } finally {
          setLoading(false);
          setLoadingMessage('');
        }
      }, 'image/jpeg', 0.8);
    }, 100);
  };

  const generateWeeklyPlan = async () => {
    if (!recommendation) {
      alert('Please generate a fitness recommendation first.');
      return;
    }

    setIsGeneratingWeeklyPlan(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please log in again.');
        return;
      }
      
      const userProfile = {
        gender: gender,
        age: age,
        weight: weight,
        height: height,
        agentType: agentType,
        healthConditions: healthConditions,
        email: user?.email
      };

      const headers = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(getApiUrl('/generate-weekly-plan'), {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          userProfile: userProfile,
          baseRecommendation: recommendation
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate weekly plan');
      }

      const data = await response.json();
      
      const weeklyPlanData = {
        ...data,
        dateCreated: new Date().toISOString(),
        userProfile: userProfile
      };
      
      if (user?.email) {
        localStorage.setItem(`weeklyFitnessPlan_${user.email}`, JSON.stringify(weeklyPlanData));
      }
      
      navigate('/weekly-plan');
      
    } catch (error) {
      console.error('Error generating weekly plan:', error);
      alert('Failed to generate weekly plan. Please try again.');
    } finally {
      setIsGeneratingWeeklyPlan(false);
    }
  };

  const handleBack = () => {
    setShowForm(true);
    setRecommendation('');
    setCapturedImages([]);
    setSelectedFiles([]);
    setShowCamera(false);
    setSelectedHistoryItem(null);
  };

  const handleViewHistory = () => {
    setShowHistory(true);
    setShowForm(false);
  };

  const handleSelectHistoryItem = (item) => {
    setSelectedHistoryItem(item);
    setRecommendation(item.recommendation);
    setCapturedImages(item.capturedImages || []);
    setShowHistory(false);
    setShowForm(false);
  };

  const handleDeleteHistoryItem = (index, e) => {
    e.stopPropagation(); // Prevent triggering the select
    
    // Get user email from props or localStorage or use default
    let userEmail = user?.email;
    if (!userEmail) {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          userEmail = parsedUser?.email;
        }
      } catch (e) {
        console.error('Error parsing stored user:', e);
      }
    }
    
    const emailKey = userEmail || 'default';
    const historyKey = `fitnessRecommendationHistory_${emailKey}`;
    const updatedHistory = [...analysisHistory];
    updatedHistory.splice(index, 1);
    localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    setAnalysisHistory(updatedHistory);
    console.log('Deleted history item. Remaining:', updatedHistory.length);
  };

  const handleBackFromHistory = () => {
    setShowHistory(false);
    setShowForm(true);
    setSelectedHistoryItem(null);
  };

  const formatHistoryDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday, ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  // History View
  if (showHistory) {
    return (
      <div style={{ paddingBottom: '80px' }}>
        {/* Nav Bar */}
        <div className="ios-nav-bar">
          <button className="ios-nav-back" onClick={handleBackFromHistory}>
            ← Back
          </button>
          <h1 className="ios-nav-title">Analysis History</h1>
        </div>

        <div style={{ padding: '16px' }}>
          {analysisHistory.length === 0 ? (
            <div className="ios-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <IoTimeOutline size={48} color="var(--ios-secondary-label)" />
              <h3 style={{ 
                margin: '16px 0 8px', 
                fontSize: '17px', 
                fontWeight: '600',
                color: 'var(--ios-label)'
              }}>
                No Previous Analyses
              </h3>
              <p style={{ 
                margin: 0, 
                fontSize: '15px', 
                color: 'var(--ios-secondary-label)' 
              }}>
                Your fitness analysis history will appear here after you complete your first analysis.
              </p>
            </div>
          ) : (
            <>
              <p style={{ 
                fontSize: '14px', 
                color: 'var(--ios-secondary-label)',
                marginBottom: '16px'
              }}>
                Tap on any analysis to view the full results. Your last 10 analyses are saved.
              </p>
              
              {analysisHistory.map((item, index) => (
                <div 
                  key={index}
                  className="ios-card"
                  onClick={() => handleSelectHistoryItem(item)}
                  style={{ 
                    marginBottom: '12px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    {/* Thumbnail */}
                    {item.capturedImages && item.capturedImages.length > 0 ? (
                      <img 
                        src={item.capturedImages[0]} 
                        alt="Analysis thumbnail"
                        style={{ 
                          width: '60px', 
                          height: '60px', 
                          borderRadius: '12px',
                          objectFit: 'cover',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div style={{ 
                        width: '60px', 
                        height: '60px', 
                        borderRadius: '12px',
                        backgroundColor: 'var(--ios-fill)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <IoFitness size={24} color="var(--ios-blue)" />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: '17px', 
                        fontWeight: '600',
                        color: 'var(--ios-label)',
                        marginBottom: '4px'
                      }}>
                        Fitness Analysis
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: 'var(--ios-secondary-label)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <IoTimeOutline size={14} />
                        <span>{formatHistoryDate(item.timestamp)}</span>
                      </div>
                      {item.analysisMode && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--ios-blue)',
                          marginTop: '4px'
                        }}>
                          {item.analysisMode}
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={(e) => handleDeleteHistoryItem(index, e)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '8px',
                          cursor: 'pointer',
                          color: 'var(--ios-red)'
                        }}
                      >
                        <IoTrashOutline size={20} />
                      </button>
                      <IoChevronForward size={20} color="var(--ios-secondary-label)" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  if (showCamera) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000' }}>
        {/* Camera View */}
        <div style={{ flex: 1, position: 'relative' }}>
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover' 
            }}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        
        {/* Camera Controls */}
        <div style={{ 
          padding: '20px', 
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {error && (
            <div style={{ 
              padding: '12px',
              backgroundColor: '#ff3b30',
              color: 'white',
              borderRadius: '12px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="ios-button ios-button-secondary"
              onClick={() => setShowCamera(false)}
              disabled={loading}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              className="ios-button"
              onClick={handleCaptureImage}
              disabled={loading}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              {loading ? loadingMessage : (
                <>
                  <IoCamera size={20} />
                  <span>Capture & Analyze</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showForm && recommendation) {
    const parsedRec = parseRecommendation(recommendation);
    
    return (
      <div style={{ paddingBottom: '80px' }}>
        {/* Nav Bar */}
        <div className="ios-nav-bar">
          <button className="ios-nav-back" onClick={handleBack}>
            ← Back
          </button>
          <h1 className="ios-nav-title">
            {selectedHistoryItem ? 'Previous Analysis' : 'Analysis Results'}
          </h1>
        </div>

        <div style={{ padding: '16px' }}>
          {/* History Item Indicator */}
          {selectedHistoryItem && (
            <div className="ios-card" style={{ 
              marginBottom: '16px',
              backgroundColor: '#fff3e0',
              borderLeft: '4px solid #ff9800'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '14px',
                color: '#e65100'
              }}>
                <IoTimeOutline size={18} />
                <span>
                  <strong>From History:</strong> {formatHistoryDate(selectedHistoryItem.timestamp)}
                </span>
              </div>
            </div>
          )}

          {/* Photo Analysis Section - FIRST */}
          {capturedImages.length > 0 && (
            <div className="ios-card" style={{ marginBottom: '16px' }}>
              <h3 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '17px',
                fontWeight: '600',
                color: 'var(--ios-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <IoCamera size={20} />
                <span>Photo Analysis</span>
              </h3>
              <div style={{ 
                display: 'flex', 
                gap: '12px', 
                overflowX: 'auto',
                padding: '8px 0',
                marginBottom: '12px'
              }}>
                {capturedImages.map((img, idx) => (
                  <img 
                    key={idx}
                    src={img} 
                    alt={`Analysis ${idx + 1}`}
                    style={{ 
                      width: '120px', 
                      height: '120px', 
                      borderRadius: '16px',
                      objectFit: 'cover',
                      flexShrink: 0,
                      border: '2px solid var(--ios-blue)'
                    }}
                  />
                ))}
              </div>
              <div style={{
                backgroundColor: '#f0f8ff',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                color: '#333'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <IoCheckmarkCircle size={16} color="var(--ios-green)" />
                  <span style={{ fontWeight: '600' }}>Image analyzed successfully</span>
                </div>
                <span style={{ color: '#666' }}>
                  Your posture and body composition have been analyzed to create personalized recommendations below.
                </span>
              </div>
            </div>
          )}

          {/* Fitness Recommendations - SECOND (parsed into sections) */}
          {parsedRec.sections.map((section, idx) => {
            const IconComponent = section.icon;
            return (
              <div key={idx} className="ios-card" style={{ marginBottom: '16px' }}>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '17px',
                  fontWeight: '600',
                  color: 'var(--ios-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <IconComponent size={20} />
                  <span>{section.title}</span>
                </h3>
                <div style={{ 
                  fontSize: '15px',
                  lineHeight: '1.6',
                  color: 'var(--ios-label)'
                }}>
                  <FormattedContent content={section.content} />
                </div>
              </div>
            );
          })}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <button 
              className="ios-button"
              onClick={generateWeeklyPlan}
              disabled={isGeneratingWeeklyPlan}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: '8px',
                padding: '16px',
                fontSize: '17px',
                fontWeight: '600'
              }}
            >
              {isGeneratingWeeklyPlan ? 'Generating Weekly Plan...' : (
                <>
                  <IoCalendar size={22} />
                  <span>Generate Weekly Plan</span>
                </>
              )}
            </button>
            
            <button 
              className="ios-button ios-button-secondary"
              onClick={() => navigate('/')}
              style={{ padding: '14px' }}
            >
              📊 View Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '80px' }}>
      {/* Nav Bar */}
      <div className="ios-nav-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="ios-nav-title" style={{ flex: 1 }}>AI Fitness Advisor</h1>
        <button
          onClick={handleViewHistory}
          style={{
            background: 'none',
            border: 'none',
            padding: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--ios-blue)',
            fontSize: '15px',
            fontWeight: '500'
          }}
        >
          <IoTimeOutline size={20} />
          <span>History</span>
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        {/* View Previous Analyses Card - Always show for discoverability */}
        <div 
          className="ios-card" 
          onClick={handleViewHistory}
          style={{ 
            marginBottom: '16px',
            cursor: 'pointer',
            backgroundColor: analysisHistory.length > 0 ? '#f0f8ff' : '#f5f5f5',
            borderLeft: `4px solid ${analysisHistory.length > 0 ? 'var(--ios-blue)' : '#ccc'}`
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <IoTimeOutline size={24} color={analysisHistory.length > 0 ? 'var(--ios-blue)' : '#999'} />
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--ios-label)' }}>
                  {analysisHistory.length > 0 ? 'View Previous Analyses' : 'Analysis History'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--ios-secondary-label)' }}>
                  {analysisHistory.length > 0 
                    ? `${analysisHistory.length} saved ${analysisHistory.length === 1 ? 'analysis' : 'analyses'}`
                    : 'No analyses yet - complete your first one!'
                  }
                </div>
              </div>
            </div>
            <IoChevronForward size={20} color="var(--ios-secondary-label)" />
          </div>
        </div>

        {/* Profile Alert */}
        {profileLoaded && (
          <div className="ios-card" style={{ 
            marginBottom: '16px',
            backgroundColor: '#d1f2eb',
            borderLeft: '4px solid var(--ios-green)'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--ios-label)' }}>
              ✅ Profile data loaded automatically
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="ios-card" style={{ 
            marginBottom: '16px',
            backgroundColor: '#ffe6e6',
            borderLeft: '4px solid var(--ios-red)'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--ios-red)' }}>
              {error}
            </div>
          </div>
        )}

        {/* Personal Info Card */}
        <div className="ios-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '17px',
            fontWeight: '600'
          }}>
            Personal Information
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="ios-input-label">Fitness Coach</label>
              <select 
                className="ios-input" 
                value={agentType} 
                onChange={handleAgentTypeChange}
              >
                <option value="general">General Fitness</option>
                <option value="weight_loss">Weight Loss</option>
                <option value="muscle_gain">Muscle Building</option>
                <option value="cardio">Cardio Focus</option>
                <option value="strength">Strength Training</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="ios-input-label">Gender</label>
                <select 
                  className="ios-input" 
                  value={gender} 
                  onChange={handleGenderChange}
                >
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="ios-input-label">Age</label>
                <input 
                  type="number" 
                  className="ios-input" 
                  value={age} 
                  onChange={handleAgeChange}
                  placeholder="25"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="ios-input-label">Weight (lbs)</label>
                <input 
                  type="number" 
                  className="ios-input" 
                  value={weight} 
                  onChange={handleWeightChange}
                  placeholder="150"
                />
              </div>

              <div>
                <label className="ios-input-label">Height (in)</label>
                <input 
                  type="number" 
                  className="ios-input" 
                  value={height} 
                  onChange={handleHeightChange}
                  placeholder="70"
                />
              </div>
            </div>

            <div>
              <label className="ios-input-label">Health Conditions (Optional)</label>
              <textarea 
                className="ios-input" 
                value={healthConditions} 
                onChange={handleHealthConditionsChange}
                placeholder="e.g., Lower back pain, knee injury, beginner to exercise..."
                rows="3"
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>
        </div>

        {/* Image Selection Card */}
        <div className="ios-card" style={{ marginBottom: '16px' }}>
          <h3 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '17px',
            fontWeight: '600'
          }}>
            Capture Your Photos
          </h3>
          
          {capturedImages.length > 0 && (
            <div style={{ 
              display: 'flex', 
              gap: '8px', 
              overflowX: 'auto',
              marginBottom: '12px',
              padding: '8px 0'
            }}>
              {capturedImages.map((img, idx) => (
                <img 
                  key={idx}
                  src={img} 
                  alt={`Preview ${idx + 1}`}
                  style={{ 
                    width: '80px', 
                    height: '80px', 
                    borderRadius: '12px',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              ))}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="ios-button"
              onClick={handleTakePhoto}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <IoCamera size={20} />
              <span>Use Camera</span>
            </button>
            
            <button 
              className="ios-button ios-button-secondary"
              onClick={handlePickFromGallery}
              disabled={loading}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <IoImages size={20} />
              <span>Choose from Gallery</span>
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Analyze Button */}
        <button 
          className="ios-button"
          onClick={handleAnalyze}
          disabled={loading || (selectedFiles.length === 0 && capturedImages.length === 0)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          {loading ? (
            <>
              <span style={{ marginRight: '8px' }}>⏳</span>
              {loadingMessage || 'Analyzing...'}
            </>
          ) : (
            <>
              <IoSearch size={20} />
              <span>Analyze Fitness</span>
            </>
          )}
        </button>

        {loading && (
          <div className="ios-card" style={{ marginTop: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '14px', color: 'var(--ios-secondary-label)' }}>
              This may take 45-60 seconds for comprehensive analysis...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FitnessAdvisorPageMobile;
