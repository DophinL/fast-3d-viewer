import type { VRM } from '@pixiv/three-vrm';
import type { Object3D } from 'three';

const avatars = new WeakMap<Object3D, VRM>();

export function registerVrmAvatar(root: Object3D, avatar: VRM): void {
  avatars.set(root, avatar);
}

export function getVrmAvatar(root: Object3D): VRM | undefined {
  return avatars.get(root);
}

export function unregisterVrmAvatar(root: Object3D): void {
  avatars.delete(root);
}
