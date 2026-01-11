
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import cn from 'classnames';
import { Modality, LiveServerContent, LiveConnectConfig, LiveServerToolCall } from '@google/genai';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { wsService } from '../../../lib/websocket-service';
import { audioContext } from '../../../lib/utils';
import { logToSupabase } from '../../../lib/supabase';
import {
  useSettings,
  useLogStore,
  useTools,
} from '../../../lib/state';

const AudioVisualizer = memo(({ volume, isAi, connected }: { volume: number; isAi: boolean; connected: boolean }) => {
  const bars = 16;
  // Use local state for bars to ensure high-performance animation if needed, 
  // but volume prop is already optimized.
  return (
    <div className={cn("audio-visualizer", { active: connected && volume > 0.001, ai: isAi })}>
      {Array.from({ length: bars }).map((_, i) => {
        // Create varied heights for a more natural look
        const factor = Math.sin((i / bars) * Math.PI) * 0.7 + 0.3;
        const height = connected ? Math.max(4, volume * 100 * factor) : 4;
        return (
          <div 
            key={i} 
            className="viz-bar" 
            style={{ 
              height: `${height}px`,
              transition: 'height 0.1s ease-out'
            }} 
          />
        );
      })}
    </div>
  );
});

const PlaybackControls = memo(({ audioData }: { audioData: Uint8Array }) => {
  const [status, setStatus] = useState<'playing' | 'paused' | 'stopped'>('stopped');
  const [progress, setProgress] = useState(0);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef(0);
  const pausedAtRef = useRef(0);
  const bufferRef = useRef<AudioBuffer | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  const duration = useMemo(() => audioData.length / 2 / 24000, [audioData]);

  const initBuffer = async () => {
    if (bufferRef.current) return bufferRef.current;
    try {
      const ctx = await audioContext({ id: 'playback' });
      const dataInt16 = new Int16Array(audioData.buffer);
      const float32 = new Float32Array(dataInt16.length);
      for (let i = 0; i < dataInt16.length; i++) {
        float32[i] = dataInt16[i] / 32768;
      }
      const buffer = ctx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      bufferRef.current = buffer;
      return buffer;
    } catch (e) {
      console.error("Playback initialization failed:", e);
      return null;
    }
  };

  const handlePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ctx = await audioContext({ id: 'playback' });
    if (ctx.state === 'suspended') await ctx.resume();
    const buffer = await initBuffer();
    if (!buffer || status === 'playing') return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const offset = status === 'paused' ? pausedAtRef.current : 0;
    source.start(0, offset);
    startTimeRef.current = ctx.currentTime - offset;
    sourceRef.current = source;
    setStatus('playing');
    progressIntervalRef.current = window.setInterval(() => {
      const current = ctx.currentTime - startTimeRef.current;
      const percent = Math.min(100, (current / duration) * 100);
      setProgress(percent);
    }, 50);
    source.onended = () => {
      if (sourceRef.current === source) {
        setStatus('stopped');
        pausedAtRef.current = 0;
        setProgress(0);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      }
    };
  };

  const handlePause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceRef.current && status === 'playing') {
      const ctx = (sourceRef.current.context as AudioContext);
      sourceRef.current.stop();
      pausedAtRef.current = ctx.currentTime - startTimeRef.current;
      sourceRef.current = null;
      setStatus('paused');
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  };

  const handleStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    pausedAtRef.current = 0;
    setProgress(0);
    setStatus('stopped');
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  };

  useEffect(() => {
    return () => {
      if (sourceRef.current) sourceRef.current.stop();
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  return (
    <div className="playback-controls-wrapper">
      <div className="playback-controls">
        {status !== 'playing' ? (
          <button className="playback-btn" onClick={handlePlay} title="Play">
            <span className="material-symbols-outlined">play_arrow</span>
          </button>
        ) : (
          <button className="playback-btn" onClick={handlePause} title="Pause">
            <span className="material-symbols-outlined">pause</span>
          </button>
        )}
        <div className="playback-progress-container">
          <div className="playback-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <button className="playback-btn" onClick={handleStop} disabled={status === 'stopped'} title="Stop">
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>stop</span>
        </button>
      </div>
    </div>
  );
});

export default function StreamingConsole() {
  const { client, setConfig, connected, connect, isAiSpeaking, inputVolume, outputVolume } = useLiveAPIContext();
  const { systemPrompt, voice, supabaseEnabled, appMode, voiceFocus, setVoiceFocus } = useSettings();
  const { tools, template } = useTools();
  const { turns, sessionId, addTurn, updateLastTurn } = useLogStore();
  
  const [transcriptionSegments, setTranscriptionSegments] = useState<string[]>([]);
  const [translation, setTranslation] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
  const [isRemoteInput, setIsRemoteInput] = useState(false);
  
  const currentAudioChunks = useRef<Uint8Array[]>([]);
  const clearTimeoutsRef = useRef<{ trans?: number; input?: number }>({});
  const lastProcessedMessageRef = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const lastUserTextRef = useRef<string | null>(null);

  const handleSendMessage = (text: string, remote: boolean = false) => {
    if (!text) return;
    setIsRemoteInput(remote);
    lastUserTextRef.current = text; 
    setTranslation(""); 
    addTurn({ role: 'user', text, isFinal: true });
    if (connected) {
      client.send([{ text }], true);
    } else {
      connect().then(() => {
        client.send([{ text }], true);
      }).catch(console.error);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns]);

  useEffect(() => {
    if (!connected) {
      setDetectedLanguage(null);
      setTranscriptionSegments([]);
    }
  }, [connected]);

  useEffect(() => {
    if (clearTimeoutsRef.current.trans) window.clearTimeout(clearTimeoutsRef.current.trans);
    if (!isAiSpeaking && translation) {
      clearTimeoutsRef.current.trans = window.setTimeout(() => {
        setTranslation(null);
        setIsRemoteInput(false);
      }, 8000);
    }
  }, [isAiSpeaking, translation]);

  useEffect(() => {
    const handleRemoteMessage = (data: any) => {
      if (data.timestamp && data.timestamp <= lastProcessedMessageRef.current) return;
      if (data.text) {
        lastProcessedMessageRef.current = data.timestamp || Date.now();
        handleSendMessage(data.text, true);
      }
    };
    wsService.on('message', handleRemoteMessage);
    wsService.connect();
    return () => wsService.off('message', handleRemoteMessage);
  }, [connected, client]);

  useEffect(() => {
    const config: LiveConnectConfig = {
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {}, 
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice },
        },
      },
      systemInstruction: { parts: [{ text: systemPrompt }] },
      tools: [{ functionDeclarations: tools.filter(t => t.isEnabled).map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      })) }]
    };
    setConfig(config);
  }, [setConfig, systemPrompt, tools, voice]);

  useEffect(() => {
    const handleContent = (serverContent: LiveServerContent) => {
      const text = serverContent.modelTurn?.parts
          ?.map((p: any) => p.text)
          .filter(Boolean)
          .join(' ') ?? '';
      if (!text) return;
      
      setTranslation(prev => (prev || '') + text);
      
      const currentTurns = useLogStore.getState().turns;
      const last = currentTurns[currentTurns.length - 1];
      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({ text: last.text + text });
      } else {
        addTurn({ role: 'agent', text, isFinal: false });
      }
    };

    const handleOutputTranscription = (text: string) => {
      setTranslation(prev => (prev || '') + text);
      const currentTurns = useLogStore.getState().turns;
      const last = currentTurns[currentTurns.length - 1];
      if (last && last.role === 'agent' && !last.isFinal) {
        updateLastTurn({ text: last.text + text });
      } else {
        addTurn({ role: 'agent', text, isFinal: false });
      }
    };

    const handleInputTranscription = (text: string) => {
      setTranscriptionSegments(prev => {
        const last = prev[prev.length - 1];
        if (last && text.startsWith(last)) {
          const newArr = [...prev];
          newArr[newArr.length - 1] = text;
          return newArr;
        }
        return [...prev, text].slice(-4); 
      });
      
      lastUserTextRef.current = text;
      
      if (clearTimeoutsRef.current.input) window.clearTimeout(clearTimeoutsRef.current.input);
      clearTimeoutsRef.current.input = window.setTimeout(() => {
        if (lastUserTextRef.current === text) {
           setTranscriptionSegments([]);
        }
      }, 7000);
    };

    const handleToolCall = (toolCall: LiveServerToolCall) => {
      for (const fc of toolCall.functionCalls) {
        if (fc.name === 'report_detected_language') {
          const lang = (fc.args as any).language;
          if (lang) {
            setDetectedLanguage(lang);
          }
        }
      }
    };

    const handleTurnComplete = () => {
      if (appMode === 'transcribe' && lastUserTextRef.current) {
        addTurn({ 
           role: 'user', 
           text: lastUserTextRef.current, 
           isFinal: true 
        });
        setTranscriptionSegments([]);
        lastUserTextRef.current = null;
      }
      
      const currentTurns = useLogStore.getState().turns;
      const last = currentTurns[currentTurns.length - 1];
      
      if (last && last.role === 'agent') {
        if (supabaseEnabled && last.text) {
          logToSupabase({
            session_id: sessionId,
            user_text: "Neural Transcription Mode",
            agent_text: last.text,
            language: template
          });
        }

        if (currentAudioChunks.current.length > 0) {
          const totalLength = currentAudioChunks.current.reduce((acc, curr) => acc + curr.length, 0);
          const audioData = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of currentAudioChunks.current) {
            audioData.set(chunk, offset);
            offset += chunk.length;
          }
          updateLastTurn({ audioData, isFinal: true });
          currentAudioChunks.current = [];
        } else if (!last.isFinal) {
          updateLastTurn({ isFinal: true });
        }
      }
      
      if (appMode === 'transcribe') lastUserTextRef.current = null;
    };

    const onAudio = (data: ArrayBuffer) => {
      currentAudioChunks.current.push(new Uint8Array(data));
    };

    client.on('content', handleContent);
    client.on('outputTranscription', handleOutputTranscription);
    client.on('inputTranscription', handleInputTranscription);
    client.on('toolcall', handleToolCall);
    client.on('turncomplete', handleTurnComplete);
    client.on('audio', onAudio);

    return () => {
      client.off('content', handleContent);
      client.off('outputTranscription', handleOutputTranscription);
      client.off('inputTranscription', handleInputTranscription);
      client.off('toolcall', handleToolCall);
      client.off('turncomplete', handleTurnComplete);
      client.off('audio', onAudio);
    };
  }, [client, sessionId, supabaseEnabled, template, addTurn, updateLastTurn, translation, appMode]);

  const lastAgentTurn = [...turns].reverse().find(t => t.role === 'agent' && t.audioData);

  const transcriptionText = transcriptionSegments.join(' ');
  const primaryDisplayText = appMode === 'transcribe' ? transcriptionText : translation;
  const secondaryDisplayText = appMode === 'transcribe' ? translation : transcriptionText;

  // Visualizer logic
  const currentVolume = appMode === 'transcribe' ? inputVolume : outputVolume;
  const isAiVisualizer = appMode === 'translate';

  return (
    <div className="streaming-console-v3">
      <section className="console-box live-stage-box">
        <header className="box-header">
          <div className="header-group">
            <span className="material-symbols-outlined box-icon">stream</span>
            <h3>{appMode === 'transcribe' ? 'Neural Transcription' : 'Live Stage'}</h3>
          </div>
          <div className="header-status-group">
            {appMode === 'transcribe' && (
              <div className="silent-badge">
                <span className="material-symbols-outlined">volume_off</span>
                <span>Silent Mode</span>
              </div>
            )}
            {isRemoteInput && (
              <div className="remote-badge">
                <span className="material-symbols-outlined">hub</span>
                <span>Remote Bridge</span>
              </div>
            )}
          </div>
        </header>
        
        <div className="box-content live-content-wrapper">
          <div className={`active-pulse-container ${isAiSpeaking ? 'ai-active' : connected ? 'listening' : ''}`}>
             <div className="pulse-aura" />
             <AudioVisualizer volume={currentVolume} isAi={isAiVisualizer} connected={connected} />
             <span className="material-symbols-outlined live-icon">
                {isAiSpeaking ? 'graphic_eq' : connected ? 'mic' : 'bolt'}
             </span>
          </div>

          <div className="live-text-area">
             <div className={cn("live-transcription", { visible: !!secondaryDisplayText })}>
                {secondaryDisplayText}
             </div>
             <div className={cn("live-result", { 
                visible: !!primaryDisplayText || connected, 
                "transcribe-mode": appMode === 'transcribe' 
             })}>
                {primaryDisplayText || (connected ? (secondaryDisplayText ? "" : "Neural engine ready...") : "System standby")}
             </div>
          </div>

          <div className="live-meta-controls">
            {connected && (
              <div className="meta-pills">
                <div className={cn("meta-pill", { active: !!detectedLanguage })}>
                  <span className="material-symbols-outlined">{detectedLanguage ? 'language' : 'sync'}</span>
                  <span>{detectedLanguage || 'Detecting Language...'}</span>
                </div>
                
                <button 
                  className={cn("meta-pill-toggle", { active: voiceFocus })}
                  onClick={() => setVoiceFocus(!voiceFocus)}
                  title="Neural Sensitivity / Voice Focus"
                >
                  <span className="material-symbols-outlined">{voiceFocus ? 'center_focus_strong' : 'center_focus_weak'}</span>
                  <span>Focus {voiceFocus ? 'ON' : 'OFF'}</span>
                </button>
              </div>
            )}
            {lastAgentTurn?.audioData && appMode !== 'transcribe' && <PlaybackControls audioData={lastAgentTurn.audioData} />}
          </div>
        </div>
      </section>

      <section className="console-box history-box">
        <header className="box-header">
          <div className="header-group">
            <span className="material-symbols-outlined box-icon">history</span>
            <h3>Session History</h3>
          </div>
        </header>

        <div className="box-content archive-scroll" ref={scrollRef}>
          <div className="archive-list">
            {turns.length === 0 ? (
              <div className="archive-empty">Verbatim transcription log will appear here...</div>
            ) : (
              turns.map((turn, i) => (
                <div key={i} className={cn("archive-turn", turn.role)}>
                  <div className="turn-header">
                    <span className="role-badge">{turn.role === 'agent' ? 'AI' : 'YOU'}</span>
                    <span className="turn-time">{turn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                  <div className="turn-content">{turn.text}</div>
                  {turn.role === 'agent' && turn.audioData && appMode !== 'transcribe' && (
                    <PlaybackControls audioData={turn.audioData} />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
