use navara_math::FloatType;

pub struct Martini {
    pub size: u32,
    num_triangles: u32,
    num_parent_triangles: u32,
    coords: Vec<u32>,
    index_map: Vec<Option<usize>>,
}

impl Martini {
    pub fn new(size: u32) -> Self {
        let tile_size = size - 1;
        if tile_size & (tile_size - 1) == 1 {
            panic!("Expected grid size to be 2^n+1, got {}.", size)
        }
        let num_triangles = tile_size * tile_size * 2 - 2;
        Self {
            size,
            num_triangles,
            num_parent_triangles: num_triangles - tile_size * tile_size,
            coords: Self::construct_coords(tile_size, num_triangles as usize),
            index_map: vec![None; (size * size) as usize],
        }
    }

    fn construct_coords(tile_size: u32, num_triangles: usize) -> Vec<u32> {
        let mut coords = vec![0; num_triangles * 4];

        // get triangle coordinates from its index in an implicit binary tree
        for i in 0..num_triangles {
            let mut id = i + 2;
            let mut ax = 0;
            let mut ay = 0;
            let mut bx = 0;
            let mut by = 0;
            let mut cx = 0;
            let mut cy = 0;

            if (id & 1) == 1 {
                bx = tile_size;
                by = tile_size;
                cx = tile_size; // bottom-left triangle
            } else {
                ax = tile_size;
                ay = tile_size;
                cy = tile_size; // top-right triangle
            }

            id >>= 1;
            while id > 1 {
                let mx = (ax + bx) >> 1;
                let my = (ay + by) >> 1;

                if (id & 1) == 1 {
                    // left half
                    bx = ax;
                    by = ay;
                    ax = cx;
                    ay = cy;
                } else {
                    // right half
                    ax = bx;
                    ay = by;
                    bx = cx;
                    by = cy;
                }
                cx = mx;
                cy = my;

                id >>= 1;
            }
            let k = i * 4;
            coords[k] = ax;
            coords[k + 1] = ay;
            coords[k + 2] = bx;
            coords[k + 3] = by;
        }

        coords
    }

    pub fn create_terrain<F>(&self, get_height: &F) -> Tile
    where
        F: Fn(usize, usize) -> FloatType,
    {
        Tile::new(self, get_height)
    }
}

pub struct Tile {
    errors: Vec<FloatType>,
}

impl Tile {
    fn new<F>(martini: &Martini, get_height: &F) -> Self
    where
        F: Fn(usize, usize) -> FloatType,
    {
        Self {
            errors: Self::compute_errors(martini, get_height),
        }
    }

    fn compute_errors<F>(martini: &Martini, get_height: &F) -> Vec<FloatType>
    where
        F: Fn(usize, usize) -> FloatType,
    {
        let Martini {
            num_triangles,
            num_parent_triangles,
            coords,
            size,
            index_map: _,
        } = martini;
        let size = *size as isize;
        let mut errors: Vec<FloatType> = vec![0.; (size * size) as usize];

        // iterate over all possible triangles, starting from the smallest level
        for i in (0..(*num_triangles as usize)).rev() {
            let k = i * 4;
            let ax = coords[k] as isize;
            let ay = coords[k + 1] as isize;
            let bx = coords[k + 2] as isize;
            let by = coords[k + 3] as isize;

            let mx = (ax + bx) >> 1;
            let my = (ay + by) >> 1;
            let cx = mx + my - ay;
            let cy = my + ax - mx;

            // calculate error in the middle of the long edge of the triangle
            let interpolated_height =
                (get_height(ax as usize, ay as usize) + get_height(bx as usize, by as usize)) / 2.;
            let middle_index = (my * size + mx) as usize;
            let middle_error = (interpolated_height - get_height(mx as usize, my as usize)).abs();

            errors[middle_index] = errors[middle_index].max(middle_error);

            // bigger triangles; accumulate error with children
            if i < (*num_parent_triangles as usize) {
                let left_child_index = (((ay + cy) >> 1) * size + ((ax + cx) >> 1)) as usize;
                let right_child_index = (((by + cy) >> 1) * size + ((bx + cx) >> 1)) as usize;
                errors[middle_index] = errors
                    .get(middle_index)
                    .map_or(0., |v| *v)
                    .max(errors.get(left_child_index).map_or(0., |v| *v))
                    .max(errors.get(right_child_index).map_or(0., |v| *v));
            }
        }

        errors
    }

    /// Construct a mesh from the computed error.
    /// You can transform a vertex by the callback.
    /// Note that `transform` callback takes UV.
    pub fn construct_mesh<F>(
        &mut self,
        martini: &mut Martini,
        max_error: FloatType,
        transform: &mut F,
    ) -> (Vec<FloatType>, Vec<u32>, Vec<FloatType>)
    where
        F: FnMut((FloatType, FloatType)) -> (FloatType, FloatType, FloatType),
    {
        let size = martini.size;
        let index_map = &mut martini.index_map;

        let errors = &self.errors;

        let max = size - 1;

        index_map.fill(None);

        let mut vertices = vec![];
        let mut uvs = vec![];
        let mut indices = vec![];

        let mut num_vertices = 0;
        let mut new_index = || {
            let v = num_vertices;
            num_vertices += 1;
            Some(v)
        };

        let mut add_vertex = |x: u32, y: u32, i: usize| {
            let idx = index_map[i];
            if idx.is_none() {
                let u = (x as FloatType) / (max as FloatType);
                let v = 1. - (y as FloatType) / (max as FloatType);

                let (x, y, z) = transform((u, v));

                vertices.push(x);
                vertices.push(y);
                vertices.push(z);

                uvs.push(u);
                uvs.push(v);

                index_map[i] = new_index();
            }

            index_map[i].unwrap()
        };

        let mut process_triangle = |(ax, ay, bx, by, cx, cy)| {
            let ai = (ay * size + ax) as usize;
            let bi = (by * size + bx) as usize;
            let ci = (cy * size + cx) as usize;

            let ai = add_vertex(ax, ay, ai);
            let bi = add_vertex(bx, by, bi);
            let ci = add_vertex(cx, cy, ci);

            indices.push(ai as u32);
            indices.push(bi as u32);
            indices.push(ci as u32);
        };

        Self::process_errors(
            &mut process_triangle,
            size,
            errors,
            &max_error,
            (0, 0, max, max, max, 0),
        );
        Self::process_errors(
            &mut process_triangle,
            size,
            errors,
            &max_error,
            (max, max, 0, 0, 0, max),
        );

        (vertices, indices, uvs)
    }

    fn process_errors<F>(
        cb: &mut F,
        size: u32,
        errors: &[FloatType],
        max_error: &FloatType,
        (ax, ay, bx, by, cx, cy): (u32, u32, u32, u32, u32, u32),
    ) where
        F: FnMut((u32, u32, u32, u32, u32, u32)),
    {
        let mx = (ax + bx) >> 1;
        let my = (ay + by) >> 1;

        if (ax as i32 - cx as i32).abs() + (ay as i32 - cy as i32).abs() > 1
            && &errors[(my * size + mx) as usize] > max_error
        {
            // triangle doesn't approximate the surface well enough; drill down further
            Self::process_errors(cb, size, errors, max_error, (cx, cy, ax, ay, mx, my));
            Self::process_errors(cb, size, errors, max_error, (bx, by, cx, cy, mx, my));
        } else {
            cb((ax, ay, bx, by, cx, cy));
        }
    }
}
