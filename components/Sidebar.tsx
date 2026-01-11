
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings, useUI, useTools, Template } from '../lib/state';
import c from 'classnames';
import { AVAILABLE_VOICES } from '../lib/constants';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useMemo, useState } from 'react';

const LANGUAGE_LABELS: Record<Template, string> = {
  'dutch': 'Dutch (Netherlands)',
  'dutch_flemish': 'Dutch (Flemish)',
  'dutch_brabantian': 'Dutch (Brabantian)',
  'dutch_limburgish': 'Dutch (Limburgish)',
  'west_flemish': 'Dutch (West Flemish)',
  'dutch_surinamese': 'Dutch (Surinamese)',
  'afrikaans': 'Afrikaans',
  'frisian': 'West Frisian',
  'medumba': 'Medumba (Cameroon)',
  'bamum': 'Bamum',
  'ewondo': 'Ewondo',
  'duala': 'Duala',
  'basaa': 'Basaa',
  'bulu': 'Bulu',
  'fulfulde_cameroon': 'Fulfulde (Cameroon)',
  'cameroonian_pidgin': 'Cameroonian Pidgin',
  'french_ivory_coast': 'French (Ivory Coast)',
  'baoule': 'Baoulé',
  'dioula': 'Dioula',
  'bete': 'Bété',
  'taglish': 'Taglish (Tagalog-English)',
  'tagalog': 'Tagalog (Formal)',
  'cebuano': 'Cebuano (Bisaya)',
  'ilocano': 'Ilocano',
  'hiligaynon': 'Hiligaynon (Ilonggo)',
  'waray': 'Waray',
  'kapampangan': 'Kapampangan',
  'bikol': 'Bikol',
  'pangasinan': 'Pangasinan',
  'chavacano': 'Chavacano',
  'english': 'English (International)',
  'french': 'French (France)',
  'french_belgium': 'French (Belgium)',
  'german': 'German',
  'spanish': 'Spanish (Neutral)',
  'spanish_mexican': 'Spanish (Mexico)',
  'spanish_argentinian': 'Spanish (Argentina)',
  'italian': 'Italian',
  'portuguese': 'Portuguese (Brazil)',
  'russian': 'Russian',
  'polish': 'Polish',
  'ukrainian': 'Ukrainian',
  'swedish': 'Swedish',
  'norwegian': 'Norwegian',
  'danish': 'Danish',
  'finnish': 'Finnish',
  'greek': 'Greek',
  'czech': 'Czech',
  'hungarian': 'Hungarian',
  'romanian': 'Romanian',
  'turkish': 'Turkish',
  'japanese': 'Japanese',
  'korean': 'Korean',
  'mandarin': 'Chinese (Mandarin)',
  'cantonese': 'Chinese (Cantonese)',
  'hokkien': 'Chinese (Hokkien)',
  'hindi': 'Hindi',
  'bengali': 'Bengali',
  'punjabi': 'Punjabi',
  'marathi': 'Marathi',
  'tamil': 'Tamil',
  'telugu': 'Telugu',
  'urdu': 'Urdu',
  'arabic': 'Arabic (Standard)',
  'arabic_egyptian': 'Arabic (Egyptian)',
  'arabic_levantine': 'Arabic (Levantine)',
  'arabic_gulf': 'Arabic (Gulf)',
  'persian': 'Persian (Farsi)',
  'hebrew': 'Hebrew',
  'vietnamese': 'Vietnamese',
  'thai': 'Thai',
  'indonesian': 'Indonesian',
  'malay': 'Malay',
  'swahili': 'Swahili',
  'amharic': 'Amharic',
  'yoruba': 'Yoruba',
  'igbo': 'Igbo',
  'hausa': 'Hausa',
  'twi': 'Twi',
  'wolof': 'Wolof',
  'zulu': 'Zulu',
  'xhosa': 'Xhosa',
};

const VOICE_ALIASES: Record<string, string> = {
  'Zephyr': 'King Aeolus',
  'Puck': 'King Pan',
  'Charon': 'King Hades',
  'Kore': 'Queen Persephone',
  'Luna': 'Queen Selene',
  'Nova': 'Queen Asteria',
  'Fenrir': 'King Lycaon',
  'Leda': 'Queen Leda',
  'Orus': 'King Horus',
  'Aoede': 'Queen Aoede',
  'Callirrhoe': 'Queen Callirrhoe',
  'Autonoe': 'Queen Autonoe',
  'Enceladus': 'King Enceladus',
  'Iapetus': 'King Iapetus',
  'Umbriel': 'King Erebus',
  'Algieba': 'King Leonidas',
  'Despina': 'Queen Despina',
  'Erinome': 'Queen Erinome',
  'Algenib': 'King Bellerophon',
  'Rasalgethi': 'King Heracles',
  'Laomedeia': 'Queen Laomedeia',
  'Achernar': 'King Eridanos',
  'Alnilam': 'King Orion',
  'Schedar': 'Queen Cassiopeia',
  'Gacrux': 'King Acrux',
  'Pulcherrima': 'Queen Izar',
  'Achird': 'King Cepheus',
  'Zubenelgenubi': 'King Kiffa',
  'Vindemiatrix': 'Queen Virgo',
  'Sadachbia': 'King Aquarius',
  'Sadaltager': 'King Sadaltager',
  'Sulafat': 'Queen Lyra'
};

const getVoiceAlias = (voiceId: string) => VOICE_ALIASES[voiceId] || `Persona ${voiceId}`;

export default function Sidebar() {
  const { isSidebarOpen, toggleSidebar } = useUI();
  const { systemPrompt, voice, voiceFocus, supabaseEnabled, meetingId, setSystemPrompt, setVoice, setVoiceFocus, setSupabaseEnabled, setMeetingId, appMode } = useSettings();
  const { tools, template, setTemplate, toggleTool } = useTools();
  const { connected } = useLiveAPIContext();
  
  const [copied, setCopied] = useState(false);

  const sortedVoices = useMemo(() => {
    return AVAILABLE_VOICES.map(v => ({
      id: v,
      alias: getVoiceAlias(v)
    })).sort((a, b) => a.alias.localeCompare(b.alias));
  }, []);

  const sortedLanguages = useMemo(() => {
    return (Object.keys(LANGUAGE_LABELS) as Template[])
      .sort((a, b) => LANGUAGE_LABELS[a].localeCompare(LANGUAGE_LABELS[b]));
  }, []);

  const handleGenerateMeetingId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setMeetingId(id);
  };

  const handleCopyMeetingId = () => {
    if (!meetingId) return;
    navigator.clipboard.writeText(meetingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClearId = () => {
    setMeetingId('');
  };

  return (
    <aside className={c('sidebar', { open: isSidebarOpen })}>
      <div className="sidebar-header">
        <div className="sidebar-title-group">
          <span className="material-symbols-outlined sidebar-icon">settings</span>
          <h3>Control Center</h3>
        </div>
        <button onClick={toggleSidebar} className="sidebar-close-btn" aria-label="Close">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">hub</span>
            <h4>Session Binding</h4>
          </header>
          
          <div className="settings-card">
            {appMode === 'transcribe' ? (
              <div className="setting-row vertical">
                <div className="setting-info">
                  <label className="setting-label">Meeting Host ID</label>
                  <p className="setting-desc">Broadcasting transcriptions via WebSocket</p>
                </div>
                <div className="meeting-id-controls">
                  <div className="meeting-id-display">
                    {meetingId || 'NO ID GENERATED'}
                  </div>
                  <div className="meeting-id-actions">
                    <button className="id-btn" onClick={handleGenerateMeetingId} title="Generate New ID">
                      <span className="material-symbols-outlined">refresh</span>
                    </button>
                    <button className="id-btn" onClick={handleCopyMeetingId} disabled={!meetingId} title="Copy ID">
                      <span className="material-symbols-outlined">{copied ? 'check' : 'content_copy'}</span>
                    </button>
                    <button className="id-btn danger" onClick={handleClearId} disabled={!meetingId} title="End Session">
                      <span className="material-symbols-outlined">power_settings_new</span>
                    </button>
                  </div>
                </div>
                <p className="setting-hint">Persistent until session is ended.</p>
              </div>
            ) : (
              <div className="setting-row vertical">
                <div className="setting-info">
                  <label className="setting-label">Fetch Transcription ID</label>
                  <p className="setting-desc">Enter Host ID to fetch correct transcription via WebSocket</p>
                </div>
                <div className="meeting-id-controls">
                  <input 
                    type="text" 
                    className="meeting-id-input" 
                    placeholder="ENTER HOST ID"
                    value={meetingId}
                    onChange={(e) => setMeetingId(e.target.value.toUpperCase())}
                  />
                  {meetingId && (
                    <button className="id-btn danger" onClick={handleClearId} title="Leave Session">
                      <span className="material-symbols-outlined">logout</span>
                    </button>
                  )}
                </div>
                <p className="setting-hint">Bound sessions stream remote text into the page live.</p>
              </div>
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">translate</span>
            <h4>Engine Configuration</h4>
          </header>
          
          <div className="settings-card">
            {appMode === 'translate' && (
              <div className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">Target Language</label>
                  <p className="setting-desc">Interpretation Goal</p>
                </div>
                <select 
                  value={template} 
                  onChange={e => setTemplate(e.target.value as Template)} 
                  className="setting-select"
                  disabled={connected}
                >
                  {sortedLanguages.map(key => (
                    <option key={key} value={key}>
                      {LANGUAGE_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="setting-row">
              <div className="setting-info">
                <label className="setting-label">Voice Focus</label>
                <p className="setting-desc">Speaker Isolation</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={voiceFocus}
                  onChange={(e) => setVoiceFocus(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>

            <div className="setting-row">
              <div className="setting-info">
                <label className="setting-label">Supabase Sync</label>
                <p className="setting-desc">History Logging</p>
              </div>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={supabaseEnabled}
                  onChange={(e) => setSupabaseEnabled(e.target.checked)}
                />
                <span className="slider round"></span>
              </label>
            </div>
          </div>
        </div>

        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">record_voice_over</span>
            <h4>Neural Voice</h4>
          </header>
          
          <div className="settings-card">
            <div className="setting-row vertical">
              <div className="setting-info">
                <label className="setting-label">Active Persona</label>
              </div>
              <select 
                value={voice} 
                onChange={e => setVoice(e.target.value)} 
                className="setting-select full-width"
                disabled={connected}
              >
                {sortedVoices.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.alias}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div className="sidebar-footer">
        <div className="footer-status">
          <div className="status-label-group">
            <div className={c('status-light', { connected })} />
            <span className="status-indicator">
              {connected ? 'CONNECTED' : 'STANDBY'}
            </span>
          </div>
          <div className="status-meeting">
            {meetingId ? `BINDED: ${meetingId}` : 'ISOLATED'}
          </div>
          <span className="version-text">v3.5.3 [EBURON.AI]</span>
        </div>
      </div>
    </aside>
  );
}
