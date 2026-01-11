
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { useSettings } from '../lib/state';
import cn from 'classnames';

export default function Header() {
  const { appMode, setAppMode } = useSettings();

  return (
    <header className="header-glass sticky-header header-minimal">
      <div className="header-mode-switcher">
        <button 
          className={cn("header-mode-btn", { active: appMode === 'translate' })}
          onClick={() => setAppMode('translate')}
        >
          <span className="material-symbols-outlined">translate</span>
          <span className="btn-label">Translate</span>
        </button>
        <button 
          className={cn("header-mode-btn", { active: appMode === 'transcribe' })}
          onClick={() => setAppMode('transcribe')}
        >
          <span className="material-symbols-outlined">description</span>
          <span className="btn-label">Transcribe</span>
        </button>
        <div className={cn("header-mode-indicator", appMode)} />
      </div>
    </header>
  );
}
