//! Build a `FontFamily` from CSS `@font-face` rules.
//!
//! This is the pure parsing core behind `@navaramap/font`'s
//! `parseFontFamilyFromCss` / `fetchFontFamilyFromCss`: given a stylesheet's
//! text (e.g. a Google Fonts CSS API response), it extracts one lazily-loaded
//! font face per `@font-face` block — its `src` URL and its `unicode-range` —
//! applies optional block filters, and orders the faces by CSS precedence.
//!
//! Only the parsing lives here; the network fetch and the public async wrappers
//! stay in TypeScript (`web/navara_font/src/cssFontFamily.ts`), which calls the
//! two `#[wasm_bindgen]` entry points below. This mirrors the split used by
//! [`crate::declutter`]: the numeric/parsing kernel in Rust, orchestration in TS.
//!
//! The hand-written tokenizers (rather than a regex dependency) keep the
//! `navara_wasm_api` module small — the same reason `declutter` avoids pulling in
//! a matrix library. Parsing correctness is covered by the tests at the bottom of
//! this file, ported from the TypeScript `cssFontFamily.test.ts`.

use serde::{Deserialize, Serialize};
use url::Url;
use wasm_bindgen::prelude::*;

/// The largest valid Unicode codepoint; ranges above this are rejected.
const MAX_CODEPOINT: u32 = 0x10FFFF;

/// Inclusive codepoint range covered by a font face. Mirrors the TypeScript
/// `UnicodeRange` type (`{ from, to }`).
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct UnicodeRange {
    pub from: u32,
    pub to: u32,
}

/// One parsed font face: its resolved `src` URL and the codepoints it covers.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FontFace {
    pub url: String,
    pub unicode_ranges: Vec<UnicodeRange>,
}

/// A named set of faces — the value consumed by `view.addFontFamily`.
#[derive(Serialize, Debug, Clone, PartialEq, Eq)]
pub struct FontFamily {
    pub family: String,
    pub faces: Vec<FontFace>,
}

/// `font-family` filter value: a single name or an ordered list (the list also
/// sets face priority). Untagged so it deserializes from either a JS string or a
/// JS array of strings.
#[derive(Deserialize, Debug, Clone)]
#[serde(untagged)]
enum FontFamilyFilter {
    One(String),
    Many(Vec<String>),
}

/// `font-weight` filter value: a keyword/range string (`"100 900"`) or a plain
/// number (`800`). Untagged so it accepts either JS type.
#[derive(Deserialize, Debug, Clone)]
#[serde(untagged)]
enum FontWeightFilter {
    Text(String),
    Number(f64),
}

/// Options passed to [`parse_font_family_from_css`]; the TS
/// `ParseCssFontFamilyOptions`. Unknown fields (e.g. `requestInit`) are ignored.
#[derive(Default, Deserialize, Debug)]
#[serde(rename_all = "camelCase", default)]
struct ParseOptions {
    font_family: Option<FontFamilyFilter>,
    font_weight: Option<FontWeightFilter>,
    font_style: Option<String>,
    base_url: Option<String>,
}

/// A single parsed `@font-face` block's descriptors.
#[derive(Default, Debug)]
struct FontFaceBlock {
    font_family: Option<String>,
    font_style: Option<String>,
    font_weight: Option<String>,
    src: Option<String>,
    unicode_range: Option<String>,
}

/// Covers every codepoint — used when a block declares no `unicode-range`.
fn full_range() -> Vec<UnicodeRange> {
    vec![UnicodeRange {
        from: 0,
        to: MAX_CODEPOINT,
    }]
}

/// Strip a single matching pair of surrounding quotes, mirroring the TS
/// `stripQuotes` (which uses `value.slice(1, -1)` when the first char is a quote
/// and the string ends with the same quote).
fn strip_quotes(value: &str) -> String {
    let mut chars = value.chars();
    if let Some(first) = chars.next()
        && (first == '"' || first == '\'')
        && value.ends_with(first)
    {
        let count = value.chars().count();
        // Equivalent to slice(1, -1): drop the first and last char.
        return value
            .chars()
            .skip(1)
            .take(count.saturating_sub(2))
            .collect();
    }
    value.to_string()
}

/// True when `slice` equals `lit` ignoring ASCII case.
fn eq_ignore_case(slice: &[char], lit: &str) -> bool {
    slice.len() == lit.len()
        && slice
            .iter()
            .zip(lit.chars())
            .all(|(a, b)| a.eq_ignore_ascii_case(&b))
}

