import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export class ThreeScene {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private heartParticles?: THREE.Points<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  private readonly timer = new THREE.Timer();
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

    const scale = 4.8;
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
      const py = y * scale * 1.08;
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

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPointSize: { value: 2.6 },
        uColor: { value: new THREE.Color(0xff0000) },
        uOpacity: { value: 1 },
        uPulseEnabled: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uPointSize;
        uniform float uPulseEnabled;

        attribute float aPulseWeight;
        attribute float aPhaseOffset;

        void main() {
          float cycle = mod(uTime * 1.18, 1.0);
          float firstBeat = exp(-pow((cycle - 0.08) / 0.058, 2.0)) * 0.16;
          float secondBeat = exp(-pow((cycle - 0.28) / 0.086, 2.0)) * 0.10;
          float pulse = 1.0 + (firstBeat + secondBeat) * aPulseWeight * uPulseEnabled;

          vec3 transformed = position * pulse;
          transformed.y += sin(uTime * 2.6 + aPhaseOffset * 1.25) * 0.03 * uPulseEnabled;
          transformed.x += cos(uTime * 1.9 + aPhaseOffset) * 0.012 * uPulseEnabled;

          vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = uPointSize;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;

        void main() {
          vec2 centered = gl_PointCoord - vec2(0.5);
          float dist = length(centered);
          float alpha = smoothstep(0.5, 0.42, dist) * uOpacity;
          if (alpha <= 0.0) discard;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    return new THREE.Points(geometry, material);
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

    this.timer.connect(document);

    this.heartParticles = this.createParticleHeart();
    this.heartParticles.rotation.set(-Math.PI / 2, 0, 0);
    this.scene.add(this.heartParticles);

    window.addEventListener("resize", this.onWindowResize);
  }

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
    if (this.heartParticles) {
      const timeUniform = this.heartParticles.material.uniforms.uTime;
      if (timeUniform) {
        timeUniform.value = elapsedSeconds;
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
