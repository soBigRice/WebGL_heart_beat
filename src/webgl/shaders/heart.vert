uniform float uTime;
uniform float uPointSize;
uniform float uPulseEnabled;
uniform vec3 uRippleOrigin;
uniform vec3 uRippleNormal;
uniform float uRippleStartTime;
uniform float uRippleDuration;
uniform float uRippleAmplitude;
uniform float uRippleSpeed;
uniform float uRippleWidth;
uniform float uRippleFrequency;
uniform float uRippleActive;

attribute float aPulseWeight;
attribute float aPhaseOffset;

varying float vRippleMask;
varying float vRipplePhase;

void main() {
  vRippleMask = 0.0;
  vRipplePhase = 0.0;

  float cycle = mod(uTime * 1.18, 1.0);
  float firstBeat = exp(-pow((cycle - 0.08) / 0.058, 2.0)) * 0.16;
  float secondBeat = exp(-pow((cycle - 0.28) / 0.086, 2.0)) * 0.10;
  float pulse = 1.0 + (firstBeat + secondBeat) * aPulseWeight * uPulseEnabled;

  vec3 transformed = position * pulse;
  transformed.y += sin(uTime * 2.6 + aPhaseOffset * 1.25) * 0.03 * uPulseEnabled;
  transformed.x += cos(uTime * 1.9 + aPhaseOffset) * 0.012 * uPulseEnabled;

  if (uRippleActive > 0.5) {
    float rippleTime = uTime - uRippleStartTime;
    if (rippleTime >= 0.0 && rippleTime <= uRippleDuration) {
      vec3 rippleNormal = normalize(uRippleNormal);
      vec3 fromOrigin = position - uRippleOrigin;
      float normalDistance = dot(fromOrigin, rippleNormal);
      vec3 tangentOffset = fromOrigin - rippleNormal * normalDistance;
      float radialDistance = length(tangentOffset);

      float waveFront = rippleTime * uRippleSpeed;
      float travel = radialDistance - waveFront;
      float ring = exp(-pow(travel / uRippleWidth, 2.0));
      float thickness = exp(-pow(normalDistance / (uRippleWidth * 2.4), 2.0));
      float attenuation = 1.0 - smoothstep(uRippleDuration * 0.62, uRippleDuration, rippleTime);
      float shimmer = 0.78 + 0.22 * sin(travel * uRippleFrequency);
      float ripple = uRippleAmplitude * ring * thickness * attenuation * shimmer;

      transformed += rippleNormal * ripple;
      vRippleMask = clamp(ring * thickness * attenuation, 0.0, 1.0);
      vRipplePhase = travel;
    }
  }

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPointSize;
}
