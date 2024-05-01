const COLOR_LOCATION = 0;

struct Fragment {
    @builtin(position) position: vec4<f32>,
    @location(COLOR_LOCATION) color: vec4<f32>
};

@vertex
fn vs(@builtin(vertex_index) vertex_index: u32) -> Fragment {
    let pos = array(
        vec2f(0.0, 0.5),
        vec2f(-0.5, -0.5),
        vec2f(0.5, -0.5)
    );
    let color = array (
        vec3f( 90 / 255.0, 128 / 255.0,  79 / 255.0),
        vec3f(170 / 255.0,  95 / 255.0,  54 / 255.0),
        vec3f( 70 / 255.0,  86 / 255.0, 175 / 255.0)
    );

    var result: Fragment;
    result.position = vec4f(pos[vertex_index], 0, 1);
    result.color = vec4f(color[vertex_index], 1);
    return result;
}

@fragment
fn fs(input: Fragment) -> @location(0) vec4f {
    return input.color;
}
