import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import heartVertexShader from "./shaders/heart.vert";
import heartFragmentShader from "./shaders/heart.frag";

type HeartUniforms = {
  uTime: THREE.IUniform<number>;
  uPointSize: THREE.IUniform<number>;
  uColor: THREE.IUniform<THREE.Color>;
  uRippleColorA: THREE.IUniform<THREE.Color>;
  uRippleColorB: THREE.IUniform<THREE.Color>;
  uOpacity: THREE.IUniform<number>;
  uPulseEnabled: THREE.IUniform<number>;
  uRippleOrigins: THREE.IUniform<THREE.Vector3[]>;
  uRippleNormals: THREE.IUniform<THREE.Vector3[]>;
  uRippleStartTimes: THREE.IUniform<number[]>;
  uRippleDuration: THREE.IUniform<number>;
  uRippleAmplitude: THREE.IUniform<number>;
  uRippleSpeed: THREE.IUniform<number>;
  uRippleWidth: THREE.IUniform<number>;
  uRippleFrequency: THREE.IUniform<number>;
  uRippleActives: THREE.IUniform<number[]>;
};

export class ThreeScene {
  private static readonly HEART_SCALE = 4.8;
  private static readonly HEART_Y_STRETCH = 1.08;
  private static readonly RIPPLE_POOL_SIZE = 8;
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private heartParticles?: THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private readonly timer = new THREE.Timer();
  private nextRippleIndex = 0;
  private animationFrameId?: number;

  constructor(container: HTMLElement) {
    if (!container) {
      throw new Error(
        "A container element is required for the Three.js scene.",
      );
    }

    this.container = container;
    this.scene = new THREE.Scene();
    // this.scene.background = new THREE.Color(0xf8fafc);
    this.camera = new THREE.PerspectiveCamera(
      55,
      this.container.clientWidth / this.container.clientHeight,
      0.1,
      100,
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    this.init();
    this.animate();
  }

  // 3D 心形隐式方程（0 等值面），用于生成纯粒子爱心：
  // (x^2 + 9/4 y^2 + z^2 - 1)^3 - x^2 z^3 - 9/80 y^2 z^3 = 0
  private heartImplicit(x: number, y: number, z: number): number {
    const a = x * x + (9 / 4) * y * y + z * z - 1;
    return a * a * a - x * x * z * z * z - (9 / 80) * y * y * z * z * z;
  }

  private createParticleHeart(
    count = 18000,
  ): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const positions = new Float32Array(count * 3);
    const pulseWeights = new Float32Array(count);
    const phaseOffsets = new Float32Array(count);

    const scale = ThreeScene.HEART_SCALE;
    let cursor = 0;
    let attempts = 0;
    const maxAttempts = count * 50;

    while (cursor < count && attempts < maxAttempts) {
      attempts += 1;

      const x = THREE.MathUtils.randFloatSpread(2.4);
      const y = THREE.MathUtils.randFloatSpread(2.2);
      const z = THREE.MathUtils.randFloatSpread(2.4);
      const implicit = this.heartImplicit(x, y, z);
      if (implicit > 0) {
        continue;
      }

      // 让粒子更偏向心形外壳，形体更清晰。
      const shellFactor = Math.exp(-Math.abs(implicit) * 12);
      if (Math.random() > 0.2 + shellFactor * 0.8) {
        continue;
      }

      const i3 = cursor * 3;
      const px = x * scale;
      const py = y * scale * ThreeScene.HEART_Y_STRETCH;
      const pz = z * scale;
      positions[i3] = px;
      positions[i3 + 1] = py;
      positions[i3 + 2] = pz;

      pulseWeights[cursor] = 0.58 + shellFactor * 0.62;
      phaseOffsets[cursor] = Math.random() * Math.PI * 2;
      cursor += 1;
    }

    // 极端情况下样本不足时，用中心点补齐，保证缓冲区完整。
    for (let i = cursor; i < count; i += 1) {
      const i3 = i * 3;
      positions[i3] = 0;
      positions[i3 + 1] = 0;
      positions[i3 + 2] = 0;
      pulseWeights[i] = 0.8;
      phaseOffsets[i] = Math.random() * Math.PI * 2;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute(
      "aPulseWeight",
      new THREE.BufferAttribute(pulseWeights, 1),
    );
    geometry.setAttribute(
      "aPhaseOffset",
      new THREE.BufferAttribute(phaseOffsets, 1),
    );

    const rippleOrigins = Array.from(
      { length: ThreeScene.RIPPLE_POOL_SIZE },
      () => new THREE.Vector3(),
    );
    const rippleNormals = Array.from(
      { length: ThreeScene.RIPPLE_POOL_SIZE },
      () => new THREE.Vector3(0, 1, 0),
    );
    const rippleStartTimes = Array.from(
      { length: ThreeScene.RIPPLE_POOL_SIZE },
      () => -9999,
    );
    const rippleActives = Array.from(
      { length: ThreeScene.RIPPLE_POOL_SIZE },
      () => 0,
    );

    const uniforms: HeartUniforms = {
      uTime: { value: 0 },
      uPointSize: { value: 2.6 },
      uColor: { value: new THREE.Color(0xff0000) },
      uRippleColorA: { value: new THREE.Color(0x22d3ee) },
      uRippleColorB: { value: new THREE.Color(0xfef08a) },
      uOpacity: { value: 1 },
      uPulseEnabled: { value: 0 },
      uRippleOrigins: { value: rippleOrigins },
      uRippleNormals: { value: rippleNormals },
      uRippleStartTimes: { value: rippleStartTimes },
      uRippleDuration: { value: 2.25 },
      uRippleAmplitude: { value: 0.65 },
      uRippleSpeed: { value: 5.2 },
      uRippleWidth: { value: 1.2 },
      uRippleFrequency: { value: 7.5 },
      uRippleActives: { value: rippleActives },
    };

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      vertexShader: heartVertexShader,
      fragmentShader: heartFragmentShader,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    return new THREE.Points(geometry, material);
  }

  private getHeartUniforms(): HeartUniforms | null {
    if (!this.heartParticles) {
      return null;
    }

    return this.heartParticles.material.uniforms as unknown as HeartUniforms;
  }

  private init(): void {
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 20);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 14;

    this.raycaster.params.Points = { threshold: 0.42 };

    this.timer.connect(document);

    this.heartParticles = this.createParticleHeart();
    this.heartParticles.rotation.set(-Math.PI / 2, 0, 0);
    this.scene.add(this.heartParticles);

    this.renderer.domElement.addEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    window.addEventListener("resize", this.onWindowResize);
  }

