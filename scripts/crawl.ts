#!/usr/bin/env tsx
/**
 * Полноценный рекурсивный краулер сайтов на Playwright (BFS)
 *
 * Выполняет требования из .claude/tasks/TASK.md:
 * - Начинает со стартовой URL
 * - Сканирует все <a href> на странице
 * - Нормализует ссылки, оставляет только тот же домен
 * - Рекурсивный обход по BFS (очередь)
 * - Использует Playwright (рендерит JS)
 * - Задержка 2-3 секунды между запросами
 * - Лимит страниц (по умолчанию 100)
 * - Логирование
 * - Сохранение всех ссылок + пути обхода в JSON
 * - Фильтрация (mailto:, javascript:, внешние домены, якоря)
 * - Предпочтение ссылок из основного контента (main, article, [role=main])
 * - Отслеживание пути (какая ссылка привела к странице)
 * - Поддержка приостановки/продолжения (через state-файл + SIGINT)
 *
 * Запуск:
 *   npx tsx scripts/crawl.ts https://ru.investing.com/economic-calendar --max 30
 *
 * Продолжение после остановки:
 *   npx tsx scripts/crawl.ts https://ru.investing.com/economic-calendar --resume
 */

import { chromium, type Browser, type Page } from 'playwright';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ==================== КОНФИГУРАЦИЯ ====================

const DEFAULT_MAX_PAGES = 100;
const DEFAULT_DELAY_MS = 2500;
const DEFAULT_TIMEOUT_MS = 25000;
const DEFAULT_OUTPUT = 'crawl-result.json';
const STATE_FILE = '.crawl-state.json';

// ==================== ТИПЫ ====================

interface CrawlLink {
  url: string;
  path: string[];           // цепочка URL, которая привела к этой странице
  discoveredAt: string;
}

interface CrawlResult {
  startUrl: string;
  totalPages: number;
  maxPages: number;
  links: CrawlLink[];
  finishedAt: string;
  wasInterrupted: boolean;
}

interface CrawlState {
  startUrl: string;
  visited: string[];
  queue: Array<{ url: string; path: string[] }>;
  results: CrawlLink[];
  maxPages: number;
  delayMs: number;
  outputFile: string;
}

// ==================== УТИЛИТЫ ====================

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

function normalizeUrl(raw: string, base: string): string | null {
  try {
    const url = new URL(raw, base);

    // Убираем якоря и ненужные query-параметры (оставляем как есть для простоты)
    url.hash = '';

    // Приводим к нижнему регистру хост
    url.hostname = url.hostname.toLowerCase();

    // Убираем trailing slash в конце пути (кроме корня)
    if (url.pathname !== '/' && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1);
    }

    return url.toString();
  } catch {
    return null;
  }
}

function isSameOrigin(url: string, baseOrigin: string): boolean {
  try {
    return new URL(url).origin === baseOrigin;
  } catch {
    return false;
  }
}

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith('mailto:') ||
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('tel:') ||
    lower.includes('#')
  );
}

// ==================== ИЗВЛЕЧЕНИЕ ССЫЛОК ====================

/**
 * Извлекает ссылки преимущественно из основного контента страницы.
 * Пытается найти <main>, <article> или [role="main"].
 * Если не находит — берёт всё тело.
 */
async function extractRelevantLinks(page: Page, baseUrl: string): Promise<string[]> {
  const origin = new URL(baseUrl).origin;

  const links = await page.evaluate(
    ({ origin }) => {
      // Предпочитаем основной контент
      const main =
        document.querySelector('main') ||
        document.querySelector('article') ||
        document.querySelector('[role="main"]') ||
        document.body;

      const anchors = Array.from(main.querySelectorAll('a[href]')) as HTMLAnchorElement[];

      const result: string[] = [];

      for (const a of anchors) {
        const href = a.getAttribute('href');
        if (!href) continue;

        // Пропускаем якоря, javascript и т.д. (дополнительная фильтрация)
        if (href.startsWith('#') || href.toLowerCase().startsWith('javascript:')) {
          continue;
        }

        try {
          const absolute = new URL(href, window.location.href);
          absolute.hash = '';

          // Только тот же домен
          if (absolute.origin !== origin) continue;

          // Убираем trailing slash
          let normalized = absolute.toString();
          if (normalized.endsWith('/') && normalized.length > origin.length + 1) {
            normalized = normalized.slice(0, -1);
          }

          if (!result.includes(normalized)) {
            result.push(normalized);
          }
        } catch {
          // игнорируем битые ссылки
        }
      }
      return result;
    },
    { origin },
  );

  return links;
}

