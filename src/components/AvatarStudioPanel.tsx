import { Camera, Eye, Hand, Mic2, PersonStanding, Presentation, Smile, Sparkles } from 'lucide-react';
import { useMemo, useState, type RefObject } from 'react';
import type { AvatarMetadata, AvatarPosePreset } from '../core/types';
import type { ViewerEngine } from '../viewer/ViewerEngine';

interface AvatarStudioPanelProps {
  avatar: AvatarMetadata;
  engineRef: RefObject<ViewerEngine | null>;
  demo: boolean;
}

const expressionChoices = [
  { candidates: ['joy', 'happy'], label: 'Smile', symbol: '☺' },
  { candidates: ['fun', 'relaxed'], label: 'Bright', symbol: '✦' },
  { candidates: ['surprised', 'surprise'], label: 'Surprised', symbol: '!' },
  { candidates: ['angry'], label: 'Serious', symbol: '⌁' },
  { candidates: ['sorrow', 'sad'], label: 'Soft', symbol: '◡' },
];

const poseChoices: Array<{ id: AvatarPosePreset; label: string; icon: typeof PersonStanding }> = [
  { id: 'camera', label: 'On camera', icon: PersonStanding },
  { id: 'wave', label: 'Wave', icon: Hand },
  { id: 'present', label: 'Present', icon: Presentation },
];

export function AvatarStudioPanel({ avatar, engineRef, demo }: AvatarStudioPanelProps) {
  const [expression, setExpression] = useState<string | null>(null);
  const [pose, setPose] = useState<AvatarPosePreset>('camera');
  const [eyeContact, setEyeContact] = useState(true);
  const [autoBlink, setAutoBlink] = useState(true);
  const [idleMotion, setIdleMotion] = useState(true);
  const availableExpressions = useMemo(() => {
    const names = new Map(avatar.expressionNames.map((name) => [name.toLowerCase(), name]));
    return expressionChoices.flatMap((choice) => {
      const match = choice.candidates.map((candidate) => names.get(candidate)).find(Boolean);
      return match ? [{ ...choice, name: match }] : [];
    });
  }, [avatar.expressionNames]);

  const chooseExpression = (name: string | null) => {
    setExpression(name);
    engineRef.current?.setAvatarExpression(name);
  };

  const choosePose = (next: AvatarPosePreset) => {
    setPose(next);
    engineRef.current?.setAvatarPose(next);
    window.requestAnimationFrame(() => engineRef.current?.frameAvatar());
  };

  return (
    <aside className="avatar-studio" aria-label="Virtual host controls">
      <header>
        <div className="avatar-studio__signal" aria-hidden="true"><span /><Mic2 /></div>
        <div><small>VIRTUAL HOST PREVIEW</small><strong>{demo ? 'Meet Nova' : avatar.name}</strong></div>
        <button type="button" onClick={() => engineRef.current?.frameAvatar()}><Camera /><span>Frame host</span></button>
      </header>

      <section>
        <div className="avatar-studio__section-title"><Smile /><span>Expression</span></div>
        <div className="avatar-expression-grid" role="group" aria-label="Choose facial expression">
          <button type="button" className={expression === null ? 'is-active' : ''} aria-pressed={expression === null} onClick={() => chooseExpression(null)}><span>•</span><strong>Neutral</strong></button>
          {availableExpressions.map((choice) => (
            <button type="button" key={choice.name} className={expression === choice.name ? 'is-active' : ''} aria-pressed={expression === choice.name} onClick={() => chooseExpression(choice.name)}>
              <span>{choice.symbol}</span><strong>{choice.label}</strong>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="avatar-studio__section-title"><Sparkles /><span>Body language</span></div>
        <div className="avatar-pose-grid" role="group" aria-label="Choose presenter pose">
          {poseChoices.map((choice) => {
            const Icon = choice.icon;
            return <button type="button" key={choice.id} className={pose === choice.id ? 'is-active' : ''} aria-pressed={pose === choice.id} onClick={() => choosePose(choice.id)}><Icon /><span>{choice.label}</span></button>;
          })}
        </div>
      </section>

      <section className="avatar-behavior-list">
        <label><span><Eye /><span><strong>Eye contact</strong><small>Follow the viewer camera</small></span></span><input type="checkbox" checked={eyeContact} onChange={(event) => { setEyeContact(event.target.checked); engineRef.current?.setAvatarLookAtCamera(event.target.checked); }} /></label>
        <label><span><span className="avatar-behavior-list__blink">◉</span><span><strong>Natural blink</strong><small>Automatic, local animation</small></span></span><input type="checkbox" checked={autoBlink} onChange={(event) => { setAutoBlink(event.target.checked); engineRef.current?.setAvatarAutoBlink(event.target.checked); }} /></label>
        <label><span><Sparkles /><span><strong>Idle motion</strong><small>Subtle breathing and head movement</small></span></span><input type="checkbox" checked={idleMotion} onChange={(event) => { setIdleMotion(event.target.checked); engineRef.current?.setAvatarIdleMotion(event.target.checked); }} /></label>
      </section>

      <footer>
        <span>Preview only · no camera or microphone</span>
        {demo && <a href="https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z" target="_blank" rel="noreferrer">Avatar by VRoid Project</a>}
      </footer>
    </aside>
  );
}