/// Read a `url(...)`/`format(...)` argument starting at `start` (the first char
/// after the opening `(`, with leading whitespace already skipped). Returns the
/// raw token — including surrounding quotes for the quoted forms, matching the
/// regex capture groups in the TS `parseSrcUrl` — and the index just past the
/// closing `)`.
fn read_paren_arg(cs: &[char], start: usize) -> (String, usize) {
    let n = cs.len();
    if start < n && (cs[start] == '"' || cs[start] == '\'') {
        let quote = cs[start];
        let mut end = start + 1;
        while end < n && cs[end] != quote {
            end += 1;
        }
        // Token includes both quotes (or runs to end-of-input if unterminated).
        let close = if end < n { end } else { n - 1 };
        let token: String = cs[start..=close].iter().collect();
        let mut after = if end < n { end + 1 } else { end };
        while after < n && cs[after].is_whitespace() {
            after += 1;
        }
        if after < n && cs[after] == ')' {
            after += 1;
        }
        (token, after)
    } else {
        let mut end = start;
        while end < n && cs[end] != ')' {
            end += 1;
        }
        let token: String = cs[start..end].iter().collect();
        let after = if end < n { end + 1 } else { end };
        (token, after)
    }
}

/// Extract the font URL from a `src` descriptor, preferring woff2 sources —
/// the CPU mirror of the TS `parseSrcUrl` regex scan.
fn parse_src_url(src: &str) -> Option<String> {
    let cs: Vec<char> = src.chars().collect();
    let n = cs.len();
    // (url token, optional format token) per source.
    let mut sources: Vec<(String, Option<String>)> = Vec::new();
    let mut i = 0;
    while i < n {
        if i + 4 <= n && eq_ignore_case(&cs[i..i + 3], "url") && cs[i + 3] == '(' {
            let mut j = i + 4;
            while j < n && cs[j].is_whitespace() {
                j += 1;
            }
            let (url_token, after_url) = read_paren_arg(&cs, j);
            i = after_url;

            // Optional `format(...)` immediately after.
            let mut k = i;
            while k < n && cs[k].is_whitespace() {
                k += 1;
            }
            let mut format_token = None;
            if k + 7 <= n && eq_ignore_case(&cs[k..k + 6], "format") && cs[k + 6] == '(' {
                let mut p = k + 7;
                while p < n && cs[p].is_whitespace() {
                    p += 1;
                }
                let (fmt, after_fmt) = read_paren_arg(&cs, p);
                format_token = Some(fmt);
                i = after_fmt;
            }
            sources.push((url_token, format_token));
        } else {
            i += 1;
        }
    }

    if sources.is_empty() {
        return None;
    }
    let chosen = sources
        .iter()
        .find(|(_, fmt)| {
            fmt.as_deref()
                .is_some_and(|f| strip_quotes(f.trim()).eq_ignore_ascii_case("woff2"))
        })
        .unwrap_or(&sources[0]);
    Some(strip_quotes(chosen.0.trim()))
}

/// Remove CSS block comments (`/* ... */`), matching the non-greedy TS regex.
/// An unterminated comment is left untouched (the TS regex needs a closing `*/`).
fn strip_comments(css: &str) -> String {
    let cs: Vec<char> = css.chars().collect();
    let n = cs.len();
    let mut out = String::with_capacity(css.len());
    let mut i = 0;
    while i < n {
        if i + 1 < n && cs[i] == '/' && cs[i + 1] == '*' {
            let mut j = i + 2;
            while j + 1 < n && !(cs[j] == '*' && cs[j + 1] == '/') {
                j += 1;
            }
            if j + 1 < n {
                i = j + 2;
                continue;
            }
            // No closing `*/`: leave the rest as-is.
        }
        out.push(cs[i]);
        i += 1;
    }
    out
}

/// Parse a single `@font-face` block body (the text between `{` and `}`) into its
/// descriptors.
fn parse_block_body(body: &str) -> FontFaceBlock {
    let mut block = FontFaceBlock::default();
    for declaration in body.split(';') {
        let Some(colon) = declaration.find(':') else {
            continue;
        };
        let property = declaration[..colon].trim().to_ascii_lowercase();
        let value = declaration[colon + 1..].trim();
        match property.as_str() {
            "font-family" => block.font_family = Some(strip_quotes(value)),
            "font-style" => block.font_style = Some(value.to_string()),
            "font-weight" => block.font_weight = Some(value.to_string()),
            "src" => block.src = Some(value.to_string()),
            "unicode-range" => block.unicode_range = Some(value.to_string()),
            _ => {}
        }
    }
    block
}

