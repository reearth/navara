import { expect, test } from "vitest";

import { Replacer, createReplacer } from "./replacer";

test("Replacer should allow method chaining with side-effect free implementation", () => {
  const source = "Hello, world! Hello, universe!";

  // String replacements
  const result1 = createReplacer(source)
    .replace("world", "earth")
    .replace("universe", "galaxy").source;
  expect(result1).toBe("Hello, earth! Hello, galaxy!");

  // RegExp replacements
  const result2 = createReplacer(source)
    .replace(/world/, "earth")
    .replace(/universe/, "galaxy").source;
  expect(result2).toBe("Hello, earth! Hello, galaxy!");

  // Error case
  expect(() =>
    createReplacer("Hello, world!").replace(
      "universe",
      "galaxy",
      "Custom Error",
    ),
  ).toThrow("Custom Error");

  // Multiple replacements
  const result3 = createReplacer(source)
    .replace("Hello", "Hi")
    .replace("world", "earth")
    .replace("Hello", "Hi")
    .replace("universe", "galaxy").source;
  expect(result3).toBe("Hi, earth! Hi, galaxy!");

  // Verify source property
  const replacer = createReplacer("Hello, world!");
  expect(replacer).toBeInstanceOf(Replacer);
  expect(replacer.source).toBe("Hello, world!");
  expect(replacer.source).toBe("Hello, world!");
});
