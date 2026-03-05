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
  uBeatStartedAt: THREE.IUniform<number>;
  uBeatDuration: THREE.IUniform<number>;
  uBeatStrength: THREE.IUniform<number>;
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

// 粒子编队状态：心形悬浮 -> 下落中 -> 平面静止 -> 回升中。
type FormationState = "heart" | "falling" | "ground" | "rising";

export class ThreeScene {
  // 心形整体尺寸（越大越占屏）。
  private static readonly HEART_SCALE = 4.8;
  // 心形纵向拉伸倍率（>1 更修长，<1 更扁平）。
  private static readonly HEART_Y_STRETCH = 1.08;
  // OrbitControls 缩放限制（相机到目标点距离，单位与场景一致）。
  private static readonly CAMERA_MIN_DISTANCE = 6.2;
  private static readonly CAMERA_MAX_DISTANCE = 16.8;
  // 同时可存在的波纹数量上限；连续点击密集时可调大。
  private static readonly RIPPLE_POOL_SIZE = 8;
  // 断开后延迟触发下落，避免瞬间断连导致视觉频繁闪变。
  private static readonly IDLE_FALL_DELAY_SEC = 5.5;
  // 下落/回升的整体时长与错峰时长（每个粒子按随机延迟开始）。
  private static readonly FALL_DURATION_SEC = 1.26;
  private static readonly FALL_STAGGER_SEC = 2.8;
  private static readonly RISE_DURATION_SEC = 1.12;
  private static readonly RISE_STAGGER_SEC = 1.46;
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
  // 初始节律估计（单位秒，0.86s 约等于 70 BPM），用于首包数据前的调度。
  private estimatedIntervalSec = 0.86;
  // 上一次原始间隔值，用于与当前样本做平滑。
  private previousIntervalSec: number | null = null;
  // 单次心跳动画持续时间（秒），会随心率动态更新。
  private beatDurationSec = 0.34;
  // 单次心跳形变强度，会随心率动态更新。
  private beatStrength = 0.9;
  // 下一次自动触发心跳的计划时间点。
  private nextBeatAtSec: number | null = null;
  private lastBeatAtSec: number | null = null;
  // 是否已收到过真实心率样本，决定是否启用连续心跳调度。
  private hasLiveRate = false;
  // 位置缓存：base 为心形目标，ground 为平面目标，from/to 用于当前过渡插值。
  private basePositions?: Float32Array;
  private groundPositions?: Float32Array;
  private transitionFromPositions?: Float32Array;
  private transitionToPositions?: Float32Array;
  // 每个粒子的独立延迟，让粒子“一个个”落下/回升。
  private particleDelays?: Float32Array;
  private formationState: FormationState = "heart";
  // 当前编队过渡的起始时间/时长/错峰时长。
  private formationTransitionStartSec = 0;
  private formationTransitionDurationSec = 0;
  private formationTransitionStaggerSec = 0;
  // 连接状态计时：用于触发“断连一段时间后再下落”。
  private disconnectedSinceSec: number | null = null;
  private isPulseEnabled = false;

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
      alpha: true,
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
    // 粒子数量：越大越细腻，但 GPU 压力越高。
    count = 18000,
  ): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    const positions = new Float32Array(count * 3);
    const pulseWeights = new Float32Array(count);
    const phaseOffsets = new Float32Array(count);

    const scale = ThreeScene.HEART_SCALE;
    let cursor = 0;
    let attempts = 0;
    // 采样兜底，防止在较严格筛选条件下卡死循环。
    const maxAttempts = count * 50;

    while (cursor < count && attempts < maxAttempts) {
      attempts += 1;

      // 初始体素采样范围，可影响心形边界饱满程度。
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

      // 粒子受心跳影响权重，外层更明显，内层更柔和。
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

    this.initializeFormationPositions(positions);

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

    // 下面这些值是“可调视觉参数”，可以按产品风格直接改。
    const uniforms: HeartUniforms = {
      // 全局时间由 animate() 每帧更新。
      uTime: { value: 0 },
      // 粒子点大小。
      uPointSize: { value: 4.0 },
      // 基础心形颜色。
      uColor: { value: new THREE.Color(0xff0000) },
      // 波纹颜色渐变 A/B。
      uRippleColorA: { value: new THREE.Color(0x22d3ee) },
      uRippleColorB: { value: new THREE.Color(0xfef08a) },
      uOpacity: { value: 1 },
      uPulseEnabled: { value: 0 },
      uBeatStartedAt: { value: -9999 },
      // 心跳动画基线参数（运行时会被真实数据覆盖）。
      uBeatDuration: { value: 0.34 },
      uBeatStrength: { value: 0 },
      uRippleOrigins: { value: rippleOrigins },
      uRippleNormals: { value: rippleNormals },
      uRippleStartTimes: { value: rippleStartTimes },
      // 波纹传播参数：持续时长/位移幅度/传播速度/环宽/频率。
      uRippleDuration: { value: 3.6 },
      uRippleAmplitude: { value: 0.58 },
      uRippleSpeed: { value: 7.4 },
      uRippleWidth: { value: 1.45 },
      uRippleFrequency: { value: 6.8 },
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

  private initializeFormationPositions(basePositions: Float32Array): void {
    const particleCount = basePositions.length / 3;
    this.basePositions = basePositions.slice();
    this.groundPositions = new Float32Array(basePositions.length);
    this.transitionFromPositions = new Float32Array(basePositions.length);
    this.transitionToPositions = new Float32Array(basePositions.length);
    this.particleDelays = new Float32Array(particleCount);
    const base = this.basePositions;
    const ground = this.groundPositions;
    const delays = this.particleDelays;
    if (!base || !ground || !delays) {
      return;
    }

    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < particleCount; i += 1) {
      const z = base[i * 3 + 2] ?? 0;
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
      // 粒子随机延迟种子，值域 [0, 1]。
      delays[i] = Math.random();
    }

    // 平面高度略低于心形最低点，避免下落后仍与心形轮廓重叠。
    const zRange = Math.max(maxZ - minZ, 0.1);
    const planeZ = minZ - zRange * 0.12 - 0.9;
    for (let i = 0; i < particleCount; i += 1) {
      const i3 = i * 3;
      const spreadX = THREE.MathUtils.randFloatSpread(0.56);
      const spreadY = THREE.MathUtils.randFloatSpread(0.56);
      const settle = Math.random() * 0.26;
      ground[i3] = (base[i3] ?? 0) * 0.96 + spreadX;
      ground[i3 + 1] = (base[i3 + 1] ?? 0) * 0.96 + spreadY;
      ground[i3 + 2] = planeZ + settle;
    }
  }

  private getHeartPositionAttribute(): THREE.BufferAttribute | null {
    if (!this.heartParticles) {
      return null;
    }

    const attribute = this.heartParticles.geometry.getAttribute("position");
    if (!(attribute instanceof THREE.BufferAttribute)) {
      return null;
    }

    return attribute;
  }

  private startFormationTransition(
    targetState: "falling" | "rising",
    targetPositions: Float32Array,
    durationSec: number,
    staggerSec: number,
  ): void {
    const positionAttribute = this.getHeartPositionAttribute();
    if (
      !positionAttribute ||
      !this.transitionFromPositions ||
      !this.transitionToPositions
    ) {
      return;
    }

    const current = positionAttribute.array;
    if (!(current instanceof Float32Array)) {
      return;
    }
    if (current.length !== targetPositions.length) {
      return;
    }

    // 记录当前姿态与目标姿态，后续在动画循环中做逐粒子插值。
    this.transitionFromPositions.set(current);
    this.transitionToPositions.set(targetPositions);
    this.formationState = targetState;
    this.formationTransitionStartSec = this.timer.getElapsed();
    this.formationTransitionDurationSec = Math.max(durationSec, 0.01);
    this.formationTransitionStaggerSec = Math.max(staggerSec, 0);
  }

  private beginParticleFall(): void {
    if (
      !this.groundPositions ||
      this.formationState === "falling" ||
      this.formationState === "ground"
    ) {
      return;
    }

    this.startFormationTransition(
      "falling",
      this.groundPositions,
      ThreeScene.FALL_DURATION_SEC,
      ThreeScene.FALL_STAGGER_SEC,
    );
  }

  private beginParticleRise(): void {
    if (
      !this.basePositions ||
      this.formationState === "rising" ||
      this.formationState === "heart"
    ) {
      return;
    }

    this.startFormationTransition(
      "rising",
      this.basePositions,
      ThreeScene.RISE_DURATION_SEC,
      ThreeScene.RISE_STAGGER_SEC,
    );
  }

  private updateParticleFormation(elapsedSeconds: number): void {
    if (this.formationState !== "falling" && this.formationState !== "rising") {
      return;
    }

    const positionAttribute = this.getHeartPositionAttribute();
    const from = this.transitionFromPositions;
    const to = this.transitionToPositions;
    const delays = this.particleDelays;
    if (!positionAttribute || !from || !to || !delays) {
      return;
    }

    const current = positionAttribute.array;
    if (!(current instanceof Float32Array)) {
      return;
    }

    const particleCount = delays.length;
    const transitionState = this.formationState;
    const duration = this.formationTransitionDurationSec;
    const stagger = this.formationTransitionStaggerSec;
    let allFinished = true;

    for (let i = 0; i < particleCount; i += 1) {
      // 通过每个粒子的随机 delay 做错峰，形成“依次掉落/回升”的观感。
      const localStart =
        this.formationTransitionStartSec + (delays[i] ?? 0) * stagger;
      const progress = THREE.MathUtils.clamp(
        (elapsedSeconds - localStart) / duration,
        0,
        1,
      );
      if (progress < 1) {
        allFinished = false;
      }

      // 下落采用 ease-in（先慢后快），回升采用 ease-out（先快后慢）。
      const eased =
        transitionState === "falling"
          ? progress * progress
          : 1 - Math.pow(1 - progress, 3);
      const i3 = i * 3;
      const fromX = from[i3] ?? 0;
      const fromY = from[i3 + 1] ?? 0;
      const fromZ = from[i3 + 2] ?? 0;
      const toX = to[i3] ?? 0;
      const toY = to[i3 + 1] ?? 0;
      const toZ = to[i3 + 2] ?? 0;
      current[i3] = fromX + (toX - fromX) * eased;
      current[i3 + 1] = fromY + (toY - fromY) * eased;
      current[i3 + 2] = fromZ + (toZ - fromZ) * eased;
    }

    positionAttribute.needsUpdate = true;
    if (allFinished) {
      this.formationState = transitionState === "falling" ? "ground" : "heart";
    }
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
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 0, 20);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    // 禁止平移，仅允许旋转和缩放。
    this.controls.enablePan = false;
    this.controls.minDistance = ThreeScene.CAMERA_MIN_DISTANCE;
    this.controls.maxDistance = ThreeScene.CAMERA_MAX_DISTANCE;

    this.raycaster.params.Points = { threshold: 0.42 };

    this.timer.connect(document);

    this.heartParticles = this.createParticleHeart();
    this.heartParticles.frustumCulled = false;
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

    // 使用固定池做环形复用，允许连续点击叠加多圈波纹。
    const slot = this.nextRippleIndex;
    const originSlot = uniforms.uRippleOrigins.value[slot];
    const normalSlot = uniforms.uRippleNormals.value[slot];
    if (!originSlot || !normalSlot) {
      return;
    }

    originSlot.copy(origin);
    normalSlot.copy(normal);
    // 记录开始时间，由着色器按当前时间计算环形传播位置。
    uniforms.uRippleStartTimes.value[slot] = this.timer.getElapsed();
    uniforms.uRippleActives.value[slot] = 1;
    this.nextRippleIndex = (slot + 1) % ThreeScene.RIPPLE_POOL_SIZE;
  }

  private startBeat(uniforms: HeartUniforms, startedAt: number): void {
    uniforms.uBeatStartedAt.value = startedAt;
    uniforms.uBeatDuration.value = this.beatDurationSec;
    uniforms.uBeatStrength.value = this.beatStrength;
    this.lastBeatAtSec = startedAt;
    // 预排下一拍时间，后续在 animate() 中持续追帧触发。
    this.nextBeatAtSec = startedAt + this.estimatedIntervalSec;
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

      if (
        uniforms.uPulseEnabled.value > 0.5 &&
        this.hasLiveRate &&
        this.nextBeatAtSec !== null
      ) {
        // 即使浏览器卡帧，也通过 while 追赶丢失的节拍，避免节奏断裂。
        while (elapsedSeconds >= this.nextBeatAtSec) {
          this.startBeat(uniforms, this.nextBeatAtSec);
          if (
            elapsedSeconds - this.nextBeatAtSec >
            this.estimatedIntervalSec * 3
          ) {
            this.nextBeatAtSec = elapsedSeconds + this.estimatedIntervalSec;
            break;
          }
        }
      }

      if (
        !this.isPulseEnabled &&
        this.disconnectedSinceSec !== null &&
        elapsedSeconds - this.disconnectedSinceSec >=
          ThreeScene.IDLE_FALL_DELAY_SEC
      ) {
        // 断连达到阈值后才下落；已下落则 beginParticleFall 内部会直接忽略。
        this.beginParticleFall();
      }

      this.updateParticleFormation(elapsedSeconds);
    }

    this.renderer.render(this.scene, this.camera);
  };

  public setPulseEnabled(enabled: boolean): void {
    const uniforms = this.getHeartUniforms();
    if (!uniforms) {
      return;
    }

    this.isPulseEnabled = enabled;
    uniforms.uPulseEnabled.value = enabled ? 1 : 0;
    if (enabled) {
      // 重连时立即回到心形，不需要等待下一帧数据再恢复。
      this.disconnectedSinceSec = null;
      this.beginParticleRise();
      return;
    }

    // 断连时仅记录时刻，是否进入下落由动画循环按阈值判定。
    this.disconnectedSinceSec = this.timer.getElapsed();
    uniforms.uBeatStrength.value = 0;
    uniforms.uBeatStartedAt.value = -9999;
    this.hasLiveRate = false;
    this.previousIntervalSec = null;
    this.nextBeatAtSec = null;
    this.lastBeatAtSec = null;
  }

  public triggerHeartbeat(bpm: number, rrMs: number | null): void {
    const uniforms = this.getHeartUniforms();
    if (!uniforms || uniforms.uPulseEnabled.value < 0.5) {
      return;
    }

    // 优先使用 RR；没有 RR 时用 BPM 反算周期，再兜底到当前估计值。
    const rawInterval =
      rrMs && rrMs > 0
        ? rrMs / 1000
        : bpm > 0
          ? 60 / bpm
          : this.estimatedIntervalSec;
    // 节律边界约束：避免异常包导致心跳动画瞬间“爆炸”。
    const boundedInterval = THREE.MathUtils.clamp(rawInterval, 0.35, 1.6);
    const averagedInterval =
      this.previousIntervalSec !== null
        ? (this.previousIntervalSec + boundedInterval) * 0.5
        : boundedInterval;

    // 平滑系数：越大越灵敏，越小越稳定。
    this.estimatedIntervalSec = this.hasLiveRate
      ? THREE.MathUtils.lerp(this.estimatedIntervalSec, averagedInterval, 0.56)
      : averagedInterval;
    this.previousIntervalSec = boundedInterval;
    this.hasLiveRate = true;

    const derivedBpm = 60 / this.estimatedIntervalSec;
    const blendedBpm =
      bpm > 0 ? THREE.MathUtils.lerp(derivedBpm, bpm, 0.5) : derivedBpm;

    // 跟随心率动态调整时长与强度，可按视觉风格微调范围。
    this.beatDurationSec = THREE.MathUtils.clamp(
      this.estimatedIntervalSec * 0.5,
      0.2,
      0.56,
    );
    this.beatStrength = THREE.MathUtils.clamp(
      0.68 + (blendedBpm - 60) * 0.006,
      0.58,
      1.26,
    );

    const now = this.timer.getElapsed();
    if (this.nextBeatAtSec === null || this.lastBeatAtSec === null) {
      this.startBeat(uniforms, now);
      return;
    }

    const projectedNext = this.lastBeatAtSec + this.estimatedIntervalSec;
    this.nextBeatAtSec = Math.max(now + 0.05, projectedNext);
  }

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
