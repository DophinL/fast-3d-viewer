import { ChevronDown, ChevronRight, Eye, EyeOff, Shapes } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import type { Object3D } from 'three';

const MAX_VISIBLE_CHILDREN = 250;

function SceneNode({ object, depth, onChange }: { object: Object3D; depth: number; onChange: (object: Object3D, visible: boolean) => void }) {
  const [expanded, setExpanded] = useState(depth < 1);
  const children = object.children.filter((child) => child.type !== 'Bone');
  const visibleChildren = children.slice(0, MAX_VISIBLE_CHILDREN);
  const hasChildren = children.length > 0;
  return (
    <li>
      <div className="scene-node" style={{ '--depth': depth } as CSSProperties}>
        <button type="button" className="scene-node__expand" disabled={!hasChildren} aria-label={expanded ? 'Collapse object' : 'Expand object'} onClick={() => setExpanded((value) => !value)}>
          {hasChildren ? expanded ? <ChevronDown /> : <ChevronRight /> : <span />}
        </button>
        <Shapes className="scene-node__kind" />
        <span title={object.name || object.type}>{object.name || object.type}</span>
        <button type="button" className="scene-node__visibility" aria-label={object.visible ? `Hide ${object.name || object.type}` : `Show ${object.name || object.type}`} onClick={() => onChange(object, !object.visible)}>
          {object.visible ? <Eye /> : <EyeOff />}
        </button>
      </div>
      {hasChildren && expanded && (
        <ul>
          {visibleChildren.map((child) => <SceneNode key={child.uuid} object={child} depth={depth + 1} onChange={onChange} />)}
          {children.length > MAX_VISIBLE_CHILDREN && <li className="scene-tree__limit">{children.length - MAX_VISIBLE_CHILDREN} more objects hidden at this level</li>}
        </ul>
      )}
    </li>
  );
}

export function SceneTree({ root, onChange }: { root: Object3D; onChange: (object: Object3D, visible: boolean) => void }) {
  const top = useMemo(() => root.children.length === 1 && root.children[0] ? root.children[0] : root, [root]);
  return <ul className="scene-tree"><SceneNode object={top} depth={0} onChange={onChange} /></ul>;
}
