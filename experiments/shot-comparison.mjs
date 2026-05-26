import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const html = readFileSync(new URL('./chart-before-after.html', import.meta.url), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
const body = await page.$('body');
const box = await body.boundingBox();
await page.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
await page.screenshot({ path: new URL('../docs/screenshots/chart-before-after.png', import.meta.url).pathname, fullPage: true });
await browser.close();
console.log('screenshot written');
