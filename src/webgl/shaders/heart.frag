uniform vec3 uColor;
uniform float uOpacity;

void main() {
  vec2 centered = gl_PointCoord - vec2(0.5);
  float dist = length(centered);
  float alpha = smoothstep(0.5, 0.42, dist) * uOpacity;
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(uColor, alpha);
}