/// Extract every `@font-face { ... }` block, mirroring the TS
/// `@font-face\s*\{([^}]*)\}` scan (comments stripped first).
fn parse_font_face_blocks(css_text: &str) -> Vec<FontFaceBlock> {
    let without_comments = strip_comments(css_text);
    let cs: Vec<char> = without_comments.chars().collect();
    let n = cs.len();
    const NEEDLE: &str = "@font-face";
    let mut blocks = Vec::new();
    let mut i = 0;
    while i < n {
        if i + NEEDLE.len() <= n && eq_ignore_case(&cs[i..i + NEEDLE.len()], NEEDLE) {
            let mut j = i + NEEDLE.len();
            while j < n && cs[j].is_whitespace() {
                j += 1;
            }
            if j < n && cs[j] == '{' {
                let start = j + 1;
                let mut end = start;
                while end < n && cs[end] != '}' {
                    end += 1;
                }
                let body: String = cs[start..end].iter().collect();
                blocks.push(parse_block_body(&body));
                i = if end < n { end + 1 } else { n };
                continue;
            }
        }
        i += 1;
    }
    blocks
}

/// Normalize a CSS descriptor value for comparison: whitespace is collapsed and
/// case is folded (CSS keywords are case-insensitive, and ranges like `"100 900"`
/// vary only in spacing).
fn normalize_css_value(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_lowercase()
}

/// Render a numeric `font-weight` filter the way TS `String(number)` would, so
/// `800` compares equal to a `"800"` descriptor.
fn number_to_string(value: f64) -> String {
    // Rust's `{}` for f64 omits a trailing `.0` (e.g. `800.0` -> "800"), matching
    // JS `String(800)`.
    format!("{value}")
}

fn matches_filter(block: &FontFaceBlock, options: &ParseOptions) -> bool {
    if let Some(filter) = &options.font_family {
        let wanted: Vec<String> = match filter {
            FontFamilyFilter::One(name) => vec![name.clone()],
            FontFamilyFilter::Many(names) => names.clone(),
        };
        let name = block.font_family.as_deref().map(str::to_ascii_lowercase);
        if !wanted.iter().any(|w| Some(w.to_ascii_lowercase()) == name) {
            return false;
        }
    }
    if let Some(filter) = &options.font_weight {
        let wanted = match filter {
            FontWeightFilter::Text(text) => text.clone(),
            FontWeightFilter::Number(number) => number_to_string(*number),
        };
        if normalize_css_value(block.font_weight.as_deref().unwrap_or(""))
            != normalize_css_value(&wanted)
        {
            return false;
        }
    }
    if let Some(filter) = &options.font_style
        && normalize_css_value(block.font_style.as_deref().unwrap_or(""))
            != normalize_css_value(filter)
    {
        return false;
    }
    true
}

/// Resolve a possibly-relative `src` URL against `base_url`, mirroring
/// `new URL(raw, base)`. Falls back to the raw URL if resolution fails.
fn resolve_url(base_url: &str, raw_url: &str) -> String {
    Url::parse(base_url)
        .and_then(|base| base.join(raw_url))
        .map(|resolved| resolved.to_string())
        .unwrap_or_else(|_| raw_url.to_string())
}

/// Parse a CSS `unicode-range` descriptor value (e.g. `"U+0-7F, U+131, U+4??"`)
/// into inclusive codepoint ranges. Supports single codepoints (`U+26`),
/// intervals (`U+0102-0103`) and wildcards (`U+4??`). Returns an error message
/// for any malformed token (the TS version throws the identical string).
pub fn parse_css_unicode_range(value: &str) -> Result<Vec<UnicodeRange>, String> {
    let mut ranges = Vec::new();
    for token in value.split(',') {
        let trimmed = token.trim();
        if trimmed.is_empty() {
            continue;
        }
        let range = parse_unicode_token(trimmed)
            .filter(|r| r.from <= r.to && r.to <= MAX_CODEPOINT)
            .ok_or_else(|| format!("Invalid unicode-range token: \"{trimmed}\""))?;
        ranges.push(range);
    }
    Ok(ranges)
}

