import {
  Aperture,
  BoxSelect,
  Camera,
  CircleDot,
  Crosshair,
  Expand,
  Focus,
  Grid3X3,
  Pause,
  Play,
  Rotate3D,
  Scan,
  SunMedium,
} from 'lucide-react';
import type { MutableRefObject } from 'react';
import type { ViewerSettings } from '../core/types';
import type { ViewerEngine } from '../viewer/ViewerEngine';
import { IconButton } from './IconButton';

interface ViewerToolbarProps {
  engineRef: MutableRefObject<ViewerEngine | null>;
  settings: ViewerSettings;
  updateSettings: (settings: Partial<ViewerSettings>) => void;
  onSnapshot: () => void;
  onFullscreen: () => void;
  hasAnimations: boolean;
  animationPlaying: boolean;
  onToggleAnimation: () => void;
}

export function ViewerToolbar({ engineRef, settings, updateSettings, onSnapshot, onFullscreen, hasAnimations, animationPlaying, onToggleAnimation }: ViewerToolbarProps) {
  return (
    <nav className="viewer-toolbar" aria-label="Viewer controls">
      <div className="tool-group">
        <IconButton label="Frame model" icon={<Focus />} onClick={() => engineRef.current?.fitToView(true)} />
        <IconButton label="Isometric view" icon={<BoxSelect />} onClick={() => engineRef.current?.setView('iso')} />
        <div className="toolbar-menu">
          <IconButton label="Standard views" icon={<Crosshair />} />
          <div className="toolbar-menu__popover">
            {(['front', 'back', 'left', 'right', 'top', 'bottom'] as const).map((view) => (
              <button key={view} type="button" onClick={() => engineRef.current?.setView(view)}>{view}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="tool-separator" />
      <div className="tool-group">
        <IconButton label="Toggle grid" icon={<Grid3X3 />} active={settings.showGrid} onClick={() => updateSettings({ showGrid: !settings.showGrid })} />
        <IconButton label="Toggle axes" icon={<CircleDot />} active={settings.showAxes} onClick={() => updateSettings({ showAxes: !settings.showAxes })} />
        <IconButton label="Show bounds" icon={<Scan />} active={settings.showBounds} onClick={() => updateSettings({ showBounds: !settings.showBounds })} />
        <IconButton label="Auto rotate" icon={<Rotate3D />} active={settings.autoRotate} onClick={() => updateSettings({ autoRotate: !settings.autoRotate })} />
        {hasAnimations && <IconButton label={animationPlaying ? 'Pause animation' : 'Play animation'} icon={animationPlaying ? <Pause /> : <Play />} active={animationPlaying} onClick={onToggleAnimation} />}
      </div>
      <div className="tool-separator" />
      <div className="tool-group">
        <div className="toolbar-menu toolbar-menu--wide">
          <IconButton label="Rendering style" icon={<Aperture />} />
          <div className="toolbar-menu__popover">
            {(['material', 'matcap', 'normals', 'wireframe', 'xray'] as const).map((mode) => (
              <button key={mode} className={settings.renderMode === mode ? 'is-current' : ''} type="button" onClick={() => updateSettings({ renderMode: mode })}>{mode}</button>
            ))}
          </div>
        </div>
        <IconButton label="Toggle shadows" icon={<SunMedium />} active={settings.shadows} onClick={() => updateSettings({ shadows: !settings.shadows })} />
        <IconButton label="Take PNG snapshot" icon={<Camera />} onClick={onSnapshot} />
        <IconButton label="Enter fullscreen" icon={<Expand />} onClick={onFullscreen} />
      </div>
    </nav>
  );
}
