uniform sampler2D texture0;
uniform float opacity;
uniform vec2 uvScale;
uniform vec2 uvOffset;

varying vec2 vUv;
varying vec3 vColor;

void main() {
  vec2 transformedUv = vec2(
    uvOffset.x + vUv.x * uvScale.x,
    uvOffset.y + (1.0 - vUv.y) * uvScale.y
  );
  float value = texture(texture0, transformedUv).r;

  vec4 diffuseColor = vec4(vColor, value * opacity);

  gl_FragColor = diffuseColor;
}
