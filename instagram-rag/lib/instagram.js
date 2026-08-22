import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = 'data/instagram.session.json';

async function getBrowser() {
  const browser = await chromium.launch({ headless: true });
  return browser;
}

async function loadSession() {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  return null;
}

async function saveSession(context) {
  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  const storageState = await context.storageState();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(storageState));
}

export async function loginInstagram(username, password) {
  // First, try to restore from existing session
  const savedState = loadSession();
  let context, browser, page;

  if (savedState && savedState.cookies) {
    console.log('  Tentativo ripristino sessione...');
    browser = await getBrowser();
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      storageState: savedState
    });
    page = await context.newPage();
    await page.goto(`https://www.instagram.com/${username}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check if actually logged in
    const isLoggedIn = await page.locator(`a[href="/${username}/"]`).count() > 0 ||
                      await page.locator('nav a[href*="direct"]').count() > 0;

    if (isLoggedIn) {
      console.log('✓ Sessione ripristinata');
      return { context, browser, page };
    }
    console.log('  Sessione non valida, chiudo e riprovo...');
    await browser.close();
  }

  // Fresh login
  console.log('  Faccio login...');
  browser = await getBrowser();
  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  page = await context.newPage();

  await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Handle cookie consent
  try {
    const acceptAllBtn = page.locator('button:has-text("Allow all cookies")');
    if (await acceptAllBtn.count() > 0) {
      console.log('  Accetto i cookie...');
      await acceptAllBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  // Login form - wait longer for form to be ready
  await page.waitForTimeout(2000);

  const emailField = page.locator('input[name="email"]');
  const passField = page.locator('input[name="pass"]');

  await emailField.waitFor({ timeout: 10000 });
  await emailField.fill(username);
  await page.waitForTimeout(500);
  await passField.fill(password);
  await page.waitForTimeout(500);
  await passField.press('Enter');

  // Wait for redirect - Instagram takes time
  console.log('  Aspettando redirect...');
  await page.waitForTimeout(10000);

  // Check current URL
  const finalUrl = page.url();
  console.log(`  URL dopo login: ${finalUrl}`);

  // Check if 2FA is required
  if (finalUrl.includes('two_step_verification')) {
    console.log('  ✓ Credenziali corrette! Instagram richiede verifica 2FA.');

    // Wait for 2FA form
    await page.waitForTimeout(3000);

    // Look for verification code input
    const codeInput = page.locator('input[name="verificationCode"], input[aria-label*="code"], input[placeholder*="code"]');
    await codeInput.waitFor({ timeout: 10000 });

    // Ask user for code
    console.log('  Inserisci il codice 2FA da Instagram:');
    const readline = await import('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = await new Promise(resolve => rl.question('  Codice: ', resolve));
    rl.close();

    await codeInput.fill(code);
    await page.waitForTimeout(1000);

    // Submit code
    const confirmBtn = page.locator('button[type="submit"]');
    await confirmBtn.click();
    await page.waitForTimeout(5000);

    const after2faUrl = page.url();
    console.log(`  URL dopo 2FA: ${after2faUrl}`);

    if (after2faUrl.includes('two_step_verification')) {
      throw new Error('Codice 2FA non valido!');
    }
  }

  if (finalUrl.includes('/accounts/login')) {
    // Try to find error message
    const errorEls = await page.locator('[role="alert"], span[class*="error"], p:has-text("incorrect")').all();
    if (errorEls.length > 0) {
      const errText = await errorEls[0].textContent();
      console.log(`  Errore: ${errText}`);
    }
    throw new Error('Login fallito!');
  }

  // Save session
  await saveSession(context);
  console.log('✓ Login effettuato e sessione salvata');

  return { context, browser, page };
}

export async function getSavedCollections(context, browser, username) {
  const page = await context.newPage();

  // Debug: check cookies
  const cookies = await context.cookies();
  console.log(`  Context ha ${cookies.length} cookies`);

  await page.goto(`https://www.instagram.com/${username}/saved/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  // Scroll to trigger lazy loading
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(2000);

  const collections = [];

  // Try known collection slug patterns
  const slugVariants = ['it-tricks', 'it_tricks', 'tech-tricks', 'tech_tricks'];

  for (const slug of slugVariants) {
    const url = `https://www.instagram.com/${username}/saved/${slug}/`;

    try {
      const testPage = await context.newPage();
      await testPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await testPage.waitForTimeout(3000);

      const currentUrl = testPage.url();
      if (currentUrl.includes('/accounts/login')) {
        console.log(`  ✗ ${slug}: redirect to login`);
        await testPage.close();
        continue;
      }

      const hasPosts = await testPage.locator('article').count();
      if (hasPosts > 0) {
        console.log(`  ✓ Collection found: ${slug} (${hasPosts} posts)`);
        collections.push({ name: slug, href: `/${username}/saved/${slug}/` });
      }
      await testPage.close();
    } catch (e) {
      console.log(`  Error checking ${slug}: ${e.message}`);
    }
  }

  console.log(`\nTrovate ${collections.length} collezioni`);
  await page.close();
  return [...new Map(collections.map(c => [c.name, c])).values()];
}

