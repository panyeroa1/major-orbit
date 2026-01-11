
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenAILiveClient } from '../../lib/genai-live-client';
import { LiveConnectConfig, Modality, LiveServerToolCall } from '@google/genai';
import { AudioStreamer } from '../../lib/audio-streamer';
import { audioContext } from '../../lib/utils';
import VolMeterWorket from '../../lib/worklets/vol-meter';
import { useSettings } from '../../lib/state';
import { wsService } from '../../lib/websocket-service';

export type UseLiveApiResults = {
  client: GenAILiveClient;
  setConfig: (config: LiveConnectConfig) => void;
  config: LiveConnectConfig;
  connect: () => Promise<void>;
  disconnect: () => void;
  connected: boolean;
  isAiSpeaking: boolean;
  volume: number;
};

export function useLiveApi({
  apiKey,
}: {
  apiKey: string;
}): UseLiveApiResults {
  const { model, appMode } = useSettings();
  
  const client = useMemo(() => {
    return new GenAILiveClient(apiKey, model);
  }, [apiKey, model]);

  const audioStreamerRef = useRef<AudioStreamer | null>(null);
  const appModeRef = useRef(appMode);
  
  useEffect(() => {
    appModeRef.current = appMode;
  }, [appMode]);

  const [volume, setVolume] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [config, setConfig] = useState<LiveConnectConfig>({
    inputAudioTranscription: {},
  });

  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx: AudioContext) => {
        const streamer = new AudioStreamer(audioCtx);
        audioStreamerRef.current = streamer;
        streamer.onPlay = () => setIsAiSpeaking(true);
        streamer.onStop = () => setIsAiSpeaking(false);

        streamer.addWorklet<any>('vumeter-out', VolMeterWorket, (ev: any) => {
          setVolume(ev.data.volume);
        }).catch(console.error);
      });
    }
  }, []);

  useEffect(() => {
    const onOpen = () => setConnected(true);
    const onClose = () => setConnected(false);
    const onError = () => setConnected(false);
    
    const onAudio = (data: ArrayBuffer) => {
      // Logic for "TURN OF READ aloud in the transcription"
      if (appModeRef.current === 'transcribe') return;
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data));
      }
    };

    const onToolCall = (toolCall: LiveServerToolCall) => {
      const functionResponses: any[] = [];
      for (const fc of toolCall.functionCalls) {
        if (fc.name === 'broadcast_to_websocket') {
          const text = (fc.args as any).text;
          wsService.sendPrompt(text);
          functionResponses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
        } else {
          functionResponses.push({ id: fc.id, name: fc.name, response: { result: 'ok' } });
        }
      }
      client.sendToolResponse({ functionResponses });
    };

    client.on('open', onOpen);
    client.on('close', onClose);
    client.on('error', onError);
    client.on('audio', onAudio);
    client.on('toolcall', onToolCall);

    return () => {
      client.off('open', onOpen);
      client.off('close', onClose);
      client.off('error', onError);
      client.off('audio', onAudio);
      client.off('toolcall', onToolCall);
    };
  }, [client]);

  const connect = useCallback(async () => {
    if (connected) return;
    return client.connect(config).then(() => {});
  }, [client, config, connected]);

  const disconnect = useCallback(() => {
    client.disconnect();
    setConnected(false);
  }, [client]);

  return { client, config, setConfig, connect, connected, disconnect, isAiSpeaking, volume };
}
