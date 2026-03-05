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