export async function scrapeCollection(context, username, collectionName) {
  const page = await context.newPage();

  // Navigate directly to the collection
  const collectionSlug = collectionName.replace(/ /g, '-').toLowerCase();
  const url = `https://www.instagram.com/${username}/saved/${collectionSlug}/`;
  console.log(`  Navigando a: ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);

  // Scroll to load posts
  await page.evaluate(() => window.scrollTo(0, 800));
  await page.waitForTimeout(3000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(2000);

  const posts = [];

  // Instagram renders posts in various ways
  const extractedPosts = await page.evaluate(() => {
    const results = [];
    // Try different selectors Instagram might use
    const articleSelectors = [
      'article[data-media-id]',
      'article',
      'div[data-media-id]',
      '._aagw',
      '[role="presentation"] article',
    ];

    let articles = [];
    for (const sel of articleSelectors) {
      try {
        articles = [...articles, ...document.querySelectorAll(sel)];
      } catch (e) {}
    }

    // Deduplicate
    articles = [...new Set(articles)];

    articles.forEach(article => {
      const mediaId = article.getAttribute('data-media-id') || Math.random().toString();

      // Find image
      let mediaUrl = '';
      const imgs = article.querySelectorAll('img');
      for (const img of imgs) {
        if (img.src && !img.src.includes('data:')) {
          mediaUrl = img.src;
          break;
        }
      }

      // Find caption
      let caption = '';
      const captionSelectors = ['._a9zr', '._a9zs', 'span[class*="caption"]', 'li[role="menuitem"]'];
      for (const sel of captionSelectors) {
        const el = article.querySelector(sel);
        if (el) {
          caption = el.textContent || '';
          break;
        }
      }

      // Find hashtags
      const hashtags = (caption.match(/#[a-zA-Z0-9_]+/g) || []).join(' ');

      // Find timestamp
      let timestamp = null;
      const timeEl = article.querySelector('time');
      if (timeEl) {
        timestamp = timeEl.getAttribute('datetime');
      }

      if (mediaUrl || caption) {
        results.push({
          post_id: mediaId,
          caption: caption.trim(),
          media_url: mediaUrl,
          hashtags,
          timestamp
        });
      }
    });

    return results;
  });

  console.log(`  Estratti ${extractedPosts.length} post via JavaScript`);

  for (const p of extractedPosts) {
    posts.push({
      collection: collectionName,
      post_id: p.post_id,
      caption: p.caption,
      media_url: p.media_url,
      hashtags: p.hashtags,
      like_count: 0,
      comment_count: 0,
      timestamp: p.timestamp
    });
  }

  // Scroll for more posts
  for (let scroll = 0; scroll < 10; scroll++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);

    const morePosts = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-media-id], article, ._aagw');
      const results = [];
      articles.forEach(article => {
        const mediaId = article.getAttribute('data-media-id') || Math.random().toString();
        const imgs = article.querySelectorAll('img');
        let imgSrc = '';
        for (const img of imgs) {
          if (img.src && !img.src.includes('data:')) {
            imgSrc = img.src;
            break;
          }
        }
        const captionEl = article.querySelector('._a9zr, ._a9zs, span');
        const caption = captionEl ? captionEl.textContent : '';
        if (imgSrc || caption) {
          results.push({ post_id: mediaId, caption: caption.trim(), media_url: imgSrc });
        }
      });
      return results;
    });

    const newPosts = morePosts.filter(mp => !posts.find(p => p.post_id === mp.post_id));
    if (newPosts.length === 0) break;
    console.log(`  Scroll ${scroll + 1}: +${newPosts.length} nuovi post`);
    for (const np of newPosts) {
      posts.push({
        collection: collectionName,
        post_id: np.post_id,
        caption: np.caption,
        media_url: np.media_url,
        hashtags: (np.caption.match(/#[a-zA-Z0-9_]+/g) || []).join(' '),
        like_count: 0,
        comment_count: 0,
        timestamp: null
      });
    }
  }

  await page.close();
  console.log(`✓ Estratti ${posts.length} post dalla collezione "${collectionName}"`);
  return posts;
}

export async function scrapeAllSaved(context, browser, username) {
  // Get all collections first
  const collections = await getSavedCollections(context, browser, username);
  console.log(`Trovate ${collections.length} collezioni`);

  const allPosts = [];
  for (const col of collections) {
    console.log(`\nScraping collezione: ${col.name}`);
    const posts = await scrapeCollection(context, username, col.name);
    allPosts.push(...posts);
  }

  return { collections: collections.map(c => c.name), posts: allPosts };
}
