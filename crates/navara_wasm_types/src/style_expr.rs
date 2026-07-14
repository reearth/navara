use maplibre_expr::{EvaluationContext, Expr, Feature, Value, evaluate, parse, typecheck};
use serde_json::Value as JsonValue;
use std::collections::BTreeMap;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct CompiledExpression {
    expr: Expr,
}

#[wasm_bindgen]
impl CompiledExpression {
    /// Compile a MapLibre expression from JSON
    /// expr_json: Expression array (e.g., ["get", "name"])
    #[wasm_bindgen(constructor)]
    pub fn new(expr_json: JsValue) -> Result<CompiledExpression, JsValue> {
        // 1. Deserialize JSON to serde_json::Value
        let json: JsonValue = serde_wasm_bindgen::from_value(expr_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

        // 2. Parse expression using maplibre-expr
        let expr = parse(&json).map_err(|e| JsValue::from_str(&format!("Parse error: {:?}", e)))?;

        // 3. Type-check expression (no expected type, no top-level coercion)
        let expr = typecheck(&expr, None, false)
            .map_err(|e| JsValue::from_str(&format!("Type error: {:?}", e)))?;

        Ok(CompiledExpression { expr })
    }

    /// Evaluate expression with given context
    ///
    /// # Arguments
    /// * `properties_json` - Feature properties as JSON object
    /// * `zoom` - Current zoom level
    /// * `geometry_type` - Optional geometry type string (e.g., "Point", "Polygon")
    ///
    /// # Returns
    /// Evaluated value as JsValue. Supported types:
    /// - Null, Bool, Number, String (primitives)
    /// - Color: `{r, g, b, a}` object
    /// - Array, Object: nested structures
    /// - NumberArray: optimized number arrays
    ///
    /// Unsupported types return `null` with a console warning.
    #[wasm_bindgen]
    pub fn evaluate(
        &self,
        properties_json: JsValue,
        zoom: f64,
        geometry_type: Option<String>,
    ) -> Result<JsValue, JsValue> {
        // 1. Deserialize properties from JSON
        let properties_json: JsonValue = serde_wasm_bindgen::from_value(properties_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid properties: {}", e)))?;

        // 2. Convert JSON properties to BTreeMap<String, Value>
        let properties = json_to_value_map(&properties_json)?;

        // 3. Create Feature and EvaluationContext
        let feature = Feature {
            id: None,               // Not needed for property-based styling
            properties,             // Main data: feature attributes from GeoJSON
            geometry_type,          // Geometry type for ["geometry-type"] expressions
            state: BTreeMap::new(), // Interactive states (hover/selected) set by renderer
            geometry: Vec::new(),   // Coordinates for geometric expressions (distance, area)
        };
        let context = EvaluationContext::new()
            .with_zoom(zoom)
            .with_feature(feature);

        // 4. Evaluate expression
        let result = evaluate(&self.expr, &context)
            .map_err(|e| JsValue::from_str(&format!("Eval error: {:?}", e)))?;

        // 5. Convert result to JsValue
        value_to_jsvalue(&result)
    }
}

#[wasm_bindgen]
pub struct CompiledFilter {
    expr: Expr,
}

#[wasm_bindgen]
impl CompiledFilter {
    /// Compile a MapLibre filter from JSON
    /// filter_json: Filter expression (e.g., ["==", ["get", "type"], "park"])
    #[wasm_bindgen(constructor)]
    pub fn new(filter_json: JsValue) -> Result<CompiledFilter, JsValue> {
        // Parse and type-check filter expression
        let json: JsonValue = serde_wasm_bindgen::from_value(filter_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid JSON: {}", e)))?;

        let expr = parse(&json).map_err(|e| JsValue::from_str(&format!("Parse error: {:?}", e)))?;

        let expr = typecheck(&expr, None, false)
            .map_err(|e| JsValue::from_str(&format!("Type error: {:?}", e)))?;

        Ok(CompiledFilter { expr })
    }

    /// Test if feature matches filter
    ///
    /// # Arguments
    /// * `properties_json` - Feature properties as JSON object
    /// * `zoom` - Current zoom level
    /// * `geometry_type` - Optional geometry type string (e.g., "Point", "Polygon")
    #[wasm_bindgen]
    pub fn test(
        &self,
        properties_json: JsValue,
        zoom: f64,
        geometry_type: Option<String>,
    ) -> Result<bool, JsValue> {
        // Deserialize properties from JSON
        let properties_json: JsonValue = serde_wasm_bindgen::from_value(properties_json)
            .map_err(|e| JsValue::from_str(&format!("Invalid properties: {}", e)))?;

        let properties = json_to_value_map(&properties_json)?;

        // Create context and evaluate
        let feature = Feature {
            id: None,               // Not needed for property-based filtering
            properties,             // Main data: feature attributes from GeoJSON
            geometry_type,          // Geometry type for ["geometry-type"] filters
            state: BTreeMap::new(), // Interactive states not used in filters
            geometry: Vec::new(),   // Coordinates not used in property filters
        };
        let context = EvaluationContext::new()
            .with_zoom(zoom)
            .with_feature(feature);

        let result = evaluate(&self.expr, &context)
            .map_err(|e| JsValue::from_str(&format!("Eval error: {:?}", e)))?;

        // Convert result to boolean
        match result {
            Value::Bool(b) => Ok(b),
            _ => Err(JsValue::from_str("Filter did not return boolean")),
        }
    }
}

// Helper functions to convert between JSON and maplibre-expr Value types

fn json_to_value_map(json: &JsonValue) -> Result<BTreeMap<String, Value>, JsValue> {
    match json {
        JsonValue::Object(obj) => {
            let mut map = BTreeMap::new();
            for (k, v) in obj.iter() {
                map.insert(k.clone(), json_to_value(v)?);
            }
            Ok(map)
        }
        _ => Err(JsValue::from_str("Properties must be an object")),
    }
}

fn json_to_value(json: &JsonValue) -> Result<Value, JsValue> {
    Ok(match json {
        JsonValue::Null => Value::Null,
        JsonValue::Bool(b) => Value::Bool(*b),
        JsonValue::Number(n) => Value::Number(n.as_f64().unwrap_or(0.0)),
        JsonValue::String(s) => Value::String(s.clone()),
        JsonValue::Array(arr) => {
            let values: Result<Vec<_>, _> = arr.iter().map(json_to_value).collect();
            Value::Array(values?)
        }
        JsonValue::Object(obj) => {
            let mut map = BTreeMap::new();
            for (k, v) in obj.iter() {
                map.insert(k.clone(), json_to_value(v)?);
            }
            Value::Object(map)
        }
    })
}

fn value_to_jsvalue(value: &Value) -> Result<JsValue, JsValue> {
    match value {
        Value::Null => Ok(JsValue::NULL),
        Value::Bool(b) => Ok(JsValue::from(*b)),
        Value::Number(n) => Ok(JsValue::from(*n)),
        Value::String(s) => Ok(JsValue::from_str(s)),
        Value::Color(c) => {
            // Convert Color { r, g, b, a } to JsValue object
            let obj = js_sys::Object::new();
            js_sys::Reflect::set(&obj, &JsValue::from_str("r"), &JsValue::from(c.r))?;
            js_sys::Reflect::set(&obj, &JsValue::from_str("g"), &JsValue::from(c.g))?;
            js_sys::Reflect::set(&obj, &JsValue::from_str("b"), &JsValue::from(c.b))?;
            js_sys::Reflect::set(&obj, &JsValue::from_str("a"), &JsValue::from(c.a))?;
            Ok(obj.into())
        }
        Value::Array(arr) => {
            let js_arr = js_sys::Array::new();
            for v in arr {
                js_arr.push(&value_to_jsvalue(v)?);
            }
            Ok(js_arr.into())
        }
        Value::Object(obj) => {
            let js_obj = js_sys::Object::new();
            for (k, v) in obj {
                js_sys::Reflect::set(&js_obj, &JsValue::from_str(k), &value_to_jsvalue(v)?)?;
            }
            Ok(js_obj.into())
        }
        Value::NumberArray(arr) => {
            let js_arr = js_sys::Array::new();
            for n in arr {
                js_arr.push(&JsValue::from(*n));
            }
            Ok(js_arr.into())
        }
        // Fallback for unsupported types: log warning and return null
        // This prevents valid MapLibre expressions from failing at runtime
        _ => {
            bevy_log::warn!(
                "Unsupported maplibre-expr value type '{}'.",
                value.type_name()
            );
            Ok(JsValue::NULL)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_json_to_value_primitives() {
        // Test basic types
        assert!(matches!(json_to_value(&json!(null)).unwrap(), Value::Null));
        assert!(matches!(
            json_to_value(&json!(true)).unwrap(),
            Value::Bool(true)
        ));
        assert!(matches!(json_to_value(&json!(42.5)).unwrap(), Value::Number(n) if n == 42.5));
        assert!(
            matches!(json_to_value(&json!("hello")).unwrap(), Value::String(s) if s == "hello")
        );
    }

    #[test]
    fn test_json_to_value_array() {
        let result = json_to_value(&json!([1, 2, 3])).unwrap();
        match result {
            Value::Array(arr) => {
                assert_eq!(arr.len(), 3);
                assert!(matches!(arr[0], Value::Number(n) if n == 1.0));
            }
            _ => panic!("Expected array"),
        }
    }

    #[test]
    fn test_json_to_value_object() {
        let result = json_to_value(&json!({"name": "test", "value": 42})).unwrap();
        match result {
            Value::Object(map) => {
                assert_eq!(map.len(), 2);
                assert!(matches!(map.get("name"), Some(Value::String(s)) if s == "test"));
                assert!(matches!(map.get("value"), Some(Value::Number(n)) if *n == 42.0));
            }
            _ => panic!("Expected object"),
        }
    }

    #[test]
    fn test_compiled_expression_constant() {
        // Test constant value expression
        let expr_json = json!(5);
        let expr = parse(&expr_json).expect("Failed to parse");
        let expr = typecheck(&expr, None, false).expect("Failed to typecheck");

        let properties = BTreeMap::new();
        let feature = Feature {
            id: None,
            properties,
            geometry_type: None,
            state: BTreeMap::new(),
            geometry: Vec::new(),
        };
        let context = EvaluationContext::new()
            .with_zoom(0.0)
            .with_feature(feature);

        let result = evaluate(&expr, &context).expect("Failed to evaluate");
        assert!(matches!(result, Value::Number(n) if n == 5.0));
    }

    #[test]
    fn test_compiled_expression_get_property() {
        // Test ["get", "name"] expression
        let expr_json = json!(["get", "name"]);
        let expr = parse(&expr_json).expect("Failed to parse");
        let expr = typecheck(&expr, None, false).expect("Failed to typecheck");

        let mut properties = BTreeMap::new();
        properties.insert("name".to_string(), Value::String("test".to_string()));

        let feature = Feature {
            id: None,
            properties,
            geometry_type: None,
            state: BTreeMap::new(),
            geometry: Vec::new(),
        };
        let context = EvaluationContext::new()
            .with_zoom(0.0)
            .with_feature(feature);

        let result = evaluate(&expr, &context).expect("Failed to evaluate");
        assert!(matches!(result, Value::String(s) if s == "test"));
    }

    #[test]
    fn test_compiled_filter_equality() {
        // Test ["==", ["get", "type"], "park"] filter
        let filter_json = json!(["==", ["get", "type"], "park"]);
        let expr = parse(&filter_json).expect("Failed to parse");
        let expr = typecheck(&expr, None, false).expect("Failed to typecheck");

        // Test matching feature
        let mut properties = BTreeMap::new();
        properties.insert("type".to_string(), Value::String("park".to_string()));

        let feature = Feature {
            id: None,
            properties,
            geometry_type: None,
            state: BTreeMap::new(),
            geometry: Vec::new(),
        };
        let context = EvaluationContext::new()
            .with_zoom(0.0)
            .with_feature(feature);

        let result = evaluate(&expr, &context).expect("Failed to evaluate");
        assert!(matches!(result, Value::Bool(true)));

        // Test non-matching feature
        let mut properties = BTreeMap::new();
        properties.insert("type".to_string(), Value::String("water".to_string()));

        let feature = Feature {
            id: None,
            properties,
            geometry_type: None,
            state: BTreeMap::new(),
            geometry: Vec::new(),
        };
        let context = EvaluationContext::new()
            .with_zoom(0.0)
            .with_feature(feature);

        let result = evaluate(&expr, &context).expect("Failed to evaluate");
        assert!(matches!(result, Value::Bool(false)));
    }

    #[test]
    fn test_color_expression_evaluation() {
        // Test color literal expression: "rgb(255, 128, 0)"
        // MapLibre color literals are parsed as strings and converted to Color values
        let expr_json = json!(["rgb", 255, 128, 0]);
        let expr = parse(&expr_json).expect("Failed to parse color expression");
        let expr = typecheck(&expr, None, false).expect("Failed to typecheck color");

        let properties = BTreeMap::new();
        let feature = Feature {
            id: None,
            properties,
            geometry_type: None,
            state: BTreeMap::new(),
            geometry: Vec::new(),
        };
        let context = EvaluationContext::new()
            .with_zoom(0.0)
            .with_feature(feature);

        let result = evaluate(&expr, &context).expect("Failed to evaluate color");

        // Verify it's a Color value with expected components
        match result {
            Value::Color(c) => {
                // Colors are normalized to 0-1 range
                assert!((c.r - 1.0).abs() < 0.01, "Expected r=1.0, got {}", c.r);
                assert!((c.g - 0.5).abs() < 0.01, "Expected g≈0.5, got {}", c.g);
                assert!((c.b - 0.0).abs() < 0.01, "Expected b=0.0, got {}", c.b);
                assert!((c.a - 1.0).abs() < 0.01, "Expected a=1.0, got {}", c.a);
            }
            _ => panic!("Expected Color value, got {:?}", result.type_name()),
        }
    }
}
