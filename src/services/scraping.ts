import { createHash } from 'node:crypto';

export interface ScrapeResult {
  url: string;
  title?: string;
  content?: string;
  /** SHA-256 of the content, used to deduplicate unchanged pages. */
  contentHash: string;
}

export interface Scraper {
  readonly name: string;
  scrape(url: string): Promise<ScrapeResult>;
  close(): Promise<void>;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Headless scraper backed by Playwright/Chromium. Chromium is loaded lazily and
 * only when a browser is actually needed, so installing the binary is optional:
 * environments without it can still run every other command. The page text is
 * hashed so {@link LostfastStore.saveScrape} can skip unchanged content.
 */
export class PlaywrightScraper implements Scraper {
  readonly name = 'playwright';
  // Typed as unknown to avoid a hard compile-time dependency on Playwright's types.
  private browser: unknown = null;

  async scrape(url: string): Promise<ScrapeResult> {
    const browser = await this.ensureBrowser();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const page = await (browser as any).newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      const title: string = await page.title();
      // Passed as a string so this file needs no DOM lib at compile time.
      const content: string = await page.evaluate('document.body ? document.body.innerText : ""');
      const trimmed = content.trim().slice(0, 20_000);
      return { url, title, content: trimmed, contentHash: sha256(trimmed) };
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.browser as any).close();
      this.browser = null;
    }
  }

  private async ensureBrowser(): Promise<unknown> {
    if (this.browser) return this.browser;
    const { chromium } = await import('playwright');
    this.browser = await chromium.launch({ headless: true });
    return this.browser;
  }
}

/**
 * Wraps a real scraper and degrades gracefully: if Chromium is missing or a page
 * fails to load, it returns an empty, clearly-marked result instead of throwing,
 * so the data-collection pipeline never aborts on a flaky network or a missing
 * optional dependency.
 */
export class ResilientScraper implements Scraper {
  readonly name = 'resilient';
  constructor(private readonly inner: Scraper = new PlaywrightScraper()) {}

  async scrape(url: string): Promise<ScrapeResult> {
    try {
      return await this.inner.scrape(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const note = `scrape-unavailable: ${message}`;
      return { url, title: undefined, content: note, contentHash: sha256(`${url}:${note}`) };
    }
  }

  async close(): Promise<void> {
    try {
      await this.inner.close();
    } catch {
      // Nothing to release.
    }
  }
}
