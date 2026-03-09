import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import { Browser, Page, chromium } from "playwright";
import invariant from "tiny-invariant";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ScreenshotConfig = {
  viewport: { width: number; height: number };
  outputDir: string;
  serverUrl: string;
  timeout: number;
  retries: number;
  parallel: number;
};

type PageScreenshotResult = {
  page: string;
  path: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
};

type PageConfig = {
  waitTime?: number;
};

const DEFAULT_CONFIG: ScreenshotConfig = {
  viewport: { width: 400 * 3, height: 250 * 3 },
  outputDir: path.join(__dirname, "../example/public/screenshots"),
  serverUrl: process.env.SERVER_URL || "http://localhost:5173",
  timeout: 300000,
  retries: 2,
  parallel: 1,
};

const PAGE_CONFIGS: Record<string, PageConfig> = {
  atmosphere: {
    waitTime: 10000,
  },
  "cloud-fog": {
    waitTime: 10000,
  },
  "custom-shader": {
    waitTime: 10000,
  },
  night: {
    waitTime: 10000,
  },
  weather: {
    waitTime: 40000,
  },
  "water-reflection": {
    waitTime: 10000,
  },
  "use-cases-photorealistic": {
    waitTime: 50000,
  },
};

class ScreenshotGenerator {
  private config: ScreenshotConfig;
  private browser: Browser | null = null;
  private targetPages: string[] | null = null;

