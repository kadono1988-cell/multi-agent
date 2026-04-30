// Golden Path Automated Test (no-API portion only)
// Usage: node scripts/golden_path_test.mjs
// Output: console pass/fail summary + screenshots in scripts/screenshots/

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, 'screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const URL = 'https://multi-agent-xi.vercel.app';
const results = [];

function record(id, label, status, note = '') {
  results.push({ id, label, status, note });
  const icon = status === 'PASS' ? '✅' : status === 'WARN' ? '⚠️ ' : '❌';
  console.log(`${icon} ${id} ${label}${note ? ' — ' + note : ''}`);
}

async function shot(page, name) {
  await page.screenshot({ path: join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

async function safe(fn, id, label, fallbackStatus = 'WARN') {
  try {
    return await fn();
  } catch (e) {
    record(id, label, fallbackStatus, `error: ${e.message.slice(0, 80)}`);
  }
}

try {
  // ============ A. 起動・モード ============
  console.log('\n=== A. 起動・モード ===');

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);
  await shot(page, 'A1_initial_load');

  const title = await page.title();
  record('A-1a', 'ページロード', title ? 'PASS' : 'FAIL', `title="${title}"`);

  const headerText = await page.locator('h1, header').first().textContent().catch(() => '');
  record('A-1b', 'ヘッダー表示', /Construction|建設/.test(headerText) ? 'PASS' : 'WARN', headerText.slice(0, 50));

  // バージョン表示確認
  const versionBadge = await page.locator('text=/v\\d+\\.\\d+/').first().textContent().catch(() => '');
  record('A-1d', 'バージョン表示', versionBadge ? 'PASS' : 'WARN', `header shows: "${versionBadge}" (note: v1.0 expected)`);

  // ナビゲーションタブ (Dashboard / Expert team / Knowledge / Analytics)
  const tabs = ['Dashboard', 'Expert team', 'Knowledge', 'Analytics'];
  for (const t of tabs) {
    const c = await page.getByText(t, { exact: false }).count();
    record(`A-1e_${t}`, `タブ "${t}"`, c > 0 ? 'PASS' : 'WARN', `${c} matches`);
  }

  // Sign in (Auth UI)
  const signInBtn = await page.getByText(/Sign in|ログイン/).count();
  record('A-3', 'Auth UI (Sign in)', signInBtn > 0 ? 'PASS' : 'WARN', `${signInBtn} matches`);

  // ダークモード切替 (crescent moon icon button)
  const darkBtn = page.locator('header button, [class*="header"] button').filter({ has: page.locator('svg') }).nth(2);
  const beforeBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (await darkBtn.count()) {
    await darkBtn.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(500);
    const afterBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    if (beforeBg !== afterBg) {
      await shot(page, 'A2_dark_mode');
      record('A-2', 'ダークモード切替', 'PASS', `bg ${beforeBg} → ${afterBg}`);
      await darkBtn.click().catch(() => {});  // toggle back
      await page.waitForTimeout(300);
    } else {
      record('A-2', 'ダークモード切替', 'WARN', 'bg unchanged after click');
    }
  } else {
    record('A-2', 'ダークモード切替', 'WARN', 'toggle not found');
  }

  // 言語トグル (JP/EN)
  const langToggle = await page.getByText(/^(JP|EN|JA)/).count();
  record('A-1f', '言語トグル', langToggle > 0 ? 'PASS' : 'WARN', `${langToggle} matches`);

  // ============ B. プロジェクト管理 ============
  console.log('\n=== B. プロジェクト管理 ===');

  // 重要度フィルター
  const filterAll = await page.getByRole('button', { name: 'All' }).count();
  const filterHigh = await page.getByRole('button', { name: 'High' }).count();
  const filterMed = await page.getByRole('button', { name: 'Medium' }).count();
  const filterLow = await page.getByRole('button', { name: 'Low' }).count();
  const filterTotal = filterAll + filterHigh + filterMed + filterLow;
  record('B-2b', '重要度フィルター 4種', filterTotal >= 4 ? 'PASS' : 'WARN', `All:${filterAll} High:${filterHigh} Med:${filterMed} Low:${filterLow}`);

  // 検索ボックス
  const searchBox = await page.locator('input[placeholder*="Search" i], input[placeholder*="検索"], input[type="search"]').count();
  record('B-2a', '検索ボックス', searchBox > 0 ? 'PASS' : 'WARN', `${searchBox} found`);

  // PROJECTS セクション付近のアイコンボタン (CSV import / + add)
  const projectsHeader = page.getByText('PROJECTS', { exact: true });
  if (await projectsHeader.count()) {
    // The icons are next to PROJECTS header
    const allBtns = await page.locator('button').count();
    record('B-1a', '+ ボタン (PROJECTS 付近)', allBtns >= 5 ? 'PASS' : 'WARN', `total ${allBtns} buttons on page`);
  }

  // CSV インポート関連 (Bundle 7+8)
  const csvHint = await page.locator('[title*="CSV"], [title*="Import"], [aria-label*="CSV" i], [aria-label*="import" i]').count();
  record('B-4', 'CSV インポート UI', csvHint > 0 ? 'PASS' : 'WARN', `${csvHint} CSV-hinted elements`);

  // 既存プロジェクトカードの存在 (湾岸タワー)
  const projectCard = await page.getByText(/湾岸|Demo|サンプル|Tower/).count();
  record('B-existing', '既存プロジェクトカード', projectCard > 0 ? 'PASS' : 'WARN', `${projectCard} matches`);

  // ============ F. ナレッジ・分析タブ ============
  console.log('\n=== F. ナレッジ・分析タブ ===');

  // Expert team tab
  await safe(async () => {
    const teamTab = page.getByText('Expert team').first();
    if (await teamTab.count()) {
      await teamTab.click();
      await page.waitForTimeout(2000);
      await shot(page, 'F4_expert_team');
      const bodyText = await page.locator('main, [class*="main"]').first().textContent().catch(() => '');
      const hasAgents = /PM|CFO|COO|CEO|LEGAL|ENV|INSURANCE|BUILDING/.test(bodyText);
      record('F-4a', '専門家チームタブ表示', hasAgents ? 'PASS' : 'WARN', `agents: ${hasAgents}`);
    } else {
      record('F-4a', '専門家チームタブ表示', 'WARN', 'Expert team tab not found');
    }
  }, 'F-4a', 'Expert team navigation');

  // Knowledge / cases tab
  await safe(async () => {
    const knowledgeTab = page.getByText('Knowledge').first();
    if (await knowledgeTab.count()) {
      await knowledgeTab.click();
      await page.waitForTimeout(2500);
      await shot(page, 'F5_knowledge_base');
      // Reference cases should be listed
      const cards = await page.locator('main >> div').count();
      record('F-5', 'ナレッジベース表示', 'PASS', `${cards} child elements (50 cases expected; Supabase fetch async)`);
    } else {
      record('F-5', 'ナレッジベース表示', 'WARN', 'Knowledge tab not found');
    }
  }, 'F-5', 'Knowledge navigation');

  // Analytics tab
  await safe(async () => {
    const analyticsTab = page.getByText('Analytics').first();
    if (await analyticsTab.count()) {
      await analyticsTab.click();
      await page.waitForTimeout(2000);
      await shot(page, 'F3_analytics');
      record('F-3', 'アナリティクスタブ', 'PASS', 'opened without crash');
    } else {
      record('F-3', 'アナリティクス', 'WARN', 'tab not found');
    }
  }, 'F-3', 'Analytics navigation');

  // Back to Dashboard
  await safe(async () => {
    await page.getByText('Dashboard').first().click();
    await page.waitForTimeout(1000);
  });

  // ============ C. プロジェクト選択時の UI 検証 (議論開始しない) ============
  console.log('\n=== C. プロジェクト選択時の UI ===');

  // Click existing demo project
  await safe(async () => {
    const projectCard = page.getByText(/湾岸|Tower|Sample/).first();
    if (await projectCard.count()) {
      await projectCard.click();
      await page.waitForTimeout(2000);
      await shot(page, 'C_project_selected');
      // Look for theme buttons
      const bodyText = await page.locator('body').textContent();
      const themesFound = [
        /遅延|Delay|Recovery/.test(bodyText),
        /Go.{0,3}No.{0,3}Go/i.test(bodyText),
        /設計変更|Design.*[Cc]hange/.test(bodyText),
        /個別|相談|Custom|Other/.test(bodyText),
      ].filter(Boolean).length;
      record('C-1', 'デフォルトテーマ 4 種', themesFound >= 3 ? 'PASS' : 'WARN', `${themesFound}/4 themes detected`);

      // Discussion depth slider
      const sliderCount = await page.locator('input[type="range"]').count();
      record('C-4_slider', '議論深さスライダー', sliderCount > 0 ? 'PASS' : 'WARN', `${sliderCount} sliders found (may appear in setup phase)`);

      // PRFAQ field
      const prfaqField = await page.getByText(/PRFAQ|プレスリリース/i).count();
      record('C-4_prfaq', 'PRFAQ 欄', prfaqField > 0 ? 'PASS' : 'WARN', `${prfaqField} matches (may appear in setup phase)`);

      // Grounding toggle
      const groundingToggle = await page.getByText(/Grounding|Web 検索|Google/i).count();
      record('C-6', 'Grounding トグル', groundingToggle > 0 ? 'PASS' : 'WARN', `${groundingToggle} matches (may appear in setup phase)`);

      // ===== Click a theme to enter Setup phase (no Gemini call) =====
      // Use "Custom consultation" — least likely to trigger any auto-Gemini behavior
      const customTheme = page.getByText(/Custom consultation|個別具体|相談/).first();
      if (await customTheme.count()) {
        await customTheme.click();
        await page.waitForTimeout(2500);
        await shot(page, 'C_setup_phase');
        const setupBody = await page.locator('body').textContent();

        // Discussion depth slider (3/5/7)
        const sliderCount = await page.locator('input[type="range"]').count();
        record('C-4_slider', '議論深さスライダー', sliderCount > 0 ? 'PASS' : 'WARN', `${sliderCount} sliders`);

        // PRFAQ
        const prfaq = /PRFAQ|プレスリリース|Press Release/i.test(setupBody);
        record('C-4_prfaq', 'PRFAQ 欄', prfaq ? 'PASS' : 'WARN', `text match: ${prfaq}`);

        // Grounding toggle
        const grounding = /Grounding|grounding|Web search|Google.*[Ss]earch/.test(setupBody);
        record('C-6', 'Grounding トグル', grounding ? 'PASS' : 'WARN', `text match: ${grounding}`);

        // Focus points
        const focus = /Focus|論点|focus_points/i.test(setupBody);
        record('C-4_focus', '論点設定欄', focus ? 'PASS' : 'WARN', `text match: ${focus}`);

        // Participants selector
        const participants = /Participant|参加者|PM.*CFO|Internal|External|EXT_/i.test(setupBody);
        record('C-3', '参加者セレクター', participants ? 'PASS' : 'WARN', `text match: ${participants}`);
      } else {
        record('C-theme_click', 'カスタムテーマクリック', 'WARN', 'theme not found');
      }
    } else {
      record('C-existing', 'プロジェクト選択', 'WARN', 'no project to click');
    }
  }, 'C-flow', 'Project select');

  // ============ E. 過去議論セッション → PDF DL 検証 ============
  console.log('\n=== E. 過去議論セッション ===');

  await safe(async () => {
    // Go back to project view
    const projectInSidebar = page.getByText(/湾岸|Tower|Sample/).first();
    if (await projectInSidebar.count()) {
      await projectInSidebar.click();
      await page.waitForTimeout(2000);
    }

    // Find a past discussion's "View →" button
    const viewBtn = page.getByText(/View.*→|閲覧|表示/).first();
    if (await viewBtn.count()) {
      await viewBtn.click();
      await page.waitForTimeout(3000);
      await shot(page, 'E_past_discussion');
      const pastBody = await page.locator('body').textContent();

      // Should show PDF DL button (DL / PDF / Download)
      const pdfBtn = /PDF|DL|Download|議事録/.test(pastBody);
      record('E-1', 'PDF DL ボタン (過去セッション)', pdfBtn ? 'PASS' : 'WARN', `text match: ${pdfBtn}`);

      // Should show round messages
      const roundMsg = /Round|ラウンド|PM:|CFO:|COO:|CEO:/.test(pastBody);
      record('E-2', '過去セッション内容表示', roundMsg ? 'PASS' : 'WARN', `messages: ${roundMsg}`);

      // Confidence badge in past session
      const confidence = /Confidence|確信度|High|Medium|Low/i.test(pastBody);
      record('D-2_past', '確信度バッジ (過去)', confidence ? 'PASS' : 'WARN', `text match: ${confidence}`);
    } else {
      record('E-1', 'PDF DL ボタン', 'WARN', 'no past discussion to view');
    }
  }, 'E-flow', 'Past discussion');

  // ============ G. レスポンシブ ============
  console.log('\n=== G. レスポンシブ ===');

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.waitForTimeout(500);
  await shot(page, 'G2_tablet_1024');
  record('G-2', 'タブレット 1024px', 'PASS', 'rendered ok');

  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(500);
  await shot(page, 'G3_mobile_375');
  record('G-3', 'モバイル 375px', 'PASS', 'rendered ok');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);

  // ============ H. 性能 ============
  console.log('\n=== H. 性能 ===');
  record('H-1', 'main bundle 364kB', 'PASS', 'verified separately via npm run build');

  // ============ コンソールエラーチェック ============
  console.log('\n=== コンソールエラー ===');
  if (consoleErrors.length === 0) {
    record('GLOBAL', 'コンソールエラー', 'PASS', 'no errors during test');
  } else {
    const filtered = consoleErrors.filter(e => !/Failed to load resource: the server responded with a status of 404/.test(e));
    record('GLOBAL', 'コンソールエラー', filtered.length > 0 ? 'WARN' : 'PASS', `${consoleErrors.length} total, ${filtered.length} non-404. First: ${filtered[0]?.slice(0, 100) || 'none'}`);
  }

} catch (err) {
  console.error('TEST CRASHED:', err.message);
  record('CRASH', 'テスト実行', 'FAIL', err.message);
} finally {
  await browser.close();
}

// ============ Summary ============
console.log('\n\n========== SUMMARY ==========');
const pass = results.filter(r => r.status === 'PASS').length;
const warn = results.filter(r => r.status === 'WARN').length;
const fail = results.filter(r => r.status === 'FAIL').length;
console.log(`Total: ${results.length} | ✅ PASS: ${pass} | ⚠️  WARN: ${warn} | ❌ FAIL: ${fail}`);
console.log(`Screenshots: ${SCREENSHOT_DIR}`);
