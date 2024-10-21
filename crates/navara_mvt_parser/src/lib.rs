use mvt_reader::Reader;

pub fn from_data(data: Vec<u8>) -> Result<Reader, &'static str> {
    Reader::new(data).map_err(|_| "Failed to decode mvt data")
}

#[cfg(test)]
mod tests {
    use super::*;
    use geo_types::Geometry;

    #[test]
    fn it_should_parse_mvt() {
        let buffer: Vec<u8> = vec![
            26, 235, 1, 10, 30, 116, 101, 115, 116, 95, 108, 97, 121, 101, 114, 95, 119, 105, 116,
            104, 95, 97, 108, 108, 95, 103, 101, 111, 109, 95, 116, 121, 112, 101, 115, 18, 13, 8,
            1, 18, 2, 0, 0, 24, 1, 34, 3, 9, 50, 34, 18, 15, 8, 2, 18, 2, 1, 1, 24, 2, 34, 5, 18,
            10, 20, 15, 25, 18, 22, 8, 3, 18, 2, 2, 2, 24, 3, 34, 12, 9, 4, 4, 26, 0, 10, 0, 14,
            15, 0, 15, 0, 26, 4, 110, 97, 109, 101, 26, 4, 116, 121, 112, 101, 26, 11, 100, 101,
            115, 99, 114, 105, 112, 116, 105, 111, 110, 34, 40, 10, 13, 101, 120, 97, 109, 112,
            108, 101, 95, 112, 111, 105, 110, 116, 21, 0, 128, 160, 67, 25, 0, 0, 0, 0, 0, 112,
            132, 64, 32, 200, 3, 40, 149, 6, 48, 245, 1, 56, 0, 34, 31, 10, 4, 108, 105, 110, 101,
            21, 0, 0, 222, 66, 25, 0, 0, 0, 0, 0, 192, 107, 64, 32, 205, 2, 40, 188, 3, 48, 213, 8,
            56, 1, 34, 40, 10, 15, 112, 111, 108, 121, 103, 111, 110, 95, 101, 120, 97, 109, 112,
            108, 101, 21, 0, 192, 118, 68, 25, 0, 0, 0, 0, 0, 72, 147, 64, 32, 100, 40, 200, 1, 48,
            99, 56, 1, 40, 128, 32, 120, 2,
        ];

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