  constructor(config: Partial<ScreenshotConfig> = {}, targetPages?: string[]) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.targetPages = targetPages || null;
  }

  async initialize(): Promise<void> {
    // Check if server is running
    try {
      const response = await fetch(`${this.config.serverUrl}/index.html`);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
    } catch (_err) {
      console.error(`❌ Dev server is not running at ${this.config.serverUrl}`);
      console.error("Please start the dev server with: pnpm run dev");
      process.exit(1);
    }

    // Create output directory
    await fs.mkdir(this.config.outputDir, { recursive: true });

    // Launch browser with WebGL support
    this.browser = await chromium.launch({
      args: ["--ignore-gpu-blocklist", "--use-gl=angle"],
    });
  }

  /**
   * Recursively discover example pages in nested directories.
   * A directory is considered a page if it contains a main.ts file.
   */
  async discoverPagesRecursive(
    baseDir: string,
    prefix = "",
  ): Promise<string[]> {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const pages: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
      const hasFiles = subEntries.some((e) => e.isFile());

      if (hasFiles) {
        // This is a page directory
        const pageName = prefix ? `${prefix}-${entry.name}` : entry.name;
        pages.push(pageName);
      } else {
        // This is a category directory, recurse
        const nestedPages = await this.discoverPagesRecursive(
          fullPath,
          prefix ? `${prefix}-${entry.name}` : entry.name,
        );
        pages.push(...nestedPages);
      }
    }

    return pages;
  }

  async discoverPages(): Promise<string[]> {
    const pagesDir = path.join(__dirname, "../example/pages");
    const pages = (await this.discoverPagesRecursive(pagesDir)).sort();

    // If specific pages are requested, validate and return them
    if (this.targetPages && this.targetPages.length > 0) {
      // Validate requested pages exist
      const invalidPages = this.targetPages.filter(
        (page) => !pages.includes(page),
      );
      if (invalidPages.length > 0) {
        console.error(`❌ Invalid page(s): ${invalidPages.join(", ")}`);
        console.log(`Available pages: ${pages.join(", ")}`);
        process.exit(1);
      }

      console.log(
        `📂 Targeting ${this.targetPages.length} specific page(s): ${this.targetPages.join(", ")}`,
      );
      return this.targetPages;
    }

    console.log(`📂 Found ${pages.length} WebGL example pages to capture`);
    return pages;
  }

  async waitForWebGL(page: Page, config: PageConfig = {}): Promise<void> {
    try {
      // Wait for canvas element to appear with longer timeout
      await page.waitForSelector("canvas", { timeout: 100000 });
      console.log("✓ Canvas found");

      // Give WebGL time to initialize
      await page.waitForTimeout(3000);

      // Try to wait for WebGL context and content
      try {
        await page.waitForFunction(
          () => {
            const canvas = document.querySelector("canvas");
            if (!canvas) return false;

            // Check if canvas has reasonable dimensions
            const hasSize = canvas.width > 0 && canvas.height > 0;

            // Try to check if there's actual WebGL rendering
            const gl =
              canvas.getContext("webgl") || canvas.getContext("webgl2");
            const hasContext = gl !== null;

            return hasSize && hasContext;
          },
          { timeout: 10000 },
        );
        console.log("✓ WebGL context ready");
      } catch {
        // Canvas exists but might not be fully initialized yet
        console.log("⚠️  WebGL context check timed out, proceeding anyway");
      }
    } catch (_err) {
      console.log("⚠️  No canvas found, page might use different rendering");
      // Still wait a bit for page to stabilize
      await page.waitForTimeout(2000);
    }

    // Apply page-specific wait time if configured
    if (config.waitTime) {
      await page.waitForTimeout(config.waitTime);
    } else {
      // Default wait for rendering to stabilize
      await page.waitForTimeout(3000);
    }
  }

  async captureScreenshot(pageName: string): Promise<PageScreenshotResult> {
    const startTime = Date.now();
    const pageConfig = PAGE_CONFIGS[pageName] || {};
    const viewport = this.config.viewport;

    let attempts = 0;
    let lastError: Error | null = null;

    invariant(this.browser);

    while (attempts < this.config.retries) {
      attempts++;

      try {
        const context = await this.browser.newContext({
          viewport,
          deviceScaleFactor: 1,
        });

        const page = await context.newPage();

        // Set longer default timeout for this page
        page.setDefaultTimeout(this.config.timeout);

        // Navigate to the example page
        const url = `${this.config.serverUrl}/${pageName}`;
        console.log(
          `📸 Capturing ${pageName} (attempt ${attempts}/${this.config.retries})...`,
        );

        await page.goto(url, { waitUntil: "networkidle" });

        // Wait for WebGL content to load
        await this.waitForWebGL(page, pageConfig);

        // Capture screenshot
        const screenshotPath = path.join(
          this.config.outputDir,
          `${pageName}.png`,
        );
        await page.screenshot({
          path: screenshotPath,
          fullPage: false, // Use viewport size
        });

        await context.close();

        const duration = Date.now() - startTime;
        console.log(`✅ ${pageName} captured successfully (${duration}ms)`);

        return {
          page: pageName,
          path: screenshotPath,
          timestamp: Date.now(),
          duration,
          success: true,
        };
      } catch (error) {
        lastError = error as Error;
        console.warn(
          `⚠️  ${pageName} failed (attempt ${attempts}): ${lastError.message}`,
        );

        if (attempts < this.config.retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    const duration = Date.now() - startTime;
    console.error(`❌ ${pageName} failed after ${attempts} attempts`);

    return {
      page: pageName,
      path: "",
      timestamp: Date.now(),
      duration,
      success: false,
      error: lastError?.message,
    };
  }

  async run(): Promise<void> {
    console.log("🚀 Starting screenshot generation...");

    await this.initialize();
    const pages = await this.discoverPages();

    // Process pages in batches for parallel execution
    const results: PageScreenshotResult[] = [];

    for (let i = 0; i < pages.length; i += this.config.parallel) {
      const batch = pages.slice(i, i + this.config.parallel);
      const batchResults = await Promise.all(
        batch.map((page) => this.captureScreenshot(page)),
      );
      results.push(
        ...batchResults.filter((v): v is PageScreenshotResult => !!v),
      );
    }

    // Clean up
    if (this.browser) {
      await this.browser.close();
    }

    // Summary
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log("\n📊 Screenshot generation complete!");
    console.log(`✅ Successful: ${successful}`);
    if (failed > 0) {
      console.log(`❌ Failed: ${failed}`);
    }
    console.log(`📁 Output: ${this.config.outputDir}`);

    // Exit with error if any failures
    if (failed > 0) {
      process.exit(1);
    }
  }
}

// Parse command-line arguments
function parseArgs(): { pages: string[] | null; forceHeavy?: boolean } {
  const args = process.argv.slice(2);

  // Check for help
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
📸 Screenshot Generator for Navara WebGL Examples

Usage:
  pnpm run screenshots                    # Capture all pages
  pnpm run screenshots [page1] [page2]    # Capture specific pages
  pnpm run screenshots --help             # Show this help

Examples:
  pnpm run screenshots atmosphere         # Capture only atmosphere page
  pnpm run screenshots atmosphere night   # Capture atmosphere and night pages
  pnpm run screenshots --help            # Show available pages

Environment variables:
  SERVER_URL=http://localhost:5173       # Override dev server URL
    `);
    process.exit(0);
  }

  // Filter out flags and their values to get page names
  const pages: string[] = [];
  for (const arg of args) {
    pages.push(arg);
  }

  return {
    pages: pages.length > 0 ? pages : null,
  };
}

// Run the generator
const { pages } = parseArgs();
const generator = new ScreenshotGenerator({}, pages || undefined);
generator.run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
