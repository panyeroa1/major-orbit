
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {
  GoogleGenAI,
  LiveConnectConfig,
  LiveServerMessage,
  LiveClientToolResponse,
} from '@google/genai';
import EventEmitter from 'eventemitter3';

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * GenAILiveClient wraps the Gemini Live API session and provides an event-driven interface
 * for handling audio, transcriptions, and tool calls.
 */
export class GenAILiveClient {
  private sessionPromise: any = null;
  private session: any = null;
  private model: string;
  private apiKey: string;
  private emitter = new EventEmitter();

  public on = this.emitter.on.bind(this.emitter);
  public off = this.emitter.off.bind(this.emitter);

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async connect(config: LiveConnectConfig): Promise<boolean> {
    if (this.session) return true;
    
    const ai = new GoogleGenAI({ apiKey: this.apiKey });
    
    try {
      this.sessionPromise = ai.live.connect({
        model: this.model,
        config: config,
        callbacks: {
          onopen: () => {
            this.emitter.emit('open');
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent) {
              this.emitter.emit('content', message.serverContent);
              
              const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64EncodedAudioString) {
                const audioBytes = decode(base64EncodedAudioString);
                this.emitter.emit('audio', audioBytes.buffer);
              }

              if (message.serverContent.inputTranscription) {
                this.emitter.emit('inputTranscription', message.serverContent.inputTranscription.text);
              }
              if (message.serverContent.outputTranscription) {
                this.emitter.emit('outputTranscription', message.serverContent.outputTranscription.text);
              }
              if (message.serverContent.turnComplete) {
                this.emitter.emit('turncomplete');
              }
              if (message.serverContent.interrupted) {
                this.emitter.emit('interrupted');
              }
            }

            if (message.toolCall) {
              this.emitter.emit('toolcall', message.toolCall);
            }
          },
          onerror: (error: any) => {
            console.error('GenAILiveClient: Socket error', error);
            this.emitter.emit('error', error);
          },
          onclose: () => {
            this.emitter.emit('close');
            this.session = null;
            this.sessionPromise = null;
          },
        },
      });

      this.session = await this.sessionPromise;
      return true;
    } catch (e) {
      this.session = null;
      this.sessionPromise = null;
      console.debug('GenAILiveClient: Connection failed.', e);
      return false;
    }
  }

  disconnect() {
    if (this.session) {
      try {
        this.session.close();
      } catch (e) {}
      this.session = null;
      this.sessionPromise = null;
    }
  }

  sendRealtimeInput(chunks: any[]) {
    if (this.sessionPromise) {
      this.sessionPromise.then((session: any) => {
        for (const chunk of chunks) {
          session.sendRealtimeInput({ media: chunk });
        }
      });
    }
  }

  send(parts: any[], turnComplete: boolean) {
    if (this.sessionPromise) {
      this.sessionPromise.then((session: any) => {
        session.sendRealtimeInput({
          clientContent: {
            turns: [{ parts }],
            turnComplete,
          },
        });
      });
    }
  }

  sendToolResponse(toolResponse: LiveClientToolResponse) {
    if (this.sessionPromise) {
      this.sessionPromise.then((session: any) => {
        session.sendToolResponse(toolResponse);
      });
    }
  }
}
