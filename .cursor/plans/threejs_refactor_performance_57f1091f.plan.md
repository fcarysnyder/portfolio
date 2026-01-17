---
name: threejs_refactor_performance
overview: Refactor the background effect to use Three.js (WebGL) instead of 2D Canvas to resolve performance issues while maintaining the "lush" 3D look.
todos:
  - id: install-three
    content: Install three and @types/three
    status: pending
  - id: setup-three
    content: Refactor BackgroundEffect.astro to use Three.js boilerplate (Scene, Camera, Renderer)
    status: pending
  - id: implement-shaders
    content: Implement GPU-accelerated particle wave using ShaderMaterial (Vertex/Fragment shaders)
    status: pending
  - id: connect-controls
    content: Connect Debug Controls to Shader Uniforms
    status: pending
---

# Three.js Refactor for Performance

## Objective

Migrate the `BackgroundEffect` component from 2D Canvas to **Three.js (WebGL)**. The current 2D implementation struggles with performance (lag) due to heavy CPU calculations and expensive `blur` filters per particle.

Moving to WebGL will:

1.  **Offload animation to the GPU**: Using Vertex Shaders for the wave motion means the CPU does almost zero work per frame.
2.  **Handle thousands of particles** easily (60fps).
3.  **Simulate Bokeh/Depth** efficiently using shader logic and texture sprites instead of CSS/Canvas filters.

## Implementation Details

### 1. Dependencies

- Install `three` and `@types/three`.

### 2. Component Refactor: `src/components/BackgroundEffect.astro`

- **Setup**: Initialize a `THREE.Scene`, `THREE.PerspectiveCamera`, and `THREE.WebGLRenderer` (with `alpha: true` for transparency).
- **Geometry**: Create a `THREE.BufferGeometry`.
- Generate grid points $(x, y, 0)$ once and store them in the `position` attribute.
- **Material**: Use `THREE.ShaderMaterial`.
- **Vertex Shader**: 
- Implement the sine wave logic here (GPU).
- Apply `z` displacement based on uniforms (time, frequency, amplitude).
- Calculate `gl_PointSize` based on perspective (distance to camera) to simulate depth.
- **Fragment Shader**:
- Draw a soft, anti-aliased circle (simulating the "lush" or "bokeh" look).
- Adjust `gl_FragColor` alpha based on depth (fog effect).
- **Uniforms**:
- Pass existing parameters (`gap`, `speed`, `frequency`, `amplitude`, `angle`, `zAxis`) as uniforms to the shader.
- Add `uTime` to drive animation.

### 3. Dev Tools Integration

- Update the existing debug controls to modify the Three.js uniforms (e.g., `material.uniforms.uSpeed.value = ...`) instead of local JS variables.

## Files to Modify

- [`package.json`](package.json) (install dependencies)
- [`src/components/BackgroundEffect.astro`](src/components/BackgroundEffect.astro)

## Verification

- Verify the animation runs smoothly (60fps) even with high particle counts.
- Check that the "lush" Z-axis and "bokeh" feel are preserved or improved.