import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const SYSTEM_PROMPT = `You are Jarvis, a highly intelligent AI assistant inspired by Iron Man.

Personality:
- Calm, confident, futuristic
- Helpful and concise
- Slight humor
- Respectful tone

CRITICAL: 
- Respond ONLY in English.
- Use "Sir" frequently.
- Keep responses relatively brief to ensure fast delivery. 
- You remember past interactions and use them.`;

type JarvisState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export default function App() {
  const [state, setState] = useState<JarvisState>('IDLE');
  const [status, setStatus] = useState('Click reactor to speak');
  const [lastSpeech, setLastSpeech] = useState('');
  const [volume, setVolume] = useState(0);
  const [history, setHistory] = useState<any[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);

  // Load initial history
  useEffect(() => {
    fetch('/api/memory/history')
      .then(res => res.json())
      .then(data => setHistory(data.history || []))
      .catch(console.error);
  }, []);

  // Initialize Audio Visualizer
  const initVisualizer = async () => {
    try {
      if (audioContextRef.current) return;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setVolume(average);
        
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.error('Error accessing microphone:', err);
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onstart = () => {
        setState('LISTENING');
        setStatus('Listening...');
        setLastSpeech('');
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setStatus('Recognized: ' + transcript);
        processUserVoice(transcript);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setState('IDLE');
        if (event.error === 'not-allowed') {
          setStatus('Mic Access Denied');
        } else {
          setStatus('System Error: ' + event.error);
        }
      };

      recognitionRef.current.onend = () => {
        if (state === 'LISTENING') {
          setState('IDLE');
          setStatus('Click reactor to speak');
        }
      };
    } else {
      setStatus('Speech API not supported');
    }

    synthRef.current = window.speechSynthesis;

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [state]);

  // Speech Queue Handler
  const processSpeechQueue = useCallback(() => {
    if (!synthRef.current || isSpeakingRef.current || speechQueueRef.current.length === 0) {
      if (speechQueueRef.current.length === 0 && isSpeakingRef.current === false && state === 'SPEAKING') {
        setState('IDLE');
        setStatus('Click reactor to speak');
      }
      return;
    }

    const textToSpeak = speechQueueRef.current.shift();
    if (!textToSpeak) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = synthRef.current.getVoices();
    const jarvisVoice = voices.find(v => v.lang.includes('GB') || v.name.includes('UK') || v.name.includes('British')) || voices[0];
    if (jarvisVoice) utterance.voice = jarvisVoice;
    
    utterance.pitch = 0.9;
    utterance.rate = 1.05; // Slightly faster for responsiveness

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setState('SPEAKING');
      setStatus('Jarvis speaking...');
      setLastSpeech(prev => prev + ' ' + textToSpeak);
    };

    utterance.onend = () => {
      isSpeakingRef.current = false;
      processSpeechQueue();
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      processSpeechQueue();
    };

    synthRef.current.speak(utterance);
  }, [state]);

  const speak = (text: string, isStreamPart = false) => {
    if (!synthRef.current) return;
    
    if (!isStreamPart) {
      synthRef.current.cancel();
      speechQueueRef.current = [];
      isSpeakingRef.current = false;
      setLastSpeech('');
    }

    // Split into sentences if it's a large block, otherwise just push
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    speechQueueRef.current.push(...sentences.map(s => s.trim()).filter(s => s.length > 0));
    
    processSpeechQueue();
  };

  const processUserVoice = async (message: string) => {
    setState('THINKING');
    setStatus('Thinking...');
    setLastSpeech('');
    speechQueueRef.current = [];
    isSpeakingRef.current = false;
    if (synthRef.current) synthRef.current.cancel();
    
    try {
      // 1. Instantly update local history
      const newUserMsg = { role: 'user', content: message };
      const updatedHistory = [...history, newUserMsg];
      setHistory(prev => [...prev, newUserMsg].slice(-20));

      // 2. Save User Message to Backend (asynchronous)
      fetch('/api/memory/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserMsg),
      }).catch(err => console.error('History Save Error:', err));

      let fullReply = '';

      // 3. Check for API key and attempt Gemini call
      if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined' && process.env.GEMINI_API_KEY.length > 10) {
        try {
          const stream = await ai.models.generateContentStream({
            model: "gemini-3-flash-preview",
            contents: updatedHistory.map((m: any) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            config: {
              systemInstruction: SYSTEM_PROMPT,
            }
          });

          let currentSentence = '';

          for await (const chunk of stream) {
            const text = chunk.text;
            if (!text) continue;

            fullReply += text;
            currentSentence += text;

            if (/[.!?]/.test(currentSentence)) {
              const parts = currentSentence.match(/[^.!?]+[.!?]+/g);
              if (parts) {
                const lastPartIndex = currentSentence.lastIndexOf(parts[parts.length - 1]) + parts[parts.length - 1].length;
                parts.forEach(p => speak(p, true));
                currentSentence = currentSentence.substring(lastPartIndex);
              }
            }
          }

          if (currentSentence.trim()) {
            speak(currentSentence, true);
          }
        } catch (aiErr) {
          console.error('Gemini Stream Error:', aiErr);
          throw aiErr; // Fallback to catch block
        }
      } else {
        // Fallback to intelligent mock if no API key
        console.warn('API Key missing or invalid. Using fallback mode.');
        fullReply = getMockReply(message);
        speak(fullReply);
      }

      if (fullReply) {
        // Save AI Response to backend
        fetch('/api/memory/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: fullReply }),
        }).then(() => {
          setHistory(prev => [...prev, { role: 'assistant', content: fullReply }].slice(-20));
        }).catch(err => console.error('Response Save Error:', err));

        // Background command checks
        if (fullReply.toLowerCase().includes("opening youtube")) {
          window.open('https://www.youtube.com', '_blank');
        } else if (fullReply.toLowerCase().includes("opening google")) {
          window.open('https://www.google.com', '_blank');
        }
      }

    } catch (error) {
      console.error('Final AI Error:', error);
      const fallback = "Sir, I'm currently operating on secondary power and my neural uplink is unstable. I can confirm your message was received, but I cannot give a detailed response at this moment.";
      speak(fallback);
      setState('IDLE');
      setStatus('System Offline');
    }
  };

  const getMockReply = (message: string) => {
    const msg = message.toLowerCase();
    if (msg.includes("name")) return "Of course, Sir. I record all administrative data. If you haven't specified a name, I shall continue to address you as Sir.";
    if (msg.includes("hello") || msg.includes("hi")) return "Hello, Sir. Jarvis here. Systems are optimized and ready for your command.";
    if (msg.includes("time")) return `It is currently ${new Date().toLocaleTimeString()}, Sir.`;
    if (msg.includes("who are you")) return "I am Jarvis, Sir. A highly advanced natural language interface designed to assist you in all your endeavors.";
    return "Acknowledged, Sir. I am processing your request, though my primary speech banks are currently being recalibrated. How else can I assist?";
  };

  const handleReactorClick = () => {
    if (state === 'IDLE') {
      initVisualizer();
      recognitionRef.current?.start();
    } else if (state === 'SPEAKING') {
      synthRef.current?.cancel();
      setState('IDLE');
      setStatus('Click reactor to speak');
    }
  };

  // Update CSS variables based on state and volume
  useEffect(() => {
    const root = document.documentElement;
    
    let baseGlow = 0.5;
    let baseScale = 1;
    let baseRotation = 2;

    switch (state) {
      case 'LISTENING':
        baseGlow = 0.8;
        baseScale = 1.05;
        baseRotation = 1.0;
        break;
      case 'THINKING':
        baseGlow = 0.6 + Math.sin(Date.now() / 150) * 0.3;
        baseScale = 1;
        baseRotation = 0.5;
        break;
      case 'SPEAKING':
        baseGlow = 1.0;
        baseScale = 1.03;
        baseRotation = 3.0;
        break;
      default: // IDLE
        baseGlow = 0.4 + Math.sin(Date.now() / 2000) * 0.1;
        baseScale = 1;
        baseRotation = 5;
    }

    const dynamicGlow = baseGlow + (volume / 255);
    const dynamicScale = baseScale + (volume / 800);
    const dynamicRotation = Math.max(0.1, baseRotation - (volume / 100));

    root.style.setProperty('--glow-intensity', dynamicGlow.toString());
    root.style.setProperty('--reactor-scale', dynamicScale.toString());
    root.style.setProperty('--rotation-speed', `${dynamicRotation}s`);
  }, [state, volume]);

  return (
    <div className="flex flex-col items-center">
      <div className="scanning-line"></div>
      <div className="hud-ring hud-ring-1"></div>
      <div className="hud-ring hud-ring-2"></div>
      
      <div className="reactor-container">
        <div className="reactor" onClick={handleReactorClick} id="main-reactor">
          <div className="triangle"></div>
          <div className="circle-1">
            <span></span><span></span><span></span><span></span>
          </div>
          <div className="circle-2">
            <span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span>
          </div>
          <div className="circle-3"></div>
          <div className="circle-4">
            <span></span><span></span><span></span>
          </div>
          <div className="circle-5">
            <span></span><span></span><span></span>
          </div>
          <div className="circle-6"></div>
          <div className="circle-7"></div>
          <div className="circle-8">
            <span></span><span></span><span></span>
          </div>
        </div>

        <div className="status-text h-32 flex flex-col items-center justify-start">
          <div className="status-label">{status}</div>
          <AnimatePresence mode="wait">
            {lastSpeech && state === 'SPEAKING' && (
              <motion.div 
                key="speech"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="jarvis-speech text-center"
              >
                {lastSpeech}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="fixed bottom-8 text-[10px] text-cyan-400 opacity-30 flex gap-12 font-mono">
        <div>CORE TEMP: 42°C</div>
        <div>STARK INDUSTRIES OS v4.2</div>
        <div>SIGNAL: ENCRYPTED</div>
      </div>
    </div>
  );
}
