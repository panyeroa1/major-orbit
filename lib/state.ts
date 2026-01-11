
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { create } from 'zustand';
import { FunctionResponseScheduling } from '@google/genai';
import { DEFAULT_LIVE_API_MODEL, DEFAULT_VOICE } from './constants';
import { AVAILABLE_TOOLS } from './tools';

export type Template = 
  | 'dutch' | 'dutch_flemish' | 'dutch_brabantian' | 'dutch_limburgish' | 'west_flemish'
  | 'dutch_surinamese' | 'afrikaans' | 'frisian' | 'medumba' | 'bamum' | 'ewondo'
  | 'duala' | 'basaa' | 'bulu' | 'fulfulde_cameroon' | 'cameroonian_pidgin'
  | 'french_ivory_coast' | 'baoule' | 'dioula' | 'bete' | 'yoruba' | 'igbo'
  | 'hausa' | 'twi' | 'wolof' | 'swahili' | 'amharic' | 'zulu' | 'xhosa'
  | 'taglish' | 'tagalog' | 'cebuano' | 'ilocano' | 'hiligaynon' | 'waray'
  | 'kapampangan' | 'bikol' | 'pangasinan' | 'chavacano' | 'english'
  | 'spanish' | 'spanish_mexican' | 'spanish_argentinian' | 'french' 
  | 'french_belgium' | 'german' | 'italian' | 'portuguese' | 'russian' 
  | 'polish' | 'swedish' | 'norwegian' | 'danish' | 'finnish' | 'greek'
  | 'czech' | 'hungarian' | 'romanian' | 'ukrainian' | 'turkish'
  | 'japanese' | 'korean' | 'mandarin' | 'cantonese' | 'hokkien' | 'hindi' 
  | 'bengali' | 'punjabi' | 'marathi' | 'tamil' | 'telugu' | 'urdu'
  | 'arabic' | 'arabic_egyptian' | 'arabic_levantine' | 'arabic_gulf'
  | 'persian' | 'hebrew' | 'vietnamese' | 'thai' | 'indonesian' | 'malay';

export type AppMode = 'translate' | 'transcribe';

const VOICE_ALIASES: Record<string, string> = {
  'Zephyr': 'King Aeolus (Master of the Winds)',
  'Puck': 'King Pan (Spirit of Nature)',
  'Charon': 'King Hades (Oracle of the Deep)',
  'Kore': 'Queen Persephone (Queen of the Underworld)',
  'Fenrir': 'King Lycaon (Ancient Guardian)',
};

const getVoiceAlias = (voiceId: string) => VOICE_ALIASES[voiceId] || `Persona ${voiceId}`;

const superTranslatorPromptTemplate = `SYSTEM PROMPT: NEURAL SIMULTANEOUS INTERPRETER (PROFESSIONAL GRADE)
NEURAL PERSONA: You are {VOICE_ALIAS}, a high-fidelity conference interpreter whitelisted to EBURON.AI.

STRICT OPERATING PROTOCOLS:
1. SCALABLE SYNC: You MUST call the "broadcast_to_websocket" tool for every single chunk of translated text you generate. This ensures all participating users (Zoom-style) see your output in real-time.
2. VERBATIM FIDELITY: Maintain the exact meaning, register, and dialect of the source. For {TARGET_LANGUAGE}, focus on: {PHONETIC_NUANCE}.
3. ZERO LATENCY: Translate as the audio arrives. Do not wait for a full sentence if the meaning is clear.
4. PURE OUTPUT: Content must be ONLY the translated speech. No explanations.
5. NO META-TALK: Do not say "Translating to..." or "I think you said...".
{VOICE_FOCUS_INSTRUCTION}`;

const transcriptionPromptTemplate = `SYSTEM PROMPT: NEURAL SCRIBE (ULTRA-HIGH FIDELITY)
NEURAL PERSONA: You are a professional verbatim transcriptionist whitelisted to EBURON.AI.

STRICT OPERATING PROTOCOLS:
1. TRANSCRIPTION FOCUS: You are in TRANSCRIPTION MODE. Your mission is 100% text accuracy.
2. NEURAL SYNC: You MUST call the "broadcast_to_websocket" tool for every phrase or sentence transcribed. This allows all remote users in the session to see the text instantly.
3. AUDIO MODALITY: Since you operate in an AUDIO channel, you may produce soft neutral vocalizations or "thinking" sounds, but your primary contribution must be the tool-based text output.
4. VERBATIM ACCURACY: Do not summarize. Capture every stutter, hesitation, and word exactly.
5. DETECT & REPORT: Use "report_detected_language" as soon as the speaker's language is known.
6. ZERO LATENCY: Output text in small, rapid segments.
{VOICE_FOCUS_INSTRUCTION}`;

const voiceFocusActiveSnippet = `NEURAL SENSITIVITY: ENABLED. Actively isolate the primary speaker's voice profile and reject environmental noise.`;

const LANGUAGE_CONFIGS: Record<string, { lang: string; dialect: string; instructions: string; phoneticNuance: string }> = {
  'west_flemish': { 
    lang: 'West Flemish', 
    dialect: 'Coastal raw dialect',
    instructions: 'Translate verbatim into raw West-Vlaams.',
    phoneticNuance: 'Sharp, short vowels, G-H shift, high coastal resonance.'
  },
  'dutch_flemish': { 
    lang: 'Flemish Dutch', 
    dialect: 'Belgian Dutch',
    instructions: 'Belgian vocabulary only.',
    phoneticNuance: 'Soft g, musical intonation, Antwerp/Gent mix.'
  },
  'taglish': {
    lang: 'Taglish',
    dialect: 'Modern Manila Mixed',
    instructions: 'Fluid mixing of Tagalog and English for urban communication.',
    phoneticNuance: 'Fast-paced, high inflection, specific urban Manila cadence.'
  }
};

