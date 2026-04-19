import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MEMORY_FILE = path.join(process.cwd(), 'backend', 'data', 'memory.json');

export function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return { messages: [], userData: {} };
    }
    const data = fs.readFileSync(MEMORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading memory:', error);
    return { messages: [], userData: {} };
  }
}

export function saveMemory(data: any) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving memory:', error);
  }
}

export function saveMessage(role: string, content: string) {
  const memory = loadMemory();
  memory.messages.push({ role, content, timestamp: new Date().toISOString() });
  
  // Keep last 20 messages
  if (memory.messages.length > 20) {
    memory.messages = memory.messages.slice(-20);
  }
  
  saveMemory(memory);
}

export function getRecentMessages() {
  const memory = loadMemory();
  return memory.messages;
}

export function saveUserData(key: string, value: any) {
  const memory = loadMemory();
  memory.userData[key] = value;
  saveMemory(memory);
}

export function getUserData(key: string) {
  const memory = loadMemory();
  return memory.userData[key];
}
