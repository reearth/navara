# Navara Math

This module provides a shared math related function.

## Precision

For example, f32 and f64 have a different precision.  
For GIS, we may need a high precision to visualize a feature in the right position.  
  
Also, we need to prepare for WebGPU because [WebGPU will support f64](https://github.com/gpuweb/gpuweb/issues/2805).  
  
For these issues, this crate provides `use_f32` and `use_f64` feature flags.

```rs
let float: Float = 1.0;
let pi = std_float::consts::PI;
```
