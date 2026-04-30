// Quick visual snap of Phase C participant selector
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(__dirname, 'screenshots');
mkdirSync(SHOT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: join(SHOT_DIR, 'phaseC_1_initial.png') });

// Select existing project (湾岸タワー)
const proj = page.getByText(/湾岸|Tower/).first();
if (await proj.count()) {
  await proj.click();
  await page.waitForTimeout(2000);
  // Click custom consultation theme to go to setup
  const theme = page.getByText(/Custom consultation|個別具体|相談/).first();
  if (await theme.count()) {
    await theme.click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(SHOT_DIR, 'phaseC_2_setup.png'), fullPage: true });
    console.log('Setup phase screenshot saved');

    // Click "経営判断" preset
    const preset = page.getByText(/経営判断/).first();
    if (await preset.count()) {
      await preset.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(SHOT_DIR, 'phaseC_3_preset_keiei.png'), fullPage: true });
      console.log('After preset click screenshot saved');
    }

    // Click T2 tier filter
    const tab = page.getByText('T2 部門長').first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(SHOT_DIR, 'phaseC_4_tier2.png'), fullPage: true });
      console.log('T2 filter screenshot saved');
    }
  }
}

await browser.close();
console.log('Done');