// ==================== ОСНОВНОЙ КЛАСС КРАУЛЕРА ====================

class PlaywrightCrawler {
  private browser: Browser | null = null;
  private visited = new Set<string>();
  private queue: Array<{ url: string; path: string[] }> = [];
  private results: CrawlLink[] = [];
  private interrupted = false;

  constructor(
    private startUrl: string,
    private maxPages: number,
    private delayMs: number,
    private outputFile: string,
    private resume: boolean,
  ) {}

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    this.browser = await chromium.launch({ headless: true });
    return this.browser;
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Загрузка состояния для продолжения краулинга
   */
  private async loadState(): Promise<void> {
    try {
      const raw = await readFile(STATE_FILE, 'utf8');
      const state: CrawlState = JSON.parse(raw);

      if (state.startUrl !== this.startUrl) {
        console.log('⚠️  Состояние из другого URL — начинаем заново');
        return;
      }

      this.visited = new Set(state.visited);
      this.queue = state.queue;
      this.results = state.results;

      console.log(
        `↻ Продолжаем с сохранённого состояния: посещено ${this.visited.size}, в очереди ${this.queue.length}`,
      );
    } catch {
      // файла нет — начинаем с чистого листа
    }
  }

  /**
   * Сохранение текущего состояния (для --resume и SIGINT)
   */
  private async saveState(): Promise<void> {
    const state: CrawlState = {
      startUrl: this.startUrl,
      visited: Array.from(this.visited),
      queue: this.queue,
      results: this.results,
      maxPages: this.maxPages,
      delayMs: this.delayMs,
      outputFile: this.outputFile,
    };

    await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  }

  private setupInterruptHandler() {
    const handler = async () => {
      if (this.interrupted) return;
      this.interrupted = true;
      console.log('\n\n🛑 Получен сигнал прерывания. Сохраняем состояние...');
      await this.saveState();
      await this.closeBrowser();
      console.log('✅ Состояние сохранено в', STATE_FILE);
      console.log('   Для продолжения запустите с флагом --resume');
      process.exit(130);
    };

    process.on('SIGINT', handler);
    process.on('SIGTERM', handler);
  }

  /**
   * Основной цикл BFS
   */
  async run(): Promise<CrawlResult> {
    if (this.resume) {
      await this.loadState();
    } else {
      // Очищаем старое состояние
      try {
        await writeFile(STATE_FILE, '');
      } catch {}
    }

    this.setupInterruptHandler();

    if (this.queue.length === 0) {
      const normalizedStart = normalizeUrl(this.startUrl, this.startUrl)!;
      this.queue.push({ url: normalizedStart, path: [] });
    }

    const browser = await this.ensureBrowser();
    const origin = new URL(this.startUrl).origin;

    console.log(`🚀 Старт краулинга: ${this.startUrl}`);
    console.log(`   Лимит страниц: ${this.maxPages}`);
    console.log(`   Задержка: ${this.delayMs}ms`);
    console.log(`   Домен: ${origin}\n`);

    let pagesProcessed = 0;

    while (this.queue.length > 0 && pagesProcessed < this.maxPages && !this.interrupted) {
      const { url, path } = this.queue.shift()!;

      if (this.visited.has(url)) continue;
      this.visited.add(url);

      console.log(`[${pagesProcessed + 1}/${this.maxPages}] → ${url}`);

      let page: Page | null = null;
      let newLinks: string[] = [];

      try {
        page = await browser.newPage();
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: DEFAULT_TIMEOUT_MS,
        });

        // Даём странице немного времени на рендер динамического контента
        await page.waitForTimeout(800);

        newLinks = await extractRelevantLinks(page, url);
      } catch (err: any) {
        console.error(`   ❌ Ошибка загрузки ${url}: ${err.message || err}`);
      } finally {
        if (page) await page.close().catch(() => {});
      }

