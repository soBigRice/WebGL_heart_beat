uniform float uTime;
uniform float uPointSize;
uniform float uPulseEnabled;
uniform float uBeatStartedAt;
uniform float uBeatDuration;
uniform float uBeatStrength;
uniform vec3 uRippleOrigins[8];
uniform vec3 uRippleNormals[8];
uniform float uRippleStartTimes[8];
uniform float uRippleDuration;
uniform float uRippleAmplitude;
uniform float uRippleSpeed;
uniform float uRippleWidth;
uniform float uRippleFrequency;
uniform float uRippleActives[8];

attribute float aPulseWeight;
attribute float aPhaseOffset;

varying float vRippleMask;
varying float vRipplePhase;

const int RIPPLE_POOL_SIZE = 8;

void main() {
  vRippleMask = 0.0;
  vRipplePhase = 0.0;

  float beatAge = uTime - uBeatStartedAt;
  float beatWindow = step(0.0, beatAge) * (1.0 - step(uBeatDuration, beatAge));
  float beatProgress = clamp(beatAge / max(uBeatDuration, 0.0001), 0.0, 1.0);
  float firstBeat = exp(-pow((beatProgress - 0.22) / 0.16, 2.0));
  float secondBeat = exp(-pow((beatProgress - 0.54) / 0.21, 2.0)) * 0.44;
  float beatEnvelope = (firstBeat + secondBeat) * beatWindow * uPulseEnabled;

  float pulse = 1.0 + beatEnvelope * uBeatStrength * aPulseWeight * 0.22;
  vec3 transformed = position * pulse;

  float radius = length(position);
  float innerBoost = 1.0 - smoothstep(0.0, 7.6, radius);
  vec3 radialDirection = radius > 0.0001 ? normalize(position) : vec3(0.0, 1.0, 0.0);
  transformed += radialDirection * beatEnvelope * uBeatStrength * (0.02 + innerBoost * 0.26);
  transformed.y += sin(aPhaseOffset + uTime * 3.4) * 0.01 * beatEnvelope;

  float rippleMaskAccum = 0.0;
  float ripplePhaseAccum = 0.0;
  float rippleWeightAccum = 0.0;

  for (int i = 0; i < RIPPLE_POOL_SIZE; i++) {
    if (uRippleActives[i] > 0.5) {
      float rippleTime = uTime - uRippleStartTimes[i];
      if (rippleTime >= 0.0 && rippleTime <= uRippleDuration) {
        vec3 rippleNormal = normalize(uRippleNormals[i]);
        vec3 fromOrigin = position - uRippleOrigins[i];
        float radialDistance = length(fromOrigin);

        float waveFront = rippleTime * uRippleSpeed;
        float travel = radialDistance - waveFront;
        float ring = exp(-pow(travel / uRippleWidth, 2.0));
        float attenuation = 1.0 - smoothstep(uRippleDuration * 0.88, uRippleDuration, rippleTime);
        float shimmer = 0.78 + 0.22 * sin(travel * uRippleFrequency);
        float ripple = uRippleAmplitude * ring * attenuation * shimmer;

        float rippleMask = clamp(ring * attenuation, 0.0, 1.0);
        transformed += rippleNormal * ripple;
        rippleMaskAccum += rippleMask;
        ripplePhaseAccum += travel * rippleMask;
        rippleWeightAccum += rippleMask;
      }
    }
  }

  vRippleMask = clamp(rippleMaskAccum, 0.0, 1.0);
  if (rippleWeightAccum > 0.0) {
    vRipplePhase = ripplePhaseAccum / rippleWeightAccum;
  }

  vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = uPointSize;
}
