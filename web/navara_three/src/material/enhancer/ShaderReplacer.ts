import { replaceOrThrow } from "../../utils/replacer";

/**
 * Common type for organizing shader markers by shader stage.
 */
export type ShaderMarkers = {
  readonly vertex: Record<string, string>;
  readonly fragment: Record<string, string>;
};

type PickMarker<Markers extends ShaderMarkers, Key extends keyof Markers> = {
  [VK in keyof Markers[Key]]: Markers[Key][VK];
}[keyof Markers[Key]];

type PickMarkers<Markers extends ShaderMarkers> =
  | PickMarker<Markers, "vertex">
  | PickMarker<Markers, "fragment">;

/**
 * A type-safe shader string replacer that restricts operations to declared markers.
 *
 * Each enhancer level declares its own markers and exposes a factory function
 * that returns a ShaderReplacer typed to those markers. Composing enhancers
 * use the parent's factory to safely modify shader code at known insertion points.
 *
 * @template Markers - Union of allowed marker strings
 */
export class ShaderReplacer<
  AllMarkers extends ShaderMarkers,
  Markers extends string = PickMarkers<AllMarkers>,
> {
  private _source: string;

  constructor(source: string) {
    this._source = source;
  }

  get source(): string {
    return this._source;
  }

  /**
   * Insert code before the target marker.
   * The target marker is preserved.
   */
  insertBefore(marker: Markers, code: string): this {
    this._source = replaceOrThrow(this._source, marker, `${code}\n${marker}`);
    return this;
  }

  /**
   * Insert code after the target marker.
   * The target marker is preserved.
   */
  insertAfter(marker: Markers, code: string): this {
    this._source = replaceOrThrow(this._source, marker, `${marker}\n${code}`);
    return this;
  }

  /**
   * Replace the content between start and end markers with the given code.
   * The markers themselves are preserved.
   */
  replaceBlock(
    position: { readonly start: Markers; readonly end: Markers },
    code: string,
  ): this {
    const { start, end } = position;

    const startIdx = this._source.indexOf(start);
    if (startIdx === -1) {
      throw new Error(`Failed to find start marker "${start}" in shader code.`);
    }
    const endIdx = this._source.indexOf(end);
    if (endIdx === -1) {
      throw new Error(`Failed to find end marker "${end}" in shader code.`);
    }
    this._source =
      this._source.substring(0, startIdx) +
      start +
      "\n" +
      code +
      "\n" +
      end +
      this._source.substring(endIdx + end.length);
    return this;
  }
}

/**
 * Create a ShaderReplacer typed to the given marker union.
 */
export function createShaderReplacer<AllMarkers extends ShaderMarkers>(
  source: string,
) {
  return new ShaderReplacer<AllMarkers>(source);
}