      // Сохраняем результат
      this.results.push({
        url,
        path: [...path],
        discoveredAt: new Date().toISOString(),
      });

      // Добавляем новые ссылки в очередь
      for (const link of newLinks) {
        if (this.visited.has(link)) continue;
        if (shouldSkipUrl(link)) continue;
        if (!isSameOrigin(link, origin)) continue;

        this.queue.push({ url: link, path: [...path, url] });
      }

      pagesProcessed++;

      // Сохраняем состояние после каждой страницы (на случай падения)
      await this.saveState();

      // Задержка между запросами (важно для этичного краулинга)
      if (this.queue.length > 0 && pagesProcessed < this.maxPages) {
        await sleep(this.delayMs);
      }
    }

    await this.closeBrowser();

    const result: CrawlResult = {
      startUrl: this.startUrl,
      totalPages: this.results.length,
      maxPages: this.maxPages,
      links: this.results,
      finishedAt: new Date().toISOString(),
      wasInterrupted: this.interrupted,
    };

    // Финальное сохранение результатов
    await mkdir(dirname(resolve(this.outputFile)), { recursive: true });
    await writeFile(this.outputFile, JSON.stringify(result, null, 2));

    // Удаляем state-файл при успешном завершении
    if (!this.interrupted) {
      try {
        await writeFile(STATE_FILE, '');
      } catch {}
    }

    return result;
  }
}

// ==================== CLI ====================

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let startUrl = '';
  let maxPages = DEFAULT_MAX_PAGES;
  let delayMs = DEFAULT_DELAY_MS;
  let outputFile = DEFAULT_OUTPUT;
  let resume = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Использование:
  npx tsx scripts/crawl.ts <START_URL> [опции]

Опции:
  --max <число>       Максимальное количество страниц (default: ${DEFAULT_MAX_PAGES})
  --delay <мс>        Задержка между запросами в миллисекундах (default: ${DEFAULT_DELAY_MS})
  --out <файл>        Куда сохранить результат (default: ${DEFAULT_OUTPUT})
  --resume            Продолжить с последнего сохранённого состояния
  -h, --help          Показать справку
`);
      process.exit(0);
    }

    if (arg === '--resume') {
      resume = true;
      continue;
    }
    if (arg === '--max' && args[i + 1]) {
      maxPages = parseInt(args[++i], 10) || DEFAULT_MAX_PAGES;
      continue;
    }
    if (arg === '--delay' && args[i + 1]) {
      delayMs = parseInt(args[++i], 10) || DEFAULT_DELAY_MS;
      continue;
    }
    if (arg === '--out' && args[i + 1]) {
      outputFile = args[++i];
      continue;
    }

    if (!startUrl && !arg.startsWith('--')) {
      startUrl = arg;
    }
  }

  if (!startUrl) {
    console.error('❌ Не указан стартовый URL');
    console.error('Пример: npx tsx scripts/crawl.ts https://ru.investing.com/economic-calendar');
    process.exit(1);
  }

  return { startUrl, maxPages, delayMs, outputFile, resume };
}

async function main() {
  const { startUrl, maxPages, delayMs, outputFile, resume } = parseArgs(process.argv);

  const crawler = new PlaywrightCrawler(startUrl, maxPages, delayMs, outputFile, resume);

  const result = await crawler.run();

  console.log('\n✅ Краулинг завершён');
  console.log(`   Обработано страниц: ${result.totalPages}`);
  console.log(`   Сохранено ссылок:   ${result.links.length}`);
  console.log(`   Результат:          ${resolve(outputFile)}`);
  if (result.wasInterrupted) {
    console.log('   ⚠️  Краулинг был прерван пользователем');
  }
}

main().catch((err) => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});
