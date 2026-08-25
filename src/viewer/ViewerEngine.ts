import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  AmbientLight,
  AnimationMixer,
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
  MeshBasicMaterial,
  MeshMatcapMaterial,
  MeshNormalMaterial,
  MeshStandardMaterial,
  NeutralToneMapping,
  NoToneMapping,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Plane,
  Points,
  Quaternion,
  Raycaster,
  Scene,
  SRGBColorSpace,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type AnimationAction,
  type AnimationClip,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  ClippingSettings,
  MeasurementKind,
  MeasurementPoint,
  MeasurementResult,
  ModelAnnotation,
  RendererTelemetry,
  ViewerInteractionMode,
  ViewerSettings,
} from '../core/types';
import { DEFAULT_VIEWER_SETTINGS } from '../core/settings';
import { getVrmAvatar } from '../core/vrm-runtime';
import { MeasurementLayer } from './MeasurementLayer';
import type { ModelTransformState, ViewerCameraState } from '../core/view-state';

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
  private readonly measurementLayer = new MeasurementLayer();
  private readonly annotationLayer = new Group();
  private readonly annotationGeometry = new SphereGeometry(1, 14, 9);
  private readonly annotationMaterial = new MeshBasicMaterial({ color: 0x7ce7bf, depthTest: false });
  private readonly clippingPlane = new Plane(new Vector3(1, 0, 0), 0);
  private readonly resizeObserver: ResizeObserver;
  private model: Object3D | null = null;
  private originalTransform: { position: Vector3; quaternion: Quaternion; scale: Vector3 } | null = null;
  private interactionMode: ViewerInteractionMode = 'select';
  private clipping: ClippingSettings = { enabled: false, axis: 'x', position: 0.5, inverted: false };
  private mixer: AnimationMixer | null = null;
  private animationAction: AnimationAction | null = null;
  private animationPlaying = false;
  private runtimeUpdate: ((delta: number) => void) | null = null;
  private boundsHelper: Box3Helper | null = null;
  private selectionHelper: Box3Helper | null = null;
  private originalMaterials = new Map<string, Material | Material[]>();
  private pointCounts = new Map<string, number>();
  private wireframeMaterials = new Map<string, Material>();
  private readonly normalMaterial = new MeshNormalMaterial({ side: DoubleSide });
  private readonly matcapMaterial = new MeshMatcapMaterial({ color: 0xc5bdac, flatShading: false, side: DoubleSide });
  private readonly xrayMaterial = new MeshStandardMaterial({ color: 0xc0c5c2, transparent: true, opacity: 0.28, depthWrite: false, side: DoubleSide });
  private settings = { ...DEFAULT_VIEWER_SETTINGS };
  private camera: PerspectiveCamera | OrthographicCamera = this.perspective;
  private animationFrame = 0;
  private fitAnimationFrame = 0;
  private invalidated = true;
  private disposed = false;
  private forceContinuous = false;
  private frameSamples: number[] = [];
  private telemetryAt = 0;
  private lastTickAt = performance.now();
  private currentPixelRatio = 1;
  private pendingPixelRatio: number | null = null;
  private onTelemetry?: (telemetry: RendererTelemetry) => void;
  private onSelection?: (object: Object3D | null) => void;
  private onAnnotationPoint?: (point: MeasurementPoint) => void;

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
    this.renderer.localClippingEnabled = true;
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

    this.annotationLayer.name = 'Annotation overlay';
    this.scene.add(this.stage, this.grid, this.axes, this.measurementLayer.group, this.annotationLayer, this.hemisphere, this.ambient, this.keyLight, this.fillLight);
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
    this.invalidate();
  }

  setTelemetryListener(listener: (telemetry: RendererTelemetry) => void): void {
    this.onTelemetry = listener;
  }

  setSelectionListener(listener: (object: Object3D | null) => void): void {
    this.onSelection = listener;
  }

  setMeasurementListener(listener: (result: MeasurementResult | null, collected: number, required: number) => void): void {
    this.measurementLayer.setResultListener(listener);
  }

  setAnnotationPointListener(listener: (point: MeasurementPoint) => void): void {
    this.onAnnotationPoint = listener;
  }

  setModel(root: Object3D, animations: AnimationClip[] = []): void {
    this.clearModel();
    this.model = root;
    this.originalTransform = {
      position: root.position.clone(),
      quaternion: root.quaternion.clone(),
      scale: root.scale.clone(),
    };
    this.stage.add(root);
    const avatar = getVrmAvatar(root);
    this.runtimeUpdate = avatar ? (delta) => avatar.update(delta) : null;
    if (animations.length > 0) {
      this.mixer = new AnimationMixer(root);
      this.animationAction = this.mixer.clipAction(animations[0]!);
    }
    root.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.originalMaterials.set(mesh.uuid, mesh.material);
      }
      const points = child as Points;
      if (points.isPoints) {
        const count = points.geometry.getAttribute('position')?.count ?? 0;
        this.pointCounts.set(points.uuid, count);
      }
    });
    const bounds = new Box3().setFromObject(root);
    this.measurementLayer.setMarkerScale(Math.max(bounds.getSize(new Vector3()).length() * 0.008, 0.00001));
    this.fitToView(false);
    this.applySettings(this.settings);
    this.updateClippingPlane();
  }

  clearModel(): void {
    cancelAnimationFrame(this.fitAnimationFrame);
    this.fitAnimationFrame = 0;
    if (this.mixer && this.model) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.model);
    }
    this.mixer = null;
    this.animationAction = null;
    this.animationPlaying = false;
    this.runtimeUpdate = null;
    this.measurementLayer.clear();
    this.clearAnnotations();
    if (this.model) {
      this.model.traverse((child) => {
        const owner = child as MaterialOwner;
        const original = this.originalMaterials.get(owner.uuid);
        if (owner.isMesh && original) owner.material = original;
      });
      this.stage.remove(this.model);
    }
    this.wireframeMaterials.forEach((material) => material.dispose());
    this.wireframeMaterials.clear();
    this.model = null;
    this.originalTransform = null;
    this.originalMaterials.clear();
    this.pointCounts.clear();
    this.clearSelection();
    this.disposeHelper(this.boundsHelper);
    this.boundsHelper = null;
    this.forceContinuous = this.needsContinuousRendering();
    this.invalidate();
  }

  getModel(): Object3D | null {
    return this.model;
  }

  setInteractionMode(mode: ViewerInteractionMode): void {
    this.interactionMode = mode;
    this.measurementLayer.setKind(this.isMeasurementMode(mode) ? mode : null);
    this.canvas.dataset.interactionMode = mode;
    this.invalidate();
  }

  getInteractionMode(): ViewerInteractionMode {
    return this.interactionMode;
  }

  clearMeasurement(): void {
    this.measurementLayer.clear();
    this.invalidate();
  }

  setAnnotations(annotations: readonly ModelAnnotation[]): void {
    this.clearAnnotations();
    if (!this.model) return;
    const bounds = new Box3().setFromObject(this.model);
    const scale = Math.max(bounds.getSize(new Vector3()).length() * 0.011, 0.00001);
    for (const annotation of annotations) {
      const marker = new Mesh(this.annotationGeometry, this.annotationMaterial);
      marker.name = `Annotation: ${annotation.label}`;
      marker.userData.annotationId = annotation.id;
      marker.position.set(annotation.point.x, annotation.point.y, annotation.point.z);
      marker.scale.setScalar(scale);
      marker.renderOrder = 1001;
      this.annotationLayer.add(marker);
    }
    this.invalidate();
  }

  setClipping(next: Partial<ClippingSettings>): ClippingSettings {
    this.clipping = {
      ...this.clipping,
      ...next,
      position: Math.min(1, Math.max(0, next.position ?? this.clipping.position)),
    };
    this.updateClippingPlane();
    return { ...this.clipping };
  }

  getClipping(): ClippingSettings {
    return { ...this.clipping };
  }

  getCameraState(): ViewerCameraState {
    return {
      projection: this.camera === this.orthographic ? 'orthographic' : 'perspective',
      position: this.camera.position.toArray() as [number, number, number],
      target: this.controls.target.toArray() as [number, number, number],
      up: this.camera.up.toArray() as [number, number, number],
      orthographicZoom: this.camera === this.orthographic ? this.orthographic.zoom : undefined,
    };
  }

  applyCameraState(state: ViewerCameraState): void {
    this.setProjection(state.projection);
    this.camera.position.fromArray(state.position);
    this.camera.up.fromArray(state.up);
    this.controls.target.fromArray(state.target);
    if (this.camera === this.orthographic && state.orthographicZoom) {
      this.orthographic.zoom = state.orthographicZoom;
      this.orthographic.updateProjectionMatrix();
    }
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    this.invalidate();
  }

  getModelTransform(): ModelTransformState | null {
    if (!this.model) return null;
    return {
      position: this.model.position.toArray() as [number, number, number],
      quaternion: this.model.quaternion.toArray() as [number, number, number, number],
      scale: this.model.scale.toArray() as [number, number, number],
    };
  }

  applyModelTransform(state: ModelTransformState): void {
    if (!this.model) return;
    this.model.position.fromArray(state.position);
    this.model.quaternion.fromArray(state.quaternion);
    this.model.scale.fromArray(state.scale);
    this.model.updateMatrixWorld(true);
    this.refreshModelOverlays();
  }

  rotateModel(axis: 'x' | 'y' | 'z', degrees: number): void {
    if (!this.model || !Number.isFinite(degrees)) return;
    const box = new Box3().setFromObject(this.model);
    const center = box.getCenter(new Vector3());
    const direction = axis === 'x' ? new Vector3(1, 0, 0) : axis === 'y' ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
    const rotation = new Quaternion().setFromAxisAngle(direction, degrees * Math.PI / 180);
    this.model.position.sub(center).applyQuaternion(rotation).add(center);
    this.model.quaternion.premultiply(rotation);
    this.model.updateMatrixWorld(true);
    this.refreshModelOverlays();
  }

  placeModelOnGround(): void {
    if (!this.model) return;
    const box = new Box3().setFromObject(this.model);
    if (box.isEmpty()) return;
    this.model.position.y -= box.min.y;
    this.model.updateMatrixWorld(true);
    this.refreshModelOverlays();
  }

  resetModelTransform(): void {
    if (!this.model || !this.originalTransform) return;
    this.model.position.copy(this.originalTransform.position);
    this.model.quaternion.copy(this.originalTransform.quaternion);
    this.model.scale.copy(this.originalTransform.scale);
    this.model.updateMatrixWorld(true);
    this.refreshModelOverlays();
    this.fitToView(true);
  }

  applySettings(next: Partial<ViewerSettings>): void {
    this.settings = { ...this.settings, ...next };
    this.grid.visible = this.settings.showGrid;
    this.axes.visible = this.settings.showAxes;
    this.controls.autoRotate = this.settings.autoRotate;
    this.controls.autoRotateSpeed = this.settings.autoRotateSpeed;
    this.forceContinuous = this.needsContinuousRendering();
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

  toggleAnimation(): boolean {
    if (!this.mixer || !this.animationAction) return false;
    this.animationPlaying = !this.animationPlaying;
    if (this.animationPlaying) {
      if (!this.animationAction.isRunning()) this.animationAction.play();
      this.mixer.timeScale = 1;
    } else {
      this.mixer.timeScale = 0;
    }
    this.forceContinuous = this.needsContinuousRendering();
    this.invalidate();
    return this.animationPlaying;
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
    if (this.camera === this.orthographic) {
      this.fitToView(false);
      return;
    }
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
    if (this.camera === this.orthographic) {
      const aspect = Math.max(this.container.clientWidth / Math.max(this.container.clientHeight, 1), 0.01);
      const halfHeight = sphereSize * 0.59;
      this.orthographic.left = -halfHeight * aspect;
      this.orthographic.right = halfHeight * aspect;
      this.orthographic.top = halfHeight;
      this.orthographic.bottom = -halfHeight;
      this.orthographic.zoom = 1;
      this.orthographic.updateProjectionMatrix();
    }
    cancelAnimationFrame(this.fitAnimationFrame);
    this.fitAnimationFrame = 0;
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
        if (t < 1) this.fitAnimationFrame = requestAnimationFrame(move);
        else this.fitAnimationFrame = 0;
      };
      this.fitAnimationFrame = requestAnimationFrame(move);
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
    const cssPixels = Math.max(this.container.clientWidth * this.container.clientHeight, 1);
    const pixelBudgetRatio = Math.sqrt(16_000_000 / cssPixels);
    const snapshotRatio = Math.max(0.5, Math.min(oldRatio * scale, 3, pixelBudgetRatio));
    try {
      this.renderer.setPixelRatio(snapshotRatio);
      this.renderer.setClearAlpha(transparent ? 0 : 1);
      this.renderer.render(this.scene, this.camera);
      return this.canvas.toDataURL('image/png');
    } finally {
      this.renderer.setPixelRatio(oldRatio);
      this.renderer.setClearAlpha(oldAlpha ? 0 : 1);
      this.resize();
    }
  }

  private getWireframeMaterial(material: Material): Material {
    let wireframe = this.wireframeMaterials.get(material.uuid);
    if (!wireframe) {
      wireframe = material.clone() as Material & { wireframe?: boolean };
      (wireframe as Material & { wireframe?: boolean }).wireframe = true;
      this.wireframeMaterials.set(material.uuid, wireframe);
    }
    return wireframe;
  }

  private applyRenderMode(): void {
    if (!this.model) return;
    this.model.traverse((child) => {
      const owner = child as MaterialOwner;
      if (!owner.isMesh || !owner.material) return;
      const original = this.originalMaterials.get(owner.uuid) ?? owner.material;
      if (this.settings.renderMode === 'material') {
        owner.material = original;
      } else if (this.settings.renderMode === 'wireframe') {
        owner.material = Array.isArray(original)
          ? original.map((material) => this.getWireframeMaterial(material))
          : this.getWireframeMaterial(original);
      } else if (this.settings.renderMode === 'normals') {
        owner.material = this.normalMaterial;
      } else if (this.settings.renderMode === 'matcap') {
        owner.material = this.matcapMaterial;
      } else {
        owner.material = this.xrayMaterial;
      }
    });
  }

  private updateBoundsHelper(): void {
    this.disposeHelper(this.boundsHelper);
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

  private refreshModelOverlays(): void {
    if (!this.model) return;
    const box = new Box3().setFromObject(this.model);
    this.updateGround(box);
    this.updateBoundsHelper();
    this.updateClippingPlane();
    this.measurementLayer.clear();
    this.clearAnnotations();
    this.invalidate();
  }

  private updateClippingPlane(): void {
    if (!this.model || !this.clipping.enabled) {
      this.renderer.clippingPlanes = [];
      this.invalidate();
      return;
    }
    const box = new Box3().setFromObject(this.model);
    if (box.isEmpty()) return;
    const { axis, position, inverted } = this.clipping;
    const minimum = box.min[axis];
    const maximum = box.max[axis];
    const coordinate = minimum + (maximum - minimum) * position;
    const normal = axis === 'x' ? new Vector3(1, 0, 0) : axis === 'y' ? new Vector3(0, 1, 0) : new Vector3(0, 0, 1);
    if (inverted) normal.negate();
    const point = new Vector3();
    point[axis] = coordinate;
    this.clippingPlane.setFromNormalAndCoplanarPoint(normal, point);
    this.renderer.clippingPlanes = [this.clippingPlane];
    this.invalidate();
  }

  private clearAnnotations(): void {
    this.annotationLayer.clear();
    this.invalidate();
  }

  private isMeasurementMode(mode: ViewerInteractionMode): mode is MeasurementKind {
    return mode === 'distance' || mode === 'angle' || mode === 'radius';
  }

  private clearSelection(): void {
    this.disposeHelper(this.selectionHelper);
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
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.model, true)[0];
    if (hit && this.isMeasurementMode(this.interactionMode)) {
      this.measurementLayer.addPoint(hit.point);
      this.invalidate();
      return;
    }
    if (hit && this.interactionMode === 'annotate') {
      this.onAnnotationPoint?.({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
      this.invalidate();
      return;
    }
    this.select(hit?.object ?? null);
  };

  private disposeHelper(helper: Box3Helper | null): void {
    if (!helper) return;
    this.scene.remove(helper);
    helper.geometry.dispose();
    for (const material of Array.isArray(helper.material) ? helper.material : [helper.material]) material.dispose();
  }

  private applyPointBudget(interacting: boolean): void {
    if (!this.model) return;
    const interactiveBudget = 250_000;
    this.model.traverse((child) => {
      const points = child as Points;
      if (!points.isPoints) return;
      const total = this.pointCounts.get(points.uuid) ?? points.geometry.getAttribute('position')?.count ?? 0;
      points.geometry.setDrawRange(0, interacting && this.settings.adaptiveQuality ? Math.min(total, interactiveBudget) : total);
    });
  }

  private handleDoubleClick = (): void => this.fitToView(true);
  private handleControlStart = (): void => {
    this.forceContinuous = true;
    this.applyPointBudget(true);
    this.invalidate();
  };
  private handleControlEnd = (): void => {
    this.forceContinuous = this.needsContinuousRendering();
    this.applyPointBudget(false);
    this.invalidate();
  };
  private handleContextLost = (event: Event): void => { event.preventDefault(); this.forceContinuous = false; };
  private handleContextRestored = (): void => { this.applySettings(this.settings); this.invalidate(); };

  private needsContinuousRendering(): boolean {
    return this.settings.autoRotate || this.animationPlaying || Boolean(this.runtimeUpdate);
  }

  private resizeViewport = (): void => {
    const width = Math.max(this.container.clientWidth, 1);
    const height = Math.max(this.container.clientHeight, 1);
    this.renderer.setSize(width, height, false);
    this.perspective.aspect = width / height;
    this.perspective.updateProjectionMatrix();
    const orthoHeight = Math.max(this.orthographic.top - this.orthographic.bottom, 0.01);
    this.orthographic.left = -(orthoHeight * width / height) / 2;
    this.orthographic.right = (orthoHeight * width / height) / 2;
    this.orthographic.updateProjectionMatrix();
  };

  private resize = (): void => {
    this.resizeViewport();
    this.invalidate();
  };

  private invalidate = (): void => {
    this.invalidated = true;
    if (!this.animationFrame && !this.disposed) {
      this.animationFrame = requestAnimationFrame(this.tick);
    }
  };

  private tick = (): void => {
    this.animationFrame = 0;
    if (this.disposed) return;
    const now = performance.now();
    const delta = Math.min((now - this.lastTickAt) / 1000, 0.1);
    this.lastTickAt = now;
    if (this.forceContinuous) {
      this.controls.update(delta);
      if (this.animationPlaying && this.mixer) this.mixer.update(delta);
      this.runtimeUpdate?.(delta);
      this.invalidated = true;
    }
    if (this.invalidated) {
      if (this.pendingPixelRatio !== null) {
        this.currentPixelRatio = this.pendingPixelRatio;
        this.pendingPixelRatio = null;
        this.renderer.setPixelRatio(this.currentPixelRatio);
        this.resizeViewport();
      }
      this.renderer.render(this.scene, this.camera);
      const frameTime = delta * 1000;
      this.invalidated = false;
      if (this.forceContinuous) {
        this.frameSamples.push(frameTime);
        if (this.frameSamples.length > 60) this.frameSamples.shift();
        this.updateAdaptiveQuality(frameTime);
      }
      if (performance.now() - this.telemetryAt > 500) this.emitTelemetry();
    }
    if (this.forceContinuous) this.invalidate();
  };

  private updateAdaptiveQuality(frameTime: number): void {
    if (!this.settings.adaptiveQuality || this.frameSamples.length < 30) return;
    const average = this.frameSamples.reduce((sum, sample) => sum + sample, 0) / this.frameSamples.length;
    const maximum = Math.min(window.devicePixelRatio, 2);
    let next = this.currentPixelRatio;
    if (average > 20 || frameTime > 35) next = Math.max(0.75, this.currentPixelRatio - 0.15);
    else if (average < 10 && this.frameSamples.length >= 60) next = Math.min(maximum, this.currentPixelRatio + 0.05);
    if (Math.abs(next - this.currentPixelRatio) >= 0.04) {
      this.pendingPixelRatio = next;
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
    cancelAnimationFrame(this.fitAnimationFrame);
    this.clearModel();
    this.disposeHelper(this.boundsHelper);
    this.boundsHelper = null;
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.normalMaterial.dispose();
    this.matcapMaterial.dispose();
    this.xrayMaterial.dispose();
    this.annotationMaterial.dispose();
    this.annotationGeometry.dispose();
    this.measurementLayer.dispose();
    this.renderer.dispose();
  }
}
