use std::collections::HashMap;
use url::Url;

/// Merges query parameters from base_url into target_url
/// target_url parameters take precedence over base_url parameters
pub fn uri_inherit_query_params(target_url: Url, base_url: &Url) -> Url {
    let base_query_pairs: HashMap<String, String> = base_url.query_pairs().into_owned().collect();

    let mut result_url = target_url;
    let target_query_pairs: HashMap<String, String> =
        result_url.query_pairs().into_owned().collect();

    let mut merged_params = base_query_pairs;
    merged_params.extend(target_query_pairs);

    result_url.query_pairs_mut().clear();
    for (key, value) in merged_params {
        result_url.query_pairs_mut().append_pair(&key, &value);
    }

    result_url
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_uri_inherit_query_params() {
        let base_url = Url::parse("https://example.com/base?session=123&key=abc").unwrap();
        let target_url = Url::parse("https://example.com/target?key=xyz&version=1").unwrap();

        let result = uri_inherit_query_params(target_url, &base_url);

        let query_pairs: HashMap<String, String> = result.query_pairs().into_owned().collect();
        assert_eq!(query_pairs.get("session"), Some(&"123".to_string()));
        assert_eq!(query_pairs.get("key"), Some(&"xyz".to_string()));
        assert_eq!(query_pairs.get("version"), Some(&"1".to_string()));
    }
}
