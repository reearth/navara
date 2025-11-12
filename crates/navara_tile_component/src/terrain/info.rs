#[derive(Debug)]
pub struct TerrainInformation {
    pub max_height: f64,
}

impl TerrainInformation {
    pub fn new() -> Self {
        Self::default()
    }
}

impl Default for TerrainInformation {
    fn default() -> Self {
        Self { max_height: 0. }
    }
}
