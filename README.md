# Jarvis Arc Reactor AI Assistant

A futuristic AI assistant inspired by Iron Man, featuring a voice-reactive Arc Reactor UI.

## Features

- **Iconic Arc Reactor UI**: Precise animation and visual design from the Iron Man films.
- **Voice Interaction**: Talk to Jarvis using your microphone.
- **Intelligent Response**: Powered by Google Gemini with a Jarvis-inspired personality.
- **Real-time Visualization**: The reactor glows and pulses in sync with your voice and Jarvis's speech.
- **Persistent Memory**: Jarvis remembers your name and past interactions.

## Setup Instructions

1. **API Key**: Ensure you have a `GEMINI_API_KEY` set in your environment or Secret panel.
2. **Installation**: The system automatically installs dependencies.
3. **Running the App**:
   - The app runs on a unified Express + Vite server.
   - Click the Arc Reactor to start listening.
   - Say "My name is [Your Name]" to test the memory system.

## Project Structure

- `server.ts`: Unified entry point (Express + Vite middleware).
- `backend/`: Server-side logic for memory and data storage.
- `src/App.tsx`: Frontend application logic and UI.
- `src/index.css`: Arc Reactor styles and HUD effects.

## Command Features

Try saying:
- "My name is Tony Stark"
- "What is my name?"
- "Open YouTube"
- "Tell me a joke, Jarvis"
