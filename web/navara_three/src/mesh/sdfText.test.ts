import { GlyphCharClass, type ShapedGlyph } from "@navaramap/font";
import { describe, expect, it } from "vitest";

import { breakLines, isRtlText, lineWidthFu } from "./sdfText";

/** Build a glyph run from a compact spec: one entry per glyph. */
function glyphs(
  spec: { advance?: number; cls?: number }[],
  defaultAdvance = 100,
): ShapedGlyph[] {
  return spec.map((s, i) => ({
    glyphId: i + 1,
    fontIndex: 0,
    compositeKey: BigInt(i + 1),
    xAdvance: s.advance ?? defaultAdvance,
    yAdvance: 0,
    xOffset: 0,
    yOffset: 0,
    charClass: s.cls ?? GlyphCharClass.Normal,
  }));
}

/** "ab cd" style shorthand: space → whitespace, "\n" → newline marker,
 *  "国" (any non-ASCII) → ideographic; everything else normal. */
function fromText(text: string, advance = 100): ShapedGlyph[] {
  return glyphs(
    [...text].map((ch) => ({
      advance: ch === "\n" ? 0 : advance,
      cls:
        ch === "\n"
          ? GlyphCharClass.Newline
          : ch === " "
            ? GlyphCharClass.Whitespace
            : ch.charCodeAt(0) > 127
              ? GlyphCharClass.Ideographic
              : GlyphCharClass.Normal,
    })),
  );
}

describe("breakLines", () => {
  it("keeps a run without breaks on a single line", () => {
    const lines = breakLines(fromText("abc"), 0);
    expect(lines.length).toBe(1);
    expect(lines[0].length).toBe(3);
  });

  it("splits at newline markers and drops the marker glyph", () => {
    const lines = breakLines(fromText("ab\ncd\nef"), 0);
    expect(lines.map((l) => l.length)).toEqual([2, 2, 2]);
    for (const line of lines) {
      expect(line.every((g) => g.charClass !== GlyphCharClass.Newline)).toBe(
        true,
      );
    }
  });

  it("preserves empty lines from consecutive newlines", () => {
    const lines = breakLines(fromText("a\n\nb"), 0);
    expect(lines.map((l) => l.length)).toEqual([1, 0, 1]);
  });

  it("does not wrap when maxWidth is 0", () => {
    const lines = breakLines(fromText("aa bb cc dd"), 0);
    expect(lines.length).toBe(1);
  });

  it("wraps at whitespace when a line exceeds maxWidth", () => {
    // Each glyph is 100 wide; "aa bb" fits in 500 but "aa bb cc" does not.
    const lines = breakLines(fromText("aa bb cc"), 500);
    expect(lines.length).toBe(2);
    // The wrap point's whitespace is dropped from both line ends.
    expect(lines[0].length).toBe(5); // "aa bb"
    expect(lines[1].length).toBe(2); // "cc"
  });

  it("drops the whitespace glyph at the wrap point", () => {
    const lines = breakLines(fromText("aa bb"), 300);
    expect(lines.length).toBe(2);
    expect(
      lines.flat().every((g) => g.charClass !== GlyphCharClass.Whitespace),
    ).toBe(true);
  });

  it("lets a word longer than maxWidth overflow instead of breaking mid-word", () => {
    const lines = breakLines(fromText("aaaaaa"), 300);
    expect(lines.length).toBe(1);
    expect(lines[0].length).toBe(6);
  });

  it("wraps after ideographic glyphs without whitespace", () => {
    const lines = breakLines(fromText("国国国国"), 250);
    expect(lines.length).toBe(2);
    expect(lines.map((l) => l.length)).toEqual([2, 2]);
  });

  it("combines hard breaks with soft wrapping", () => {
    const lines = breakLines(fromText("aa bb\ncc"), 300);
    expect(lines.map((l) => l.length)).toEqual([2, 2, 2]);
  });

  describe("rtl", () => {
    /** RTL glyph runs arrive in visual order = reversed logical order.
     *  Build from logical text, then reverse (per hard-break segment). */
    function rtlFromText(text: string, advance = 100): ShapedGlyph[] {
      const out: ShapedGlyph[] = [];
      let segment: ShapedGlyph[] = [];
      for (const g of fromText(text, advance)) {
        if (g.charClass === GlyphCharClass.Newline) {
          out.push(...segment.reverse(), g);
          segment = [];
        } else {
          segment.push(g);
        }
      }
      out.push(...segment.reverse());
      return out;
    }

    it("stacks wrapped lines in logical (reading) order, top to bottom", () => {
      // Logical "aa bb cc" with glyphIds 1..8; visual stream is reversed.
      const lines = breakLines(rtlFromText("aa bb cc"), 500, true);
      expect(lines.length).toBe(2);
      // Top line holds the logical start ("aa bb"), in visual order.
      expect(lines[0].map((g) => g.glyphId)).toEqual([5, 4, 3, 2, 1]);
      expect(lines[1].map((g) => g.glyphId)).toEqual([8, 7]);
    });

    it("fills lines greedily from the logical start", () => {
      // Five words, two per line: 2-2-1, not 1-2-2.
      const lines = breakLines(rtlFromText("a b c d e"), 300, true);
      expect(lines.map((l) => l.length)).toEqual([3, 3, 1]);
      expect(lines[2].map((g) => g.glyphId)).toEqual([9]); // logical last word
    });

    it("keeps hard-break segments in logical order", () => {
      const lines = breakLines(rtlFromText("aa\nbb"), 0, true);
      expect(lines.map((l) => l.map((g) => g.glyphId))).toEqual([
        [2, 1],
        [5, 4],
      ]);
    });

    it("matches LTR output for a single unwrapped line", () => {
      const lines = breakLines(rtlFromText("abc"), 0, true);
      expect(lines.length).toBe(1);
      expect(lines[0].map((g) => g.glyphId)).toEqual([3, 2, 1]);
    });
  });
});

describe("isRtlText", () => {
  it("detects Arabic", () => {
    expect(isRtlText("شارع الملك")).toBe(true);
  });

  it("detects Hebrew", () => {
    expect(isRtlText("רחוב")).toBe(true);
  });

  it("is false for Latin", () => {
    expect(isRtlText("Main St")).toBe(false);
  });

  it("is false for CJK", () => {
    expect(isRtlText("東京都")).toBe(false);
  });

  it("uses the first strong character in mixed text", () => {
    expect(isRtlText("Cafe شارع")).toBe(false);
    expect(isRtlText("شارع Cafe")).toBe(true);
  });

  it("skips leading digits and punctuation", () => {
    expect(isRtlText("12 - شارع")).toBe(true);
  });

  it("is false for empty or neutral-only text", () => {
    expect(isRtlText("")).toBe(false);
    expect(isRtlText("123 !?")).toBe(false);
  });
});

describe("lineWidthFu", () => {
  it("sums advances", () => {
    expect(lineWidthFu(fromText("abc"))).toBe(300);
  });

  it("ignores trailing whitespace", () => {
    expect(lineWidthFu(fromText("ab  "))).toBe(200);
  });

  it("counts interior whitespace", () => {
    expect(lineWidthFu(fromText("a b"))).toBe(300);
  });

  it("is 0 for an empty line", () => {
    expect(lineWidthFu([])).toBe(0);
  });
});
