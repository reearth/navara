# RTC vs RTE: High-Precision Rendering Approaches in Navara

## Executive Summary

This document explains the two complementary high-precision rendering techniques used in the Navara map engine to solve floating-point precision issues at planetary scale:

- **RTE (Relative-To-Eye)**: Per-vertex encoding for individual features
- **RTC (Relative-To-Center)**: Tile-based local coordinates for batched features

Both techniques address the same fundamental problem—floating-point precision loss when rendering large coordinates, but use different strategies optimized for different use cases.

---

## Table of Contents

1. [The Precision Problem](#the-precision-problem)
2. [Solution Overview](#solution-overview)
3. [RTE (Relative-To-Eye)](#rte-relative-to-eye)
4. [RTC (Relative-To-Center)](#rtc-relative-to-center)
5. [Side-by-Side Comparison](#side-by-side-comparison)
6. [When to Use Each Approach](#when-to-use-each-approach)
7. [Implementation Comparison](#implementation-comparison)
8. [Performance Analysis](#performance-analysis)
9. [Visual Examples](#visual-examples)
10. [Developer Guidelines](#developer-guidelines)

---

## The Precision Problem

### Why We Need Special Techniques

When rendering at planetary scale (Earth radius ~6,371,000 meters), we encounter a fundamental limitation of 32-bit floating-point numbers:

```
World-space position: (6371000.0, 6371000.0, 6371000.0)
Float32 precision at this magnitude: ~1 meter
```

**Problems this causes:**

1. **Vertex jittering**: Objects appear to shake or wobble during camera movement
2. **Z-fighting**: Overlapping surfaces flicker due to depth precision loss
3. **Inaccurate positioning**: Features appear in slightly wrong locations
4. **Scale-dependent artifacts**: Issues worsen at higher zoom levels

### The Fundamental Solution

Both RTE and RTC solve this by **working with small relative coordinates** instead of large absolute coordinates:

- Small coordinates = better precision
- Relative positioning eliminates the "large number" problem
- GPU calculations use values closer to zero

---

## RTE (Relative-To-Eye)

### Concept

**RTE** encodes each vertex position into high and low 32-bit components, then computes positions **relative to the camera** in the vertex shader.

### How It Works

```
┌────────────────────────────────────────────────────┐
│ 1. Encode Vertex Position (Rust)                   │
│    Input:  (6371000.123, 6371000.456, 6371000.789) │
│    Output: high = (6356992, 6356992, 6356992)      │
│            low = (14008.123, 14008.456, 14008.789) │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 2. Encode Camera Position (JavaScript/Frame)    │
│    Camera: (6371500.0, 6371500.0, 6371500.0)    │
│    Output: high = (6356992, 6356992, 6356992)   │
│            low = (14508.0, 14508.0, 14508.0)    │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│ 3. GPU Vertex Shader Computation                │
│    highDiff = vertexHigh - cameraHigh           │
│             = (0, 0, 0)                         │
│    lowDiff = vertexLow - cameraLow              │
│            = (-499.877, -499.544, -499.211)     │
│    relativePos = highDiff + lowDiff             │
│                = (-499.877, -499.544, -499.211) │
└─────────────────────────────────────────────────┘
```

**Result**: Vertex shader works with coordinates ~500 meters instead of ~6,371,000 meters!

### Key Characteristics

- **Encoding**: Splits 64-bit position into two 32-bit components
- **Storage**: 24 bytes per vertex (position_3d_high + position_3d_low)
- **Mesh position**: Always at origin (0, 0, 0)
- **Model matrix**: Translation zeroed, rotation only
- **Computation**: Done in vertex shader every frame
- **Camera dependency**: Requires camera position encoding each frame

---

## RTC (Relative-To-Center)

### Concept

**RTC** stores vertex positions **relative to a local origin** (tile center) and uses the Three.js model matrix to position the entire mesh in world space.

### How It Works

```
┌────────────────────────────────────────────────────┐
│ 1. Calculate Tile Center (Rust/Worker)             │
│    Tile extent: 140.0°-140.1° E, 35.0°-35.1° N     │
│    Center LLE: (140.05°, 35.05°, 0m)               │
│    Center ECEF: (-3723000.0, 3571000.0, 3640000.0) │
└────────────────┬───────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────┐
│ 2. Translate Positions to Local Space (Rust)         │
│    World vertex: (-3722980.0, 3571015.0, 3640005.0)  │
│    - Tile center: (-3723000.0, 3571000.0, 3640000.0) │
│    = Local vertex: (20.0, 15.0, 5.0)                 │
└────────────────┬─────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Three.js Mesh Setup (JavaScript)                         │
│    geometry.position = local coordinates (20, 15, 5)        │
│    mesh.position = tile center (-3723000, 3571000, 3640000) │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│ 4. GPU Rendering (Standard Three.js)                   │
│    transformed = modelViewMatrix * vec4(position, 1.0) │
│    (Model matrix contains tile center)                 │
└────────────────────────────────────────────────────────┘
```

**Result**: Vertex shader works with coordinates ~20 meters instead of ~6,371,000 meters!

### Key Characteristics

- **Encoding**: None - positions stored as regular f32 Vec3
- **Storage**: 12 bytes per vertex (position only)
- **Mesh position**: At tile center in world space
- **Model matrix**: Standard Three.js matrix with translation
- **Computation**: Standard GPU pipeline, no custom shader code
- **Camera dependency**: None - positions are static

---

## Side-by-Side Comparison

### Architecture Comparison

| Aspect | RTE (Relative-To-Eye) | RTC (Relative-To-Center) |
|--------|----------------------|--------------------------|
| **Use Case** | Individual polygon features | MVT batched polygon features (tiles) |
| **Coordinate System** | Camera-relative (dynamic) | Tile-relative (static) |
| **Position Encoding** | High/low f32 pairs | Single f32 Vec3 |
| **Memory per Vertex** | 24 bytes | 12 bytes |
| **Mesh Position** | (0, 0, 0) - origin | Tile center in world space |
| **Model Matrix** | Translation zeroed | Standard with translation |
| **Shader Complexity** | Custom shader chunks | Standard Three.js pipeline |
| **Per-Frame Updates** | Camera encoding required | None |
| **Implementation** | Complex | Simple |

### Data Flow Comparison

**RTE Data Flow:**
```
Geographic Coords (lat/lon/height)
    ↓
ECEF World Space (6,371,000m scale)
    ↓ [Rust: Encode to high/low]
Encoded Positions (split precision)
    ↓ [Transfer to GPU]
GPU Attributes (position_3d_high, position_3d_low)
    ↓ [Each frame: encode camera]
Camera Uniforms (camera_high, camera_low)
    ↓ [Vertex shader: subtract]
Camera-Relative Position (~100m scale) ✓
```

**RTC Data Flow:**
```
Geographic Coords (lat/lon/height)
    ↓
ECEF World Space (6,371,000m scale)
    ↓ [Rust: Calculate tile center]
Tile Center ECEF (6,371,000m scale)
    ↓ [Rust: Subtract center from vertices]
Local Positions (~50m scale) ✓
    ↓ [Transfer to GPU]
GPU Attributes (position)
    ↓ [Three.js: model matrix adds center back]
World Space Rendering
```

### Precision Comparison

| Coordinate System | Typical Value Range | Float32 Precision | Relative Precision |
|------------------|---------------------|-------------------|-------------------|
| **World Space (no technique)** | 6,371,000m | ~1 meter | Poor |
| **RTE (camera-relative)** | 0-100m | ~0.00001 meters | Excellent |
| **RTC (tile-relative)** | 0-100m | ~0.00001 meters | Excellent |

Both RTE and RTC achieve **~100,000× better precision** than world-space coordinates!

---

## When to Use Each Approach

### Use RTE When:

✅ **Individual features** - Single polygons, models, or geometries
✅ **Arbitrary positions** - Features not grouped by location
✅ **Maximum precision needed** - Critical positioning requirements
✅ **Dynamic features** - Objects that move independently
✅ **Large-scale features** - Single features spanning large areas

**Examples:**
- User-drawn polygons
- 3D building models
- Individual landmarks
- Highlighted features
- Animated objects

### Use RTC When:

✅ **Tile-based data** - MVT tiles, terrain tiles, raster tiles
✅ **Batched geometries** - Multiple features sharing coordinate system
✅ **Static features** - Features that don't move
✅ **Performance critical** - Large numbers of vertices
✅ **Memory constrained** - Need to minimize memory overhead

**Examples:**
- MVT polygon batches
- Terrain mesh tiles
- Point cloud tiles
- Batched line features
- Tile-based overlays

### Decision Matrix

| Scenario | Use RTC | Use RTE | Reason |
|----------|---------|---------|--------|
| MVT | ✅ | ❌ | Shared tile origin, simpler |
| 3DTiles | ✅ | ❌ | Tile-based, benefit from RTC |
| 3D models | ❌ | ✅ | Independent objects |
| Terrain tiles | ✅ | ❌ | Tile-based structure |
| User annotations | ❌ | ✅ | Individual features |

---

## Implementation Comparison

### Rust Implementation

**RTE - Vertex Encoding:**
```rust
// Individual feature - encode positions to RTE
fn encode_positions_rte(positions_f64: &[f64]) -> (Vec<f32>, Vec<f32>) {
    let mut high_positions = Vec::new();
    let mut low_positions = Vec::new();

    for &value in positions_f64.iter() {
        let encoded = EncodedFloat::encode(value);
        high_positions.push(encoded.high);
        low_positions.push(encoded.low);
    }

    (high_positions, low_positions)
}

// Result:
PolygonGeometryAttributes {
    position_3d_high: FloatAttribute::new(high_positions, 3),
    position_3d_low: FloatAttribute::new(low_positions, 3),
    position: None,
    // ...
}
```

**RTC - Tile Center Translation:**
```rust
// Batched MVT tile - translate to local space
fn calculate_tile_center(extent: &Extent<FloatType, Radians>) -> Vec3 {
    let center_lle = LLE {
        lng: Angle::new((extent.west.val() + extent.east.val()) / 2.0),
        lat: Angle::new((extent.south.val() + extent.north.val()) / 2.0),
        height: Meters::new(0.0),
    };
    WGS84_32.lle_to_xyz(center_lle)
}

fn translate_positions_to_center(
    attributes: &mut PolygonGeometryAttributes,
    center: &Vec3,
) {
    for vertex in positions.chunks_mut(3) {
        vertex[0] -= center.x; // X
        vertex[1] -= center.y; // Y
        vertex[2] -= center.z; // Z
    }
}

// Result:
PolygonGeometryAttributes {
    position: FloatAttribute::new(local_positions, 3),
    position_3d_high: None,
    position_3d_low: None,
    // ...
}
```

### Three.js Implementation

**RTE - Custom Shader:**
```typescript
// Vertex shader chunks
const RTE_VERTEX_SHADER = `
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;
uniform mat4 modelViewMatrixRTE;

attribute vec3 position_3d_high;
attribute vec3 position_3d_low;

vec3 transform_position_rte() {
    vec3 highDiff = position_3d_high - u_cameraPositionHigh;
    vec3 lowDiff = position_3d_low - u_cameraPositionLow;
    return highDiff + lowDiff;
}

void main() {
    vec3 transformed = transform_position_rte();
    // ... rest of shader
}
`;

// Per-frame update
mesh.updateRTE = (camera: Camera) => {
    // Encode camera position (calls WASM)
    const encoded = encodeCameraPosition(camera.position);
    material.uniforms.u_cameraPositionHigh.value = encoded.high;
    material.uniforms.u_cameraPositionLow.value = encoded.low;

    // Compute RTE model-view matrix (zero translation)
    const modelViewRTE = computeModelViewRTE(camera, mesh);
    material.uniforms.modelViewMatrixRTE.value = modelViewRTE;
};
```

**RTC - Standard Three.js:**
```typescript
// No custom shader needed - standard Three.js pipeline!

// Mesh setup
const geometry = new BufferGeometry();
geometry.setAttribute(
    'position',
    new BufferAttribute(localPositions, 3)  // Local coordinates
);

const mesh = new Mesh(geometry, material);
mesh.position.set(
    tileCenter.x,  // World-space tile center
    tileCenter.y,
    tileCenter.z
);

// No per-frame updates needed!
// Standard Three.js rendering handles everything
```

### Shader Comparison

**RTE - Custom Vertex Shader:**
```glsl
// Custom attributes
attribute vec3 position_3d_high;
attribute vec3 position_3d_low;

// Custom uniforms
uniform vec3 u_cameraPositionHigh;
uniform vec3 u_cameraPositionLow;
uniform mat4 modelViewMatrixRTE;

void main() {
    // Custom computation
    vec3 highDiff = position_3d_high - u_cameraPositionHigh;
    vec3 lowDiff = position_3d_low - u_cameraPositionLow;
    vec3 transformed = highDiff + lowDiff;

    // Apply RTE model-view matrix
    vec4 mvPosition = modelViewMatrixRTE * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
```

**RTC - Standard Vertex Shader:**
```glsl
// Standard Three.js attribute
attribute vec3 position;

void main() {
    // Standard Three.js pipeline - that's it!
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
}
```

## Conclusion

### Key Takeaways

1. **Different approaches for different needs:**
   - RTE = Individual features with maximum precision
   - RTC = Batched tiles with maximum performance

2. **Both achieve excellent precision:**
   - ~100,000× better than world-space coordinates
   - Eliminate jittering and z-fighting

3. **Performance trade-offs:**
   - RTE: More memory, per-frame updates, complex shaders
   - RTC: Less memory, zero updates, standard pipeline

4. **Complementary, not competitive:**
   - Use both in the same application
   - Choose based on feature type and requirements

### Best Practices

✅ **DO:**
- Use RTC for all tile-based data (MVT, terrain, etc.)
- Use RTE for individual user features
- Test precision at high zoom levels
- Monitor memory usage with RTE

❌ **DON'T:**
- Mix RTE and RTC in the same geometry
- Use RTE for batched tiles (use RTC instead)
- Use RTC for individual scattered features (use RTE instead)
- Forget to call `updateRTE()` each frame for RTE meshes

### Further Reading

- **Navara Architecture**: See [ARCHITECTURE.md](ARCHITECTURE.md)
- **IEEE 754 Float Precision**: Understanding floating-point limitations
