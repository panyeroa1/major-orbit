
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import cn from 'classnames';
import React, { memo, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useUI, useSettings, useTools } from '../../../lib/state';
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';
import { wsService } from '../../../lib/websocket-service';

const MiniVisualizer = memo(({ volume, active, color = 'accent' }: { volume: number; active: boolean; color?: 'accent' | 'success' }) => {
  const bars = 4;
  // Threshold to avoid jitter in visualizer
  if (!active || volume < 0.005) return null;

  return (
    <div className={cn("mini-viz", color)}>
      {Array.from({ length: bars }).map((_, i) => (
        <div 
          key={i} 
          className="mini-bar" 
          style={{ 
            height: `${Math.max(2, volume * 55 * (0.65 + Math.random() * 0.35))}px`,
            transition: 'height 0.04s ease-out'
          }} 
        />
      ))}
    </div>
  );
});

function ControlTray() {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const [chatValue, setChatValue] = useState('');
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect, isAiSpeaking, setInputVolume, inputVolume, outputVolume } = useLiveAPIContext();
  const { toggleSidebar, isSidebarOpen } = useUI();
  const { voiceFocus, setVoiceFocus, appMode } = useSettings();
  const { template } = useTools();

  // Mode-based Mute logic
  // In Translate mode, we usually want to start muted or handle it carefully to avoid echo loops
  useEffect(() => {
    if (appMode === 'translate') {
      setMuted(true); 
    } else {
      setMuted(false); 
    }
  }, [appMode]);

  useEffect(() => {
    if (!connected) {
      setMuted(appMode === 'translate');
    }
  }, [connected, appMode]);

  // Audio Data & Volume Bridging
  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([{
        mimeType: 'audio/pcm;rate=16000',
        data: base64,
      }]);
    };

    const onVolume = (v: number) => {
      if (connected && !muted) {
        setInputVolume(v);
      } else {
        setInputVolume(0);
      }
    };

    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.on('volume', onVolume);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
      setInputVolume(0);
    }
    return () => {
      audioRecorder.off('data', onData);
      audioRecorder.off('volume', onVolume);
    };
  }, [connected, client, muted, audioRecorder, setInputVolume]);

  const handleMicClick = () => {
    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const handleSendMessage = () => {
    const text = chatValue.trim();
    if (!text) return;
    const sendPayload = { type: 'chat', text, mode: template, timestamp: Date.now() };
    if (connected) {
      client.send([{ text }], true);
      wsService.sendPrompt(sendPayload);
      setChatValue('');
    } else {
      connect().then(() => {
        client.send([{ text }], true);
        wsService.sendPrompt(sendPayload);
        setChatValue('');
      }).catch(console.error);
    }
  };

  const getToggleIcon = () => {
    if (appMode === 'translate') {
      return muted || !connected ? 'volume_off' : 'volume_up';
    }
    return muted || !connected ? 'mic_off' : 'mic';
  };

  // Only show Speaker Visualizer when:
  // 1. In Translate mode
  // 2. AI is actually speaking (isAiSpeaking)
  // 3. System is connected
  const showSpeakerViz = connected && isAiSpeaking && appMode === 'translate';

  // Only show Mic Visualizer when:
  // 1. In Transcribe mode
  // 2. Mic is NOT muted
  // 3. System is connected
  const showMicViz = connected && !muted && appMode === 'transcribe';

  return (
    <section className="control-tray-floating">
      <div className="control-tray-content">
        {appMode !== 'transcribe' && (
          <div className="chat-composer-floating">
            <input
              type="text"
              className="chat-composer-input"
              placeholder={connected ? "Type to translate..." : "Connect to start..."}
              value={chatValue}
              onChange={(e) => setChatValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button className="send-message-btn" onClick={handleSendMessage} disabled={!chatValue.trim()}>
              <span className="material-symbols-outlined">send</span>
            </button>
          </div>
        )}

        <div className={cn('floating-pill', { 'focus-active': connected })}>
          <button className={cn('icon-button', { active: isSidebarOpen })} onClick={toggleSidebar}>
            <span className="material-symbols-outlined">settings</span>
          </button>

          <button className={cn('icon-button', { active: voiceFocus })} onClick={() => setVoiceFocus(!voiceFocus)}>
            <span className="material-symbols-outlined">
              {voiceFocus ? 'center_focus_strong' : 'center_focus_weak'}
            </span>
          </button>

          <button 
            className={cn('icon-button relative-btn', { 
              active: !muted && connected, 
              muted: muted && connected,
              'speaking-pulse': showSpeakerViz 
            })} 
            onClick={handleMicClick}
          >
            {/* INPUT VIZ: Mic activity in Transcribe mode */}
            <MiniVisualizer volume={inputVolume} active={showMicViz} color="success" />
            
            {/* OUTPUT VIZ: Speaker activity in Translate mode */}
            <MiniVisualizer volume={outputVolume} active={showSpeakerViz} color="accent" />
            
            <span className={cn('material-symbols-outlined', { 'filled': !muted && connected })}>
              {getToggleIcon()}
            </span>
          </button>

          <button className={cn('icon-button main-action', { connected })} onClick={connected ? disconnect : connect}>
            <span className="material-symbols-outlined filled">
              {connected ? 'stop' : 'play_arrow'}
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);
