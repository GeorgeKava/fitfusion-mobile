import React, { useState, useRef } from 'react';
import './VoiceChatWebRTC.css';
import { getApiUrl } from '../config/api';

const VoiceChatWebRTC = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [sessionState, setSessionState] = useState({
    sessionId: null,
    ephemeralKey: null,
    isActive: false
  });

  // WebRTC state
  const peerConnectionRef = useRef(null);
  const dataChannelRef = useRef(null);
  const audioElementRef = useRef(null);

  /**
   * Logs a message to the chat display
   */
  const logMessage = (text, sender = 'system') => {
    setMessages(prev => [
      ...prev,
      {
        role: sender,
        content: text,
        timestamp: new Date().toISOString()
      }
    ]);
  };

  /**
   * Event listener for the 'Start Session' button.
   * Initiates a session with the backend, retrieves an ephemeral key and session ID,
   * and then starts the WebRTC connection.
   */
  const startSession = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setError(null);
    setMessages([]); // Clear previous logs
    
    console.log('🎤 Starting session with user:', user);
    console.log('🎤 User email:', user?.email);
    console.log('🎤 User object keys:', user ? Object.keys(user) : 'No user object');
    
    try {
      // Step 1: Start session and get ephemeral key
      const requestBody = { 
        botType: 'fitness',
        user_email: user?.email || 'test@example.com' // Include user email
      };
      
      console.log('🎤 Request body:', requestBody);
      
      const sessionResponse = await fetch(getApiUrl('/start-session'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await sessionResponse.json();
      
      if (!sessionResponse.ok) {
        throw new Error(data.error || 'Failed to start session');
      }

      const ephemeralKey = data.ephemeral_key;
      const sessionId = data.session_id;
      
      if (!ephemeralKey || !sessionId) {
        throw new Error('Invalid session data received');
      }

      setSessionState({
        ephemeralKey,
        sessionId,
        isActive: true
      });

      logMessage('Ephemeral Key Received (session starting)', 'system');
      logMessage('WebRTC Session Id = ' + sessionId, 'system');
      
      await startWebRTC(ephemeralKey);
      
    } catch (error) {
      logMessage('Failed to start session: ' + error.message, 'system');
      console.error('Failed to start session:', error);
      setError(error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Initializes and manages the WebRTC connection.
   * Sets up the peer connection, media streams, data channel, and event listeners for data channel messages.
   * Also handles the SDP offer/answer exchange with the backend.
   */
  const startWebRTC = async (ephemeralKey) => {
    try {
      const peerConnection = new RTCPeerConnection();
      peerConnectionRef.current = peerConnection;
      
      const audioElement = document.createElement('audio');
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;
      
      logMessage('WebRTC Peer Connection Created', 'system');
      
      // Handle incoming audio track
      peerConnection.ontrack = (event) => {
        if (audioElement.srcObject !== event.streams[0]) {
          audioElement.srcObject = event.streams[0];
          logMessage('Audio track received', 'system');
        }
      };

      // Get user microphone access
      try {
        const clientMedia = await navigator.mediaDevices.getUserMedia({ audio: true });
        clientMedia.getTracks().forEach(track => peerConnection.addTrack(track, clientMedia));
        logMessage('Microphone access granted and audio track added', 'system');
      } catch (err) {
        logMessage('Error accessing microphone: ' + err.message, 'system');
        console.error('Error accessing microphone:', err);
        return;
      }
      
      // Create data channel
      const dataChannel = peerConnection.createDataChannel('realtime-channel');
      dataChannelRef.current = dataChannel;
      logMessage('Data channel created', 'system');
      
      // Data channel event listeners
      dataChannel.addEventListener('open', () => {
        logMessage('Data channel is open', 'system');
        updateSession(); // Send session configuration

        // Send greeting message to the bot after session is updated
        setTimeout(() => {
          if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
            const greetingMessage = {
              type: "response.create",
              response: {
                modalities: ["text", "audio"],
                instructions: "Hello! I'm FitFusion AI. I'm here to help you with fitness advice, workout plans, and answer any health and fitness related questions. How can I assist you with your fitness journey today?",
                max_output_tokens: 150
              }
            };
            logMessage("Sending greeting to bot", 'system');
            dataChannelRef.current.send(JSON.stringify(greetingMessage));
          }
        }, 500); // Small delay to ensure session update is processed first
      });

      dataChannel.addEventListener('message', (event) => {
        const realtimeEvent = JSON.parse(event.data);
        console.log('Received event from bot:', realtimeEvent);

        // Display messages in the transcript ONLY from "response.audio_transcript.done" events (BOT'S SPEECH)
        if (realtimeEvent.type === "response.audio_transcript.done" && realtimeEvent.transcript) {
          logMessage(realtimeEvent.transcript, 'bot');
        }
        else if (realtimeEvent.type === "conversation.item.input_audio_transcription.completed" && realtimeEvent.transcript) {
          // Display user's speech transcription
          logMessage(realtimeEvent.transcript, 'user');
        }
        else if (realtimeEvent.type === "response.function_call_arguments.done") {
          // Handle function calls
          handleFunctionCall(realtimeEvent);
        }
      });

      dataChannel.addEventListener('close', () => {
        logMessage('Data channel is closed', 'system');
      });

      dataChannel.addEventListener('error', (error) => {
        logMessage('Data channel error: ' + error, 'system');
        console.error('Data channel error:', error);
      });

      // ICE candidate handling
      peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          console.log('ICE candidate generated');
        }
      };

      // Connection state monitoring
      peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection) {
          console.log('ICE connection state:', peerConnection.iceConnectionState);
          if (peerConnection.iceConnectionState === 'connected') {
            logMessage('WebRTC connection established', 'system');
          } else if (peerConnection.iceConnectionState === 'failed') {
            logMessage('WebRTC connection failed', 'system');
          }
        }
      };
      
      logMessage('Creating SDP offer...', 'system');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      try {
        const sdpResponse = await fetch(getApiUrl('/webrtc-sdp'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ephemeral_key: ephemeralKey, 
            offer_sdp: offer.sdp 
          })
        });
        
        const sdpData = await sdpResponse.json();
        
        if (!sdpResponse.ok) {
          throw new Error(sdpData.error || 'SDP exchange failed');
        }
        
        logMessage('SDP answer received, setting remote description', 'system');
        await peerConnection.setRemoteDescription({ 
          type: 'answer', 
          sdp: sdpData.answer_sdp 
        });
        
        logMessage('Remote description set. WebRTC connection should be establishing', 'system');

      } catch (error) {
        logMessage('Error during SDP exchange: ' + error.message, 'system');
        console.error('Error during SDP exchange:', error);
        throw error;
      }
      
    } catch (error) {
      console.error('WebRTC setup failed:', error);
      setError(`WebRTC setup failed: ${error.message}`);
      logMessage(`WebRTC setup failed: ${error.message}`, 'system');
    }
  };

  /**
   * Sends a 'session.update' event to the bot.
   * This configures the bot's instructions, persona, and available tools (functions).
   * It's called when the data channel opens.
   * Configuration for instructions, tools, turn_detection, and tool_choice is fetched from the backend.
   */
  const updateSession = async () => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      logMessage('Cannot update session: Data channel not open', 'system');
      return;
    }

    try {
      // Fetch session configuration from the backend
      const response = await fetch(getApiUrl('/get-session-configuration'));
      if (!response.ok) {
        throw new Error('Failed to get session configuration');
      }
      
      const configFromServer = await response.json();

      const event = {
        type: "session.update",
        session: {
          instructions: configFromServer.instructions,
          input_audio_transcription: {
            model: configFromServer.transcription_model
          },
          turn_detection: configFromServer.turn_detection,
          tools: configFromServer.tools,
          tool_choice: configFromServer.tool_choice || "auto"
        }
      };
      
      logMessage("Sending session.update to bot", 'system');
      console.log("Sending session.update with fetched configuration:", event);
      dataChannelRef.current.send(JSON.stringify(event));

    } catch (error) {
      logMessage('Failed to update session with server configuration: ' + error.message, 'system');
      console.error('Failed to update session with server configuration:', error);
    }
  };

  /**
   * Handle function calls from the assistant
   */
  const handleFunctionCall = async (event) => {
    const { name, call_id, arguments: args } = event;
    console.log('Function call received: George', { name, call_id, args });
    
    try {
      let result;
      
      // Handle different function calls
      switch (name) {
        case 'get_fitness_recommendations':
          console.log('Handling get_fitness_recommendations:', args);
          result = await handleFitnessRecommendation(args);
          break;
        case 'get_user_profile':
          result = await handleGetUserProfile(args);
          break;
        case 'get_progress_data':
          result = await handleGetProgressData(args);
          break;
        case 'get_todays_plan':
          result = await handleGetTodaysPlan(args);
          break;
        default:
          result = { error: `Unknown function: ${name}` };
      }
      
      // Send function result back to assistant
      const functionResult = {
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call_id,
          output: JSON.stringify(result)
        }
      };
      
      if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
        dataChannelRef.current.send(JSON.stringify(functionResult));
        
        // Request response generation
        const responseRequest = {
          type: "response.create"
        };
        dataChannelRef.current.send(JSON.stringify(responseRequest));
      }
      
    } catch (error) {
      console.error('Error handling function call:', error);
      logMessage(`Error handling function call: ${error.message}`, 'system');
    }
  };

  /**
   * Handle fitness recommendation requests
   */
  const handleFitnessRecommendation = async (args) => {
    try {
      const response = await fetch(getApiUrl('/functions/get_fitness_recommendations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  };

  /**
   * Handle user profile requests
   */
  const handleGetUserProfile = async (args) => {
    try {
      const response = await fetch(getApiUrl('/functions/get_user_profile'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  };

  /**
   * Handle progress data requests
   */
  const handleGetProgressData = async (args) => {
    try {
      const response = await fetch(getApiUrl('/functions/get_progress_data'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  };

  /**
   * Handle today's plan requests
   */
  const handleGetTodaysPlan = async (args) => {
    try {
      const response = await fetch(getApiUrl('/functions/get_todays_plan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(args)
      });
      
      return await response.json();
    } catch (error) {
      return { error: error.message };
    }
  };

  /**
   * Closes the WebRTC data channel and peer connection.
   */
  const stopSession = () => {
    logMessage("Closing session...", 'system');
    
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }
    
    setSessionState({
      sessionId: null,
      ephemeralKey: null,
      isActive: false
    });
    
    logMessage("Session closed", 'system');
  };

  return (
    <div className="voice-chat-webrtc">
      <div className="chat-header">
        <h1>🎤 AI Fitness Coach</h1>
        <p>Your personal voice-powered fitness assistant</p>
      </div>
      
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
      )}
      
      <div className="controls">
        <button 
          onClick={startSession}
          disabled={isConnecting || sessionState.isActive}
          className={`btn btn-voice-chat ${(isConnecting || sessionState.isActive) ? 'disabled' : ''}`}
        >
          {isConnecting ? (
            <>
              <i className="fas fa-spinner fa-spin me-2"></i>
              Connecting...
            </>
          ) : (
            <>
              <i className="fas fa-microphone me-2"></i>
              Start Voice Chat
            </>
          )}
        </button>
        
        {sessionState.isActive && (
          <button 
            onClick={stopSession}
            className="btn btn-danger"
          >
            <i className="fas fa-stop me-2"></i>
            Stop Session
          </button>
        )}
      </div>

      <div className="transcript-container">
        <div className="transcript-header">
          <h3>
            <i className="fas fa-comments me-2"></i>
            Conversation
          </h3>
        </div>
        <div className="messages-container">
          {messages.filter(message => 
            message.role !== 'system' || 
            (!message.content.includes('Ephemeral Key') && 
             !message.content.includes('WebRTC Session Id') &&
             !message.content.includes('WebRTC Peer Connection') &&
             !message.content.includes('Microphone access') &&
             !message.content.includes('Data channel') &&
             !message.content.includes('Creating SDP') &&
             !message.content.includes('SDP answer') &&
             !message.content.includes('Remote description') &&
             !message.content.includes('Audio track') &&
             !message.content.includes('ICE connection') &&
             !message.content.includes('WebRTC connection') &&
             !message.content.includes('Sending session.update') &&
             !message.content.includes('Sending greeting'))
          ).length === 0 ? (
            <div className="empty-state">
              <div className="icon">💬</div>
              <p>Start a voice session to begin talking with your AI fitness coach!</p>
            </div>
          ) : (
            messages
              .filter(message => 
                message.role !== 'system' || 
                (!message.content.includes('Ephemeral Key') && 
                 !message.content.includes('WebRTC Session Id') &&
                 !message.content.includes('WebRTC Peer Connection') &&
                 !message.content.includes('Microphone access') &&
                 !message.content.includes('Data channel') &&
                 !message.content.includes('Creating SDP') &&
                 !message.content.includes('SDP answer') &&
                 !message.content.includes('Remote description') &&
                 !message.content.includes('Audio track') &&
                 !message.content.includes('ICE connection') &&
                 !message.content.includes('WebRTC connection') &&
                 !message.content.includes('Sending session.update') &&
                 !message.content.includes('Sending greeting'))
              )
              .map((message, index) => (
                <div 
                  key={index} 
                  className={`message message-${message.role}`}
                >
                  <div className="message-role">{message.role}:</div>
                  <div>{message.content}</div>
                </div>
              ))
          )}
        </div>
      </div>
      
      {sessionState.isActive && (
        <div className="session-status">
          <i className="fas fa-circle text-success me-2" style={{color: '#28a745'}}></i>
          <strong>Session Active:</strong> You can now speak to your fitness assistant!
          <br />
          <small>Session ID: {sessionState.sessionId}</small>
        </div>
      )}
    </div>
  );
};

export default VoiceChatWebRTC;
