
/**
 * Signed Distance Function (SDF) for a 2D rounded box (rectangle with rounded corners)
 *
 * @name nvr_sdRoundedBox
 * @glslFunction
 *
 * param {vec2} p - 2D point (input position to evaluate)
 * param {vec2} b - half-extents (half width and height) of the box
 * param {float} r - corner radius of the rounded edges
 * returns {float} - signed distance to the rounded box
 */
float nvr_sdRoundedBox(vec2 p, vec2 b, float r) {
    // Adjust position by subtracting box dimensions and adding the corner radius
    vec2 q = abs(p) - b + vec2(r);
    
    // Calculate SDF:
    // - The first term computes distance to the rounded part (if outside the box)
    // - The second term handles the interior region (negative distances)
    // - Finally, subtract 'r' to adjust for the added radius earlier
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}