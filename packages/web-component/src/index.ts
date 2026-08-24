import { Modern3DViewer, type LoadedAsset, type LoadProgress } from '@fast-3d-viewer/core';

export class Modern3DViewerElement extends HTMLElement {
  static observedAttributes = ['src', 'background', 'grid', 'shadows'];
  private readonly mount: HTMLDivElement;
  private viewer: Modern3DViewer | null = null;
  private abort: AbortController | null = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-height: 320px; position: relative; contain: layout paint; }
      .mount { inset: 0; overflow: hidden; position: absolute; }
      canvas { display: block; height: 100%; width: 100%; }
    `;
    this.mount = document.createElement('div');
    this.mount.className = 'mount';
    shadow.append(style, this.mount);
  }

  connectedCallback(): void {
    if (this.viewer) return;
    this.viewer = new Modern3DViewer(this.mount, { settings: this.readSettings() });
    this.viewer.on('progress', (detail) => this.dispatch<LoadProgress>('viewer-progress', detail));
    this.viewer.on('load', (detail) => this.dispatch<LoadedAsset>('viewer-load', detail));
    this.viewer.on('error', (detail) => this.dispatch<Error>('viewer-error', detail));
    void this.loadSource();
  }

  disconnectedCallback(): void {
    this.abort?.abort();
    this.abort = null;
    this.viewer?.dispose();
    this.viewer = null;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (!this.viewer || oldValue === newValue) return;
    if (name === 'src') void this.loadSource();
    else this.viewer.setSettings(this.readSettings());
  }

  get src(): string { return this.getAttribute('src') ?? ''; }
  set src(value: string) { if (value) this.setAttribute('src', value); else this.removeAttribute('src'); }

  async openFiles(files: Iterable<File>): Promise<LoadedAsset> {
    if (!this.viewer) throw new Error('The web component is not connected.');
    return this.viewer.openFiles(files);
  }

  fitToView(animate = true): void { this.viewer?.fitToView(animate); }
  snapshot(scale = 2, transparent = false): string | null { return this.viewer?.snapshot(scale, transparent) ?? null; }

  private readSettings() {
    return {
      background: this.getAttribute('background') || '#101317',
      showGrid: this.getAttribute('grid') !== 'false',
      shadows: this.getAttribute('shadows') !== 'false',
    };
  }

  private async loadSource(): Promise<void> {
    if (!this.viewer || !this.src) return;
    this.abort?.abort();
    this.abort = new AbortController();
    try {
      await this.viewer.openUrl(this.src, this.abort.signal);
    } catch (reason) {
      // Modern3DViewer already exposes non-abort failures through viewer-error.
      // Attribute changes are fire-and-forget, so do not create an unhandled rejection.
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
    }
  }

  private dispatch<T>(name: string, detail: T): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

export function defineModern3DViewer(tagName = 'modern-3d-viewer'): void {
  if (!customElements.get(tagName)) customElements.define(tagName, Modern3DViewerElement);
}

defineModern3DViewer();