/// Parse one already-trimmed `unicode-range` token. Returns `None` for anything
/// the TS regex `^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$` would reject; range
/// validity (`from <= to`, `to <= MAX`) is checked by the caller.
fn parse_unicode_token(token: &str) -> Option<UnicodeRange> {
    let lower = token.to_ascii_lowercase();
    let rest = lower.strip_prefix("u+")?;
    let mut parts = rest.splitn(2, '-');
    let start = parts.next()?;
    let end = parts.next();

    if start.is_empty()
        || start.len() > 6
        || !start.chars().all(|c| c.is_ascii_hexdigit() || c == '?')
    {
        return None;
    }
    if let Some(end) = end {
        // The end of a range is a plain hex codepoint — no wildcard, no extra `-`.
        if end.is_empty() || end.len() > 6 || !end.chars().all(|c| c.is_ascii_hexdigit()) {
            return None;
        }
    }

    if start.contains('?') {
        // Wildcard form: `U+4??` means U+400-4FF, and cannot carry an explicit end.
        if end.is_some() {
            return None;
        }
        let from = u32::from_str_radix(&start.replace('?', "0"), 16).ok()?;
        let to = u32::from_str_radix(&start.replace('?', "f"), 16).ok()?;
        Some(UnicodeRange { from, to })
    } else {
        let from = u32::from_str_radix(start, 16).ok()?;
        let to = match end {
            Some(end) => u32::from_str_radix(end, 16).ok()?,
            None => from,
        };
        Some(UnicodeRange { from, to })
    }
}

/// Build a [`FontFamily`] from CSS `@font-face` rules. Each matching block with a
/// resolvable `src` becomes one face; blocks without a `unicode-range` cover all
/// codepoints. Faces come out in reverse stylesheet order (CSS gives later rules
/// precedence on range overlap); an array `font_family` filter overrides that
/// with the caller's requested family order. Returns an error when no block
/// matches.
fn parse_font_family_from_css(
    family: &str,
    css_text: &str,
    options: &ParseOptions,
) -> Result<FontFamily, String> {
    // (face, lowercased css font-family) pairs, kept together for priority sorting.
    let mut faces: Vec<(FontFace, String)> = Vec::new();
    for block in parse_font_face_blocks(css_text) {
        if !matches_filter(&block, options) {
            continue;
        }
        let Some(src) = &block.src else { continue };
        let Some(raw_url) = parse_src_url(src) else {
            continue;
        };
        let url = match &options.base_url {
            Some(base_url) => resolve_url(base_url, &raw_url),
            None => raw_url,
        };
        let unicode_ranges = match &block.unicode_range {
            Some(range) => parse_css_unicode_range(range)?,
            None => full_range(),
        };
        let css_family = block
            .font_family
            .as_deref()
            .unwrap_or("")
            .to_ascii_lowercase();
        faces.push((
            FontFace {
                url,
                unicode_ranges,
            },
            css_family,
        ));
    }

    if faces.is_empty() {
        return Err(format!(
            "parseFontFamilyFromCss: no @font-face rules matched for family \"{family}\""
        ));
    }

    // CSS gives LATER @font-face rules precedence when their unicode-ranges
    // overlap, so reverse the block order (see the TS doc-comment for the Google
    // Fonts latin/latin-ext example).
    faces.reverse();

    if let Some(FontFamilyFilter::Many(list)) = &options.font_family {
        // Some stylesheets (e.g. the Google Fonts CSS API) order @font-face blocks
        // alphabetically, so restore the priority the caller asked for. Families
        // absent from the list rank last. `sort_by_key` is stable, preserving
        // within-family (reversed stylesheet) order.
        let priority: Vec<String> = list.iter().map(|name| name.to_ascii_lowercase()).collect();
        let rank = |css_family: &str| {
            priority
                .iter()
                .position(|name| name == css_family)
                .unwrap_or(priority.len())
        };
        faces.sort_by_key(|a| rank(&a.1));
    }

    Ok(FontFamily {
        family: family.to_string(),
        faces: faces.into_iter().map(|(face, _)| face).collect(),
    })
}

// ---------------------------------------------------------------------------
// wasm-bindgen entry points. These return plain JS objects/arrays (via
// serde-wasm-bindgen), not wasm-bindgen classes, per guide/WASM_API_POLICY.md —
// so callers need no `.free()`.
// ---------------------------------------------------------------------------

#[wasm_bindgen(js_name = parseCssUnicodeRange)]
pub fn parse_css_unicode_range_js(value: &str) -> Result<JsValue, JsError> {
    let ranges = parse_css_unicode_range(value).map_err(|message| JsError::new(&message))?;
    serde_wasm_bindgen::to_value(&ranges).map_err(|error| JsError::new(&error.to_string()))
}

