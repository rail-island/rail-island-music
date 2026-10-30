// Headless Chromium for the render tools, through the Playwright that the
// cloud sessions have pre-installed (not a dependency of this repository, so
// it is loaded at run time and typed here by the little the tools use).

import { createRequire } from "node:module";

export interface HeadlessPage {
  goto(url: string): Promise<unknown>;
  setContent(html: string): Promise<void>;
  addScriptTag(options: { content: string }): Promise<unknown>;
  evaluate<R, A>(fn: (arg: A) => R | Promise<R>, arg: A): Promise<R>;
  locator(selector: string): { screenshot(options: { path: string }): Promise<unknown> };
}

export interface HeadlessBrowser {
  newPage(options?: { viewport?: { width: number; height: number }; deviceScaleFactor?: number }): Promise<HeadlessPage>;
  close(): Promise<void>;
}

export async function launchChromium(): Promise<HeadlessBrowser> {
  const require = createRequire(import.meta.url);
  let playwright: { chromium: { launch(): Promise<HeadlessBrowser> } };
  try {
    playwright = require("playwright");
  } catch {
    throw new Error("Playwright is not available: the render tools need Playwright's Chromium (pre-installed in the cloud sessions).");
  }
  return playwright.chromium.launch();
}
