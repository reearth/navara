
mod vector_tile;

use prost::Message;
use vector_tile::Tile;


pub fn from_data(data: &[u8]) -> Result<vector_tile::Tile, &'static str> {
    Tile::decode(data).map_err(|_| "Failed to decode mvt data")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_should_parse_mvt() {
        let mut tile = Tile {
            layers: Vec::new(),
        };

        let layer = vector_tile::tile::Layer {
            version: 2,
            name: "example_layer".to_string(),
            features: vec![],
            keys: vec!["name".to_string()],
            values: vec![vector_tile::tile::Value {
                string_value: Some("example_value".to_string()),
                float_value: Some(123.0),
                double_value: Some(456.0),
                int_value: Some(123),
                uint_value: Some(123),
                sint_value: Some(123),
                bool_value: Some(true),
            }],
            extent: Some(4096),
        };
    
        tile.layers.push(layer);

        let mut buffer = Vec::new();
        tile.encode(&mut buffer).expect("Failed to encode Tile");

        let result = from_data(&*buffer);
        assert!(result.is_ok(), "Expected Ok but got an error");

        let mvt_tile = result.unwrap();

        assert_eq!(mvt_tile.layers[0].name, "example_layer");
    }
}
