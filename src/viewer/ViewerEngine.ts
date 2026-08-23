import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  AxesHelper,
  Box3,
  Box3Helper,
  Color,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  HemisphereLight,
  LinearToneMapping,
  Mesh,
  MeshMatcapMaterial,
  MeshNormalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';
import type { RendererTelemetry, ViewerSettings } from '../core/types';

declare module 'three' {
  interface BufferGeometry {
    computeBoundsTree: typeof computeBoundsTree;
    disposeBoundsTree: typeof disposeBoundsTree;
  }
}

Mesh.prototype.raycast = acceleratedRaycast;

const DEFAULT_SETTINGS: ViewerSettings = {
  renderMode: 'material',
  background: '#dcd8cd',
  environmentIntensity: 0.8,
  keyLightIntensity: 3.2,
  exposure: 1,
  toneMapping: 'neutral',
  showGrid: true,
  showAxes: false,
  showBounds: false,
  showStats: true,
  autoRotate: false,
  autoRotateSpeed: 1.4,
  shadows: true,
  transparentBackground: false,
  adaptiveQuality: true,
};

type MaterialOwner = Object3D & { isMesh?: boolean; material?: Material | Material[] };

export class ViewerEngine {
  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new Scene();
  private readonly stage = new Group();
  private readonly perspective = new PerspectiveCamera(36, 1, 0.001, 1_000_000);
  private readonly orthographic = new OrthographicCamera(-1, 1, 1, -1, 0.001, 1_000_000);
  private readonly renderer: WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly grid = new GridHelper(10, 20, 0x68675f, 0xa7a398);
  private readonly axes = new AxesHelper(1);
  private readonly hemisphere = new HemisphereLight(0xf8f3e6, 0x5b625f, 1.6);
  private readonly ambient = new AmbientLight(0xe7e3d9, 0.4);
  private readonly keyLight = new DirectionalLight(0xfff2d2, 3.2);
  private readonly fillLight = new DirectionalLight(0xcad7dd, 1.3);
  private readonly resizeObserver: ResizeObserver;
  private model: Object3D | null = null;
  private boundsHelper: Box3Helper | null = null;
  private selectionHelper: Box3Helper | null = null;
  private originalMaterials = new Map<string, Material | Material[]>();
  private settings = { ...DEFAULT_SETTINGS };
  private camera: PerspectiveCamera | OrthographicCamera = this.perspective;
  private animationFrame = 0;
  private invalidated = true;
  private disposed = false;
  private forceContinuous = false;
  private frameSamples: number[] = [];
  private telemetryAt = 0;
  private lastTickAt = performance.now();
  private currentPixelRatio = 1;
  private onTelemetry?: (telemetry: RendererTelemetry) => void;
  private onSelection?: (object: Object3D | null) => void;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement) {
    this.container = container;
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      depth: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(this.settings.background, 1);
    this.currentPixelRatio = Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(this.currentPixelRatio);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.zoomToCursor = true;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', this.handleControlStart);
    this.controls.addEventListener('end', this.handleControlEnd);
    this.controls.addEventListener('change', this.invalidate);

    this.scene.add(this.stage, this.grid, this.axes, this.hemisphere, this.ambient, this.keyLight, this.fillLight);
    this.keyLight.position.set(5, 8, 4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.bias = -0.0001;
    this.fillLight.position.set(-4, 3, -5);
    this.grid.material.transparent = true;
    this.grid.material.opacity = 0.32;
    this.grid.position.y = 0;
    this.axes.visible = false;
    this.perspective.position.set(3.5, 2.6, 4.2);
    this.perspective.lookAt(0, 0, 0);

    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('dblclick', this.handleDoubleClick);
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    this.resize();
    this.tick();
  }

  setTelemetryListener(listener: (telemetry: RendererTelemetry) => void): void {
    this.onTelemetry = listener;
  }

  setSelectionListener(listener: (object: Object3D | null) => void): void {
    this.onSelection = listener;
  }

  setModel(root: Object3D): void {
    this.clearModel();
    this.model = root;
    this.stage.add(root);
    root.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const geometry = mesh.geometry;
      if (geometry && !geometry.boundsTree && (geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0) < 3_000_000) {
        try { geometry.computeBoundsTree(); } catch { /* Unsupported interleaved data keeps default raycast. */ }
      }
      this.originalMaterials.set(mesh.uuid, mesh.material);
    });
    this.fitToView(false);
    this.applySettings(this.settings);
  }

  clearModel(): void {
    if (this.model) this.stage.remove(this.model);
    this.model = null;
    this.originalMaterials.clear();
    this.clearSelection();
    if (this.boundsHelper) this.scene.remove(this.boundsHelper);
    this.boundsHelper = null;
    this.invalidate();
  }

  getModel(): Object3D | null {
    return this.model;
  }

  applySettings(next: Partial<ViewerSettings>): void {
    this.settings = { ...this.settings, ...next };
    this.grid.visible = this.settings.showGrid;
    this.axes.visible = this.settings.showAxes;
    this.controls.autoRotate = this.settings.autoRotate;
    this.controls.autoRotateSpeed = this.settings.autoRotateSpeed;
    this.forceContinuous = this.settings.autoRotate;
    this.renderer.shadowMap.enabled = this.settings.shadows;
    this.keyLight.intensity = this.settings.keyLightIntensity;
    this.hemisphere.intensity = 1.2 * this.settings.environmentIntensity;
    this.ambient.intensity = 0.35 * this.settings.environmentIntensity;
    this.renderer.toneMappingExposure = this.settings.exposure;
    this.renderer.toneMapping = {
      neutral: NeutralToneMapping,
      aces: ACESFilmicToneMapping,
      agx: AgXToneMapping,
      linear: LinearToneMapping,
    }[this.settings.toneMapping] ?? NoToneMapping;
    this.renderer.setClearColor(this.settings.background, this.settings.transparentBackground ? 0 : 1);
    this.applyRenderMode();
    this.updateBoundsHelper();
    this.invalidate();
  }

  getSettings(): ViewerSettings {
    return { ...this.settings };
  }

  setProjection(mode: 'perspective' | 'orthographic'): void {
    const oldCamera = this.camera;
    const direction = oldCamera.position.clone().sub(this.controls.target).normalize();
    const distance = oldCamera.position.distanceTo(this.controls.target);
    if (mode === 'perspective') {
      this.perspective.position.copy(this.controls.target).addScaledVector(direction, distance);
      this.camera = this.perspective;
    } else {
      const half = Math.max(distance * 0.35, 0.01);
      this.orthographic.left = -half;
      this.orthographic.right = half;
      this.orthographic.top = half;
      this.orthographic.bottom = -half;
      this.orthographic.position.copy(this.controls.target).addScaledVector(direction, distance);
      this.orthographic.updateProjectionMatrix();
      this.camera = this.orthographic;
    }
    this.controls.object = this.camera;
    this.camera.lookAt(this.controls.target);
    this.resize();
  }

  setView(view: 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'iso'): void {
    if (!this.model) return;
    const box = new Box3().setFromObject(this.model);
    const center = box.getCenter(new Vector3());
    const distance = Math.max(box.getSize(new Vector3()).length() * 1.4, 1);
    const directions: Record<typeof view, Vector3> = {
      front: new Vector3(0, 0, 1), back: new Vector3(0, 0, -1), left: new Vector3(-1, 0, 0),
      right: new Vector3(1, 0, 0), top: new Vector3(0, 1, 0.0001), bottom: new Vector3(0, -1, 0.0001),
      iso: new Vector3(1, 0.78, 1),
    };
    this.camera.position.copy(center).addScaledVector(directions[view].normalize(), distance);
    this.camera.up.set(0, 1, 0);
    if (view === 'top' || view === 'bottom') this.camera.up.set(0, 0, view === 'top' ? -1 : 1);
    this.controls.target.copy(center);
    this.camera.lookAt(center);
    this.controls.update();
    this.invalidate();
  }

  fitToView(animate = true): void {
    if (!this.model) return;
    const box = new Box3().setFromObject(this.model);
    if (box.isEmpty()) return;
    const center = box.getCenter(new Vector3());
    const sphereSize = Math.max(box.getSize(new Vector3()).length(), 0.001);
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    if (direction.lengthSq() < 0.1) direction.set(1, 0.75, 1).normalize();
    const distance = sphereSize / (2 * Math.tan((this.perspective.fov * Math.PI) / 360)) * 1.18;
    const destination = center.clone().addScaledVector(direction, distance);
    if (!animate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.camera.position.copy(destination);
      this.controls.target.copy(center);
    } else {
      const origin = this.camera.position.clone();
      const targetOrigin = this.controls.target.clone();
      const startedAt = performance.now();
      const move = (time: number) => {
        const t = Math.min((time - startedAt) / 420, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        this.camera.position.lerpVectors(origin, destination, eased);
        this.controls.target.lerpVectors(targetOrigin, center, eased);
        this.invalidate();
        if (t < 1) requestAnimationFrame(move);
      };
      requestAnimationFrame(move);
    }
    this.camera.near = Math.max(sphereSize / 10_000, 0.0001);
    this.camera.far = Math.max(sphereSize * 100, 1_000);
    this.camera.updateProjectionMatrix();
    this.updateGround(box);
    this.controls.update();
    this.invalidate();
  }

  resetView(): void {
    this.setView('iso');
    this.fitToView(true);
  }

  snapshot(scale = 2, transparent = false): string {
    const oldRatio = this.renderer.getPixelRatio();
    const oldAlpha = this.settings.transparentBackground;
    this.renderer.setPixelRatio(Math.min(oldRatio * scale, 4));
    this.renderer.setClearAlpha(transparent ? 0 : 1);
    this.renderer.render(this.scene, this.camera);
    const data = this.canvas.toDataURL('image/png');
    this.renderer.setPixelRatio(oldRatio);
    this.renderer.setClearAlpha(oldAlpha ? 0 : 1);
    this.resize();
    return data;
  }

  private applyRenderMode(): void {
    if (!this.model) return;
    this.model.traverse((child) => {
      const owner = child as MaterialOwner;
      if (!owner.isMesh || !owner.material) return;
      const original = this.originalMaterials.get(owner.uuid) ?? owner.material;
      if (this.settings.renderMode === 'material') {
        owner.material = original;
        for (const material of Array.isArray(owner.material) ? owner.material : [owner.material]) (material as Material & { wireframe?: boolean }).wireframe = false;
      } else if (this.settings.renderMode === 'wireframe') {
        owner.material = Array.isArray(original) ? original : original;
        for (const material of Array.isArray(owner.material) ? owner.material : [owner.material]) (material as Material & { wireframe?: boolean }).wireframe = true;
      } else if (this.settings.renderMode === 'normals') {
        owner.material = new MeshNormalMaterial({ side: DoubleSide });
      } else if (this.settings.renderMode === 'matcap') {
        owner.material = new MeshMatcapMaterial({ color: 0xc5bdac, flatShading: false, side: DoubleSide });
      } else {
        owner.material = new MeshStandardMaterial({ color: 0xc0c5c2, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide });
      }
    });
  }

  private updateBoundsHelper(): void {
    if (this.boundsHelper) this.scene.remove(this.boundsHelper);
    this.boundsHelper = null;
    if (!this.model || !this.settings.showBounds) return;
    this.boundsHelper = new Box3Helper(new Box3().setFromObject(this.model), new Color(0xc85d35));
    this.scene.add(this.boundsHelper);
  }

  private updateGround(box: Box3): void {
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const gridScale = Math.pow(10, Math.floor(Math.log10(Math.max(size.x, size.z, 0.001))));
    this.grid.scale.setScalar(gridScale);
    this.grid.position.set(center.x, box.min.y, center.z);
    this.axes.scale.setScalar(Math.max(size.length() * 0.18, 0.01));
    this.axes.position.copy(this.grid.position);
  }

  private clearSelection(): void {
    if (this.selectionHelper) this.scene.remove(this.selectionHelper);
    this.selectionHelper = null;
    this.onSelection?.(null);
  }

  private select(object: Object3D | null): void {
    this.clearSelection();
    if (!object) return;
    this.selectionHelper = new Box3Helper(new Box3().setFromObject(object), new Color(0xc85d35));
    this.scene.add(this.selectionHelper);
    this.onSelection?.(object);
    this.invalidate();
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.model || event.button !== 0 || event.altKey || event.metaKey || event.ctrlKey) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.firstHitOnly = true;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.model, true)[0];
    this.select(hit?.object ?? null);
  };

  private handleDoubleClick = (): void => this.fitToView(true);
  private handleControlStart = (): void => { this.forceContinuous = true; };
  private handleControlEnd = (): void => { this.forceContinuous = this.settings.autoRotate; };
  private handleContextLost = (event: Event): void => { event.preventDefault(); this.forceContinuous = false; };
  private handleContextRestored = (): void => { this.applySettings(this.settings); this.invalidate(); };

  private resize = (): void => {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.perspective.aspect = width / height;
    this.perspective.updateProjectionMatrix();
    const orthoHeight = Math.max(this.orthographic.top - this.orthographic.bottom, 0.01);
    this.orthographic.left = -(orthoHeight * width / height) / 2;
    this.orthographic.right = (orthoHeight * width / height) / 2;
    this.orthographic.updateProjectionMatrix();
    this.invalidate();
  };

  private invalidate = (): void => { this.invalidated = true; };

  private tick = (): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.tick);
    const now = performance.now();
    const delta = Math.min((now - this.lastTickAt) / 1000, 0.1);
    this.lastTickAt = now;
    if (this.forceContinuous) {
      this.controls.update(delta);
      this.invalidated = true;
    }
    if (!this.invalidated) return;
    const start = performance.now();
    this.renderer.render(this.scene, this.camera);
    const frameTime = performance.now() - start;
    this.invalidated = false;
    this.frameSamples.push(frameTime);
    if (this.frameSamples.length > 60) this.frameSamples.shift();
    this.updateAdaptiveQuality(frameTime);
    if (performance.now() - this.telemetryAt > 500) this.emitTelemetry();
  };

  private updateAdaptiveQuality(frameTime: number): void {
    if (!this.settings.adaptiveQuality || this.frameSamples.length < 30) return;
    const average = this.frameSamples.reduce((sum, sample) => sum + sample, 0) / this.frameSamples.length;
    const maximum = Math.min(window.devicePixelRatio, 2);
    let next = this.currentPixelRatio;
    if (average > 20 || frameTime > 35) next = Math.max(0.75, this.currentPixelRatio - 0.15);
    else if (average < 10 && this.frameSamples.length >= 60) next = Math.min(maximum, this.currentPixelRatio + 0.05);
    if (Math.abs(next - this.currentPixelRatio) >= 0.04) {
      this.currentPixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }

  private emitTelemetry(): void {
    this.telemetryAt = performance.now();
    const frameTimeMs = this.frameSamples.length
      ? this.frameSamples.reduce((sum, sample) => sum + sample, 0) / this.frameSamples.length
      : 0;
    const gl = this.renderer.getContext();
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'WebGL renderer';
    this.onTelemetry?.({
      fps: frameTimeMs > 0 ? Math.min(999, 1000 / frameTimeMs) : 0,
      frameTimeMs,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      pixelRatio: this.currentPixelRatio,
      renderer,
      webglVersion: this.renderer.capabilities.isWebGL2 ? 'WebGL 2' : 'WebGL 1',
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.renderer.dispose();
  }
}