  private computeHeartNormal(localPoint: THREE.Vector3): THREE.Vector3 {
    const scaleX = ThreeScene.HEART_SCALE;
    const scaleY = ThreeScene.HEART_SCALE * ThreeScene.HEART_Y_STRETCH;
    const scaleZ = ThreeScene.HEART_SCALE;

    const x = localPoint.x / scaleX;
    const y = localPoint.y / scaleY;
    const z = localPoint.z / scaleZ;

    const a = x * x + (9 / 4) * y * y + z * z - 1;
    const a2 = a * a;
    const z2 = z * z;
    const z3 = z2 * z;

    const dFx = 6 * x * a2 - 2 * x * z3;
    const dFy = (27 / 2) * y * a2 - (9 / 40) * y * z3;
    const dFz = 6 * z * a2 - 3 * x * x * z2 - (27 / 80) * y * y * z2;

    const normal = new THREE.Vector3(dFx / scaleX, dFy / scaleY, dFz / scaleZ);
    if (normal.lengthSq() < 1e-8) {
      normal.copy(localPoint);
    }
    if (normal.lengthSq() < 1e-8) {
      normal.set(0, 1, 0);
    }

    return normal.normalize();
  }

  private triggerRipple(origin: THREE.Vector3, normal: THREE.Vector3): void {
    const uniforms = this.getHeartUniforms();
    if (!uniforms) {
      return;
    }

    const slot = this.nextRippleIndex;
    const originSlot = uniforms.uRippleOrigins.value[slot];
    const normalSlot = uniforms.uRippleNormals.value[slot];
    if (!originSlot || !normalSlot) {
      return;
    }

    originSlot.copy(origin);
    normalSlot.copy(normal);
    uniforms.uRippleStartTimes.value[slot] = this.timer.getElapsed();
    uniforms.uRippleActives.value[slot] = 1;
    this.nextRippleIndex = (slot + 1) % ThreeScene.RIPPLE_POOL_SIZE;
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !this.heartParticles) {
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObject(this.heartParticles, false);
    const [firstHit] = hits;
    if (!firstHit) {
      return;
    }

    const hitPointLocal = this.heartParticles.worldToLocal(
      firstHit.point.clone(),
    );
    const hitNormalLocal = this.computeHeartNormal(hitPointLocal);
    this.triggerRipple(hitPointLocal, hitNormalLocal);
  };

  private onWindowResize = (): void => {
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
  };

  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);
    this.timer.update();
    this.controls.update();

    const elapsedSeconds = this.timer.getElapsed();
    const uniforms = this.getHeartUniforms();
    if (uniforms) {
      uniforms.uTime.value = elapsedSeconds;

      for (let i = 0; i < ThreeScene.RIPPLE_POOL_SIZE; i += 1) {
        const isActive = uniforms.uRippleActives.value[i] ?? 0;
        const startedAt = uniforms.uRippleStartTimes.value[i] ?? -9999;
        if (
          isActive > 0.5 &&
          elapsedSeconds - startedAt > uniforms.uRippleDuration.value
        ) {
          uniforms.uRippleActives.value[i] = 0;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  public addObject(object: THREE.Object3D): void {
    this.scene.add(object);
  }

  public destroy(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener("resize", this.onWindowResize);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.onPointerDown,
    );
    this.timer.dispose();
    this.controls.dispose();

    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.Points)) {
        return;
      }

      if (object.geometry) {
        object.geometry.dispose();
      }
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
        return;
      }

      if (object.material) {
        object.material.dispose();
      }
    });

    this.scene.clear();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
