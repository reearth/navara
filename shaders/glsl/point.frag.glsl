// Clip out of a circle from a plane with antialiasing.
// The method of AA: https://stackoverflow.com/questions/12945277/drawing-antialiased-circle-using-shaders
float nvr_circle_alpha(vec2 uv) {
    float border = 0.01;
    float radius = 0.5;

    float dist = radius - length(uv);

    float t = 0.0;
    if (dist > border)
      t = 1.0;
    else if (dist > 0.0)
      t = dist / border;
    
    return mix(0., 1., t);
}
