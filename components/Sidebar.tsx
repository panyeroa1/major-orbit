
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings, useUI, useTools, Template } from '../lib/state';
import c from 'classnames';
import { AVAILABLE_VOICES } from '../lib/constants';
import { useLiveAPIContext } from '../contexts/LiveAPIContext';
import { useMemo } from 'react';

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
  const { systemPrompt, voice, voiceFocus, supabaseEnabled, setSystemPrompt, setVoice, setVoiceFocus, setSupabaseEnabled, appMode } = useSettings();
  const { tools, template, setTemplate, toggleTool } = useTools();
  const { connected } = useLiveAPIContext();

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
        {/* Linguistic Engine Section */}
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
                  <p className="setting-desc">Primary interpretation goal</p>
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
                <p className="setting-desc">Isolate speaker from noise</p>
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
                <label className="setting-label">Supabase Logging</label>
                <p className="setting-desc">Securely sync conversation history</p>
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

        {/* Voice Persona Section */}
        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">record_voice_over</span>
            <h4>Neural Voice</h4>
          </header>
          
          <div className="settings-card">
            <div className="setting-row vertical">
              <div className="setting-info">
                <label className="setting-label">Selected Persona</label>
                <p className="setting-desc">The high-fidelity voice identity</p>
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

        {/* Neural Directives Section */}
        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">auto_fix_high</span>
            <h4>Neural Directives</h4>
          </header>
          
          <div className="settings-card">
            <div className="setting-row vertical">
              <div className="setting-info">
                <label className="setting-label">System Instructions</label>
                <p className="setting-desc">Modify baseline AI behavior</p>
              </div>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={4}
                className="setting-textarea"
                placeholder="E.g. Be more poetic, use formal honorifics..."
              />
              <p className="setting-hint">
                Neural directives shape the personality and strictness of the engine.
              </p>
            </div>
          </div>
        </div>

        {/* Active Capabilities Section */}
        <div className="sidebar-section">
          <header className="section-header">
            <span className="material-symbols-outlined">power</span>
            <h4>External Capabilities</h4>
          </header>
          
          <div className="settings-card">
            {tools.map(tool => (
              <div key={tool.name} className="setting-row">
                <div className="setting-info">
                  <label className="setting-label">{tool.name.replace(/_/g, ' ')}</label>
                  <p className="setting-desc">Enable tool integration</p>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={tool.isEnabled}
                    onChange={() => toggleTool(tool.name)}
                    disabled={connected}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            ))}
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
          <span className="version-text">v3.5.2</span>
        </div>
      </div>
    </aside>
  );
}
