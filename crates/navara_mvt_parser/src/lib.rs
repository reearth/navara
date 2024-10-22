use mvt_reader::Reader;

pub fn from_data(data: Vec<u8>) -> Result<Reader, &'static str> {
    Reader::new(data).map_err(|_| "Failed to decode mvt data")
}

#[cfg(test)]
mod tests {
    use super::*;
    use geo_types::Geometry;
    use mvt_reader::{tile, Message, Tile};

    fn create_mock_mvt_data() -> Vec<u8> {
        let mut tile = Tile { layers: Vec::new() };

        let layer = tile::Layer {
            version: 2,
            name: "test_layer_with_all_geom_types".to_string(),
            features: vec![
                // Point feature
                tile::Feature {
                    id: Some(1),
                    tags: vec![0, 0], // keys[0] values[0]
                    r#type: Some(tile::GeomType::Point as i32),
                    geometry: vec![9, 50, 34],
                },
                // LineString feature
                tile::Feature {
                    id: Some(2),
                    tags: vec![1, 1], // keys[1] values[1]
                    r#type: Some(tile::GeomType::Linestring as i32),
                    geometry: vec![18, 10, 20, 15, 25],
                },
                // Polygon feature
                tile::Feature {
                    id: Some(3),
                    tags: vec![2, 2], // keys[2] values[2]
                    r#type: Some(tile::GeomType::Polygon as i32),
                    geometry: vec![
                        9, 4, 4, // move to (4, 4)
                        26, 0, 10, // line to (30, 14)
                        0, 14, // line to (30, 28)
                        15, 0, // line to (15, 28)
                        15, 0, // line to (0, 28) closing the polygon
                    ],
                },
            ],
            keys: vec![
                "name".to_string(),
                "type".to_string(),
                "description".to_string(),
            ],
            values: vec![
                tile::Value {
                    string_value: Some("example_point".to_string()),
                    float_value: Some(321.0),
                    double_value: Some(654.0),
                    int_value: Some(456),
                    uint_value: Some(789),
                    sint_value: Some(-123),
                    bool_value: Some(false),
                },
                tile::Value {
                    string_value: Some("line".to_string()),
                    float_value: Some(111.0),
                    double_value: Some(222.0),
                    int_value: Some(333),
                    uint_value: Some(444),
                    sint_value: Some(-555),
                    bool_value: Some(true),
                },
                tile::Value {
                    string_value: Some("polygon_example".to_string()),
                    float_value: Some(987.0),
                    double_value: Some(1234.0),
                    int_value: Some(100),
                    uint_value: Some(200),
                    sint_value: Some(-50),
                    bool_value: Some(true),
                },
            ],
            extent: Some(4096),
        };

        tile.layers.push(layer);

        let mut buffer = Vec::new();
        tile.encode(&mut buffer).expect("Failed to encode Tile");

        buffer
    }

    #[test]
    fn it_should_parse_mvt() {
        let buffer = create_mock_mvt_data();

        let result = from_data(buffer);
        assert!(result.is_ok(), "Parse mvt data error");

        let reader = result.unwrap();
        let rslt_layer_names = reader.get_layer_names();
        assert!(rslt_layer_names.is_ok(), "mvt_reader get_layer_names error");

        let layer_names = rslt_layer_names.unwrap();
        assert_eq!(layer_names[0], "test_layer_with_all_geom_types");

        let rslt_features = reader.get_features(0);
        assert!(rslt_features.is_ok(), "mvt_reader get_features error");

        let features = rslt_features.unwrap();
        assert_eq!(features.len(), 3);

        let geom_point = features[0].get_geometry();
        assert!(
            matches!(geom_point, Geometry::MultiPoint(_)),
            "The geometry is not a MultiPoint."
        );

        let geom_line = features[1].get_geometry();
        assert!(
            matches!(geom_line, Geometry::LineString(_)),
            "The geometry is not a LineString."
        );

        let geom_polygon = features[2].get_geometry();
        assert!(
            matches!(geom_polygon, Geometry::MultiPolygon(_)),
            "The geometry is not a MultiPolygon."
        );
    }
}