#[wasm_bindgen(js_name = parseFontFamilyFromCss)]
pub fn parse_font_family_from_css_js(
    family: &str,
    css_text: &str,
    options: JsValue,
) -> Result<JsValue, JsError> {
    let options: ParseOptions = if options.is_undefined() || options.is_null() {
        ParseOptions::default()
    } else {
        serde_wasm_bindgen::from_value(options).map_err(|error| JsError::new(&error.to_string()))?
    };
    let family = parse_font_family_from_css(family, css_text, &options)
        .map_err(|message| JsError::new(&message))?;
    serde_wasm_bindgen::to_value(&family).map_err(|error| JsError::new(&error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn range(from: u32, to: u32) -> UnicodeRange {
        UnicodeRange { from, to }
    }

    // Trimmed-down Google Fonts CSS API response, matching the TS test fixture:
    // two subsets of one family plus a second family, each with its own range.
    const GOOGLE_FONTS_CSS: &str = r#"
/* vietnamese */
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 800;
  font-stretch: 125%;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/archivo/v25/viet.woff2) format('woff2');
  unicode-range: U+0102-0103, U+0110-0111, U+1EA0-1EF9, U+20AB;
}
/* latin */
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 800;
  font-stretch: 125%;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/archivo/v25/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+2000-206F;
}
/* [58] */
@font-face {
  font-family: 'Noto Sans JP';
  font-style: normal;
  font-weight: 800;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/notosansjp/v56/slice.58.woff2) format('woff2');
  unicode-range: U+4E00-4EFF;
}
"#;

    // --- parse_css_unicode_range ------------------------------------------

    #[test]
    fn parses_single_intervals_and_wildcards() {
        assert_eq!(
            parse_css_unicode_range("U+26").unwrap(),
            vec![range(0x26, 0x26)]
        );
        assert_eq!(
            parse_css_unicode_range("U+0102-0103, U+20AB").unwrap(),
            vec![range(0x102, 0x103), range(0x20ab, 0x20ab)]
        );
        assert_eq!(
            parse_css_unicode_range("U+4??").unwrap(),
            vec![range(0x400, 0x4ff)]
        );
        assert_eq!(
            parse_css_unicode_range("u+1ea0-1ef9").unwrap(),
            vec![range(0x1ea0, 0x1ef9)]
        );
    }

    #[test]
    fn rejects_malformed_tokens() {
        assert!(parse_css_unicode_range("0102-0103").is_err());
        assert!(parse_css_unicode_range("U+GGGG").is_err());
        assert!(parse_css_unicode_range("U+4??-4FF").is_err());
    }

    #[test]
    fn rejects_reversed_ranges() {
        assert!(parse_css_unicode_range("U+200-100").is_err());
    }

    #[test]
    fn rejects_codepoints_beyond_max() {
        assert!(parse_css_unicode_range("U+110000").is_err());
        assert!(parse_css_unicode_range("U+10FFFF-110000").is_err());
        assert!(parse_css_unicode_range("U+??????").is_err());
        assert_eq!(
            parse_css_unicode_range("U+10FFFF").unwrap(),
            vec![range(0x10ffff, 0x10ffff)]
        );
    }

    // --- parse_font_family_from_css ---------------------------------------

    fn options() -> ParseOptions {
        ParseOptions::default()
    }

    #[test]
    fn builds_one_face_per_block_in_reverse_order() {
        let family = parse_font_family_from_css("labels", GOOGLE_FONTS_CSS, &options()).unwrap();
        assert_eq!(family.family, "labels");
        assert_eq!(family.faces.len(), 3);
        assert!(family.faces[0].url.contains("notosansjp"));
        assert_eq!(
            family.faces[1],
            FontFace {
                url: "https://fonts.gstatic.com/s/archivo/v25/latin.woff2".to_string(),
                unicode_ranges: vec![range(0x0, 0xff), range(0x2000, 0x206f)],
            }
        );
        assert!(family.faces[2].url.contains("viet"));
    }

    #[test]
    fn routes_overlap_declared_codepoints_to_later_block() {
        let css = r"
            @font-face { font-family: A; font-style: normal; font-weight: 800; src: url(latin-ext.woff2); unicode-range: U+0100-024F; }
            @font-face { font-family: A; font-style: normal; font-weight: 800; src: url(latin.woff2); unicode-range: U+0000-00FF, U+0131; }
        ";
        let family = parse_font_family_from_css("labels", css, &options()).unwrap();
        let urls: Vec<&str> = family.faces.iter().map(|f| f.url.as_str()).collect();
        assert_eq!(urls, vec!["latin.woff2", "latin-ext.woff2"]);
    }

    #[test]
    fn filters_by_font_family_name() {
        let opts = ParseOptions {
            font_family: Some(FontFamilyFilter::One("Noto Sans JP".to_string())),
            ..Default::default()
        };
        let family = parse_font_family_from_css("labels", GOOGLE_FONTS_CSS, &opts).unwrap();
        assert_eq!(family.faces.len(), 1);
        assert!(family.faces[0].url.contains("notosansjp"));
    }

    #[test]
    fn orders_faces_by_font_family_array_position() {
        let opts = ParseOptions {
            font_family: Some(FontFamilyFilter::Many(vec![
                "Noto Sans JP".to_string(),
                "Archivo".to_string(),
            ])),
            ..Default::default()
        };
        let family = parse_font_family_from_css("labels", GOOGLE_FONTS_CSS, &opts).unwrap();
        let urls: Vec<&str> = family.faces.iter().map(|f| f.url.as_str()).collect();
        assert_eq!(
            urls,
            vec![
                "https://fonts.gstatic.com/s/notosansjp/v56/slice.58.woff2",
                "https://fonts.gstatic.com/s/archivo/v25/latin.woff2",
                "https://fonts.gstatic.com/s/archivo/v25/viet.woff2",
            ]
        );
    }

    #[test]
    fn filters_by_weight_and_style() {
        let css = r"
            @font-face { font-family: A; font-style: italic; font-weight: 400; src: url(a-italic.woff2); }
            @font-face { font-family: A; font-style: normal; font-weight: 700; src: url(a-bold.woff2); }
        ";
        let opts = ParseOptions {
            font_style: Some("normal".to_string()),
            font_weight: Some(FontWeightFilter::Number(700.0)),
            ..Default::default()
        };
        let family = parse_font_family_from_css("labels", css, &opts).unwrap();
        assert_eq!(family.faces.len(), 1);
        assert_eq!(family.faces[0].url, "a-bold.woff2");
    }

    #[test]
    fn normalizes_whitespace_and_case_in_filters() {
        let css = r"@font-face { font-family: A; font-style: normal; font-weight: 100  900; src: url(a-var.woff2); }";
        let opts = ParseOptions {
            font_style: Some("Normal".to_string()),
            font_weight: Some(FontWeightFilter::Text(" 100 900 ".to_string())),
            ..Default::default()
        };
        let family = parse_font_family_from_css("labels", css, &opts).unwrap();
        assert_eq!(family.faces.len(), 1);
        assert_eq!(family.faces[0].url, "a-var.woff2");
    }

    #[test]
    fn covers_all_codepoints_without_unicode_range() {
        let css = "@font-face { font-family: A; src: url(a.woff2); }";
        let family = parse_font_family_from_css("labels", css, &options()).unwrap();
        assert_eq!(
            family.faces[0].unicode_ranges,
            vec![range(0, MAX_CODEPOINT)]
        );
    }

    #[test]
    fn resolves_relative_src_against_base_url() {
        let css =
            "@font-face { font-family: A; src: url(./fonts/a.woff2); unicode-range: U+0-7F; }";
        let opts = ParseOptions {
            base_url: Some("https://example.com/styles/fonts.css".to_string()),
            ..Default::default()
        };
        let family = parse_font_family_from_css("labels", css, &opts).unwrap();
        assert_eq!(
            family.faces[0].url,
            "https://example.com/styles/fonts/a.woff2"
        );
    }

    #[test]
    fn prefers_woff2_source() {
        let css = r#"@font-face {
            font-family: A;
            src: url("a.eot") format("embedded-opentype"), url('a.woff2') format('woff2'), url(a.ttf) format(truetype);
        }"#;
        let family = parse_font_family_from_css("labels", css, &options()).unwrap();
        assert_eq!(family.faces[0].url, "a.woff2");
    }

    #[test]
    fn errors_when_no_block_matches() {
        let opts = ParseOptions {
            font_family: Some(FontFamilyFilter::One("Nope".to_string())),
            ..Default::default()
        };
        let error = parse_font_family_from_css("labels", GOOGLE_FONTS_CSS, &opts).unwrap_err();
        assert!(error.contains("no @font-face rules matched"));
    }
}