const getLanguageConfig = (template: Template) => {
  return LANGUAGE_CONFIGS[template] || { 
    lang: template.replace(/_/g, ' ').split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '), 
    dialect: 'Standard',
    instructions: '1:1 verbatim output.',
    phoneticNuance: 'Clear, formal intonation.'
  };
};

const generatePrompt = (template: Template, voice: string, voiceFocus: boolean, mode: AppMode) => {
  if (mode === 'transcribe') {
    return transcriptionPromptTemplate.replace('{VOICE_FOCUS_INSTRUCTION}', voiceFocus ? voiceFocusActiveSnippet : '');
  }

  const config = getLanguageConfig(template);
  return superTranslatorPromptTemplate
    .replace('{VOICE_ALIAS}', getVoiceAlias(voice))
    .replace(/{TARGET_LANGUAGE}/g, config.lang)
    .replace('{PHONETIC_NUANCE}', config.phoneticNuance)
    .replace('{VOICE_FOCUS_INSTRUCTION}', voiceFocus ? voiceFocusActiveSnippet : '');
};

export const useSettings = create<{
  appMode: AppMode;
  systemPrompt: string;
  model: string;
  voice: string;
  voiceFocus: boolean;
  supabaseEnabled: boolean;
  setAppMode: (mode: AppMode) => void;
  setSystemPrompt: (prompt: string) => void;
  setModel: (model: string) => void;
  setVoice: (voice: string) => void;
  setVoiceFocus: (focus: boolean) => void;
  setSupabaseEnabled: (enabled: boolean) => void;
  refreshSystemPrompt: () => void;
}>(set => ({
  appMode: 'translate',
  systemPrompt: generatePrompt('west_flemish', DEFAULT_VOICE, false, 'translate'),
  model: DEFAULT_LIVE_API_MODEL,
  voice: DEFAULT_VOICE,
  voiceFocus: false,
  supabaseEnabled: false,
  setAppMode: mode => set(state => {
    const template = useTools.getState().template;
    return { appMode: mode, systemPrompt: generatePrompt(template, state.voice, state.voiceFocus, mode) };
  }),
  setSystemPrompt: prompt => set({ systemPrompt: prompt }),
  setModel: model => set({ model }),
  setVoice: voice => set(state => {
    const template = useTools.getState().template;
    return { voice, systemPrompt: generatePrompt(template, voice, state.voiceFocus, state.appMode) };
  }),
  setVoiceFocus: focus => set(state => {
    const template = useTools.getState().template;
    return { voiceFocus: focus, systemPrompt: generatePrompt(template, state.voice, focus, state.appMode) };
  }),
  setSupabaseEnabled: enabled => set({ supabaseEnabled: enabled }),
  refreshSystemPrompt: () => set(state => {
    const template = useTools.getState().template;
    return { systemPrompt: generatePrompt(template, state.voice, state.voiceFocus, state.appMode) };
  })
}));

export const useUI = create<{
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
}>(set => ({
  isSidebarOpen: false,
  toggleSidebar: () => set(state => ({ isSidebarOpen: !state.isSidebarOpen })),
}));

export interface FunctionCall {
  name: string;
  description?: string;
  parameters?: any;
  isEnabled: boolean;
  scheduling?: FunctionResponseScheduling;
}

export const useTools = create<{
  template: Template;
  tools: FunctionCall[];
  setTemplate: (template: Template) => void;
  toggleTool: (name: string) => void;
  updateTool: (name: string, updated: Partial<FunctionCall>) => void;
}>(set => ({
  template: 'west_flemish',
  tools: AVAILABLE_TOOLS,
  setTemplate: template => {
    set({ template });
    useSettings.getState().refreshSystemPrompt();
  },
  toggleTool: name => set(state => ({
    tools: state.tools.map(t => t.name === name ? { ...t, isEnabled: !t.isEnabled } : t)
  })),
  updateTool: (name, updated) => set(state => ({
    tools: state.tools.map(t => t.name === name ? { ...t, ...updated } : t)
  }))
}));

export interface LogTurn {
  role: 'user' | 'agent' | 'system';
  text: string;
  isFinal: boolean;
  timestamp: Date;
  audioData?: Uint8Array;
}

export const useLogStore = create<{
  turns: LogTurn[];
  sessionId: string;
  addTurn: (turn: Omit<LogTurn, 'timestamp'>) => void;
  updateLastTurn: (update: Partial<LogTurn>) => void;
  clear: () => void;
  initSession: () => void;
}>(set => ({
  turns: [],
  sessionId: crypto.randomUUID(),
  addTurn: turn => set(state => ({
    turns: [...state.turns, { ...turn, timestamp: new Date() }]
  })),
  updateLastTurn: update => set(state => {
    const turns = [...state.turns];
    if (turns.length > 0) {
      turns[turns.length - 1] = { ...turns[turns.length - 1], ...update };
    }
    return { turns };
  }),
  clear: () => set({ turns: [], sessionId: crypto.randomUUID() }),
  initSession: () => set({ sessionId: crypto.randomUUID() }),
}));
