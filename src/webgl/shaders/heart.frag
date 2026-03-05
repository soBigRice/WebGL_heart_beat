uniform vec3 uColor;
uniform vec3 uRippleColorA;
uniform vec3 uRippleColorB;
uniform float uOpacity;
uniform float uTime;

varying float vRippleMask;
varying float vRipplePhase;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float dist = length(centered);
  float alpha = smoothstep(0.5, 0.42, dist) * uOpacity;
  if (alpha <= 0.0) discard;

  float rippleColorMix = 0.5 + 0.5 * sin(uTime * 3.1 + vRipplePhase * 0.72);
  vec3 rippleColor = mix(uRippleColorA, uRippleColorB, rippleColorMix);
  vec3 color = mix(uColor, rippleColor, vRippleMask);
  gl_FragColor = vec4(color, alpha);
}
