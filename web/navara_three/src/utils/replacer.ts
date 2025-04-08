/**
 * Replaces a substring in a string and throws an error if the replacement didn't occur.
 * This is useful for shader code replacements where silent failures can be hard to debug.
 *
 * @param source - The source string to perform replacement on
 * @param search - The substring or regex to search for
 * @param replace - The string to replace the search substring with
 * @param errorMessage - Optional custom error message
 * @returns The string with replacements applied
 * @throws Error if the search string/pattern was not found in the source
 */
export function replaceOrThrow(
  source: string,
  search: string | RegExp,
  replace: string,
  errorMessage?: string,
): string {
  // Check if the pattern exists in the source
  if (source.split(search).length === 1) {
    throw new Error(
      errorMessage ||
        `Failed to replace "${search}" in shader code. The pattern was not found.`,
    );
  }

  // Perform the replacement
  return source.replace(search, replace);
}

/**
 * A class for chaining string replacements with error detection.
 * This allows for a more functional programming style with method chaining.
 * This implementation is free of side effects - each method returns a new instance.
 */
export class Replacer {
  readonly source: string;

  /**
   * Creates a new Replacer instance
   *
   * @param source - The source string to perform replacements on
   */
  constructor(source: string) {
    this.source = source;
  }

  /**
   * Replaces a substring in the source string and throws an error if the replacement didn't occur.
   * Returns a new Replacer instance with the updated string.
   *
   * @param search - The substring or regex to search for
   * @param replace - The string to replace the search substring with
   * @param errorMessage - Optional custom error message
   * @returns A new Replacer instance with the updated string
   * @throws Error if the search string/pattern was not found in the source
   */
  replace(
    search: string | RegExp,
    replace: string,
    errorMessage?: string,
  ): Replacer {
    const newSource = replaceOrThrow(
      this.source,
      search,
      replace,
      errorMessage,
    );
    return new Replacer(newSource);
  }
}

/**
 * Creates a new Replacer instance for chaining string replacements
 *
 * @param source - The source string to perform replacements on
 * @returns A new Replacer instance
 */
export function createReplacer(source: string): Replacer {
  return new Replacer(source);
}
