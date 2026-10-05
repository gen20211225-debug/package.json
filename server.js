const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 静的ファイルの提供（index.html, src/style.css, src/app.js）
app.use(express.static(path.join(__dirname)));
app.use('/src', express.static(path.join(__dirname, 'src')));

/* =========================================================
   1. カインドオル (Kindal) スクレイピング
   ========================================================= */
async function fetchKindal() {
  try {
    const url = 'https://www.kind.co.jp/searches';
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const items = [];

    $('.product-card, .item-card').each((_, el) => {
      items.push({
        shop: 'カインドオル',
        brand: $(el).find('.brand-name, .brand').text().trim() || 'Kindal',
        name: $(el).find('.product-name, .title').text().trim() || '商品名なし',
        price: $(el).find('.price').text().trim(),
        image: $(el).find('img').attr('src') || '',
        url: $(el).find('a').attr('href') ? 'https://www.kind.co.jp' +$(el).find('a').attr('href') : '#',
        isSoldOut: $(el).text().includes('SOLD OUT')
      });
    });
    return items;
  } catch (err) {
    console.error('[カインドオル] 取得エラー:', err.message);
    return [];
  }
}

/* =========================================================
   2. RAGTAG スクレイピング
   ========================================================= */
async function fetchRagtag() {
  try {
    const url = 'https://www.ragtag.jp/search';
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const items = [];

    $('.item-list__item, .product-item').each((_, el) => {
      items.push({
        shop: 'RAGTAG',
        brand: $(el).find('.brand-name').text().trim() || 'RAGTAG',
        name: $(el).find('.item-name, .name').text().trim() || '商品名なし',
        price: $(el).find('.price').text().trim(),
        image: $(el).find('img').attr('src') || '',
        url: $(el).find('a').attr('href') ? 'https://www.ragtag.jp' +$(el).find('a').attr('href') : '#',
        isSoldOut: $(el).text().includes('SOLD')
      });
    });
    return items;
  } catch (err) {
    console.error('[RAGTAG] 取得エラー:', err.message);
    return [];
  }
}

/* =========================================================
   3. KLD スクレイピング
   ========================================================= */
async function fetchKld() {
  try {
    const url = 'https://kld-c.jp/collections/all';
    const { data } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(data);
    const items = [];

    $('.product-item, .grid-view-item').each((_, el) => {
      items.push({
        shop: 'KLD',
        brand: $(el).find('.vendor, .product-vendor').text().trim() || 'KLD',
        name: $(el).find('.product-title, .title').text().trim() || '商品名なし',
        price: $(el).find('.price').text().trim(),
        image: $(el).find('img').attr('src') ? 'https:' +$(el).find('img').attr('src') : '',
        url: $(el).find('a').attr('href') ? 'https://kld-c.jp' +$(el).find('a').attr('href') : '#',
        isSoldOut: $(el).text().includes('SOLD')
      });
    });
    return items;
  } catch (err) {
    console.error('[KLD] 取得エラー:', err.message);
    return [];
  }
}

/* =========================================================
   4. 動的サイト（メルカリ・ヤフーフリマ・ラクマ）用 Puppeteer取得
   ========================================================= */
async function fetchPuppeteerPlatforms() {
  let browser;
  const results = { mercari: [], yahoo: [], rakuma: [] };

  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // --- メルカリ ---
    try {
      await page.goto('https://jp.mercari.com/search?keyword=archive&sort=created_time&order=desc', { waitUntil: 'networkidle2', timeout: 15000 });
      results.mercari = await page.evaluate(() => {
        const list = [];
        document.querySelectorAll('li[data-testid="item-cell"]').forEach(el => {
          const a = el.querySelector('a');
          const img = el.querySelector('img');
          const name = el.querySelector('[data-testid="thumbnail-item-name"]') || img;
          const price = el.querySelector('.number__a3505c2d, [class*="price"]');
          if (a && price) {
            list.push({
              shop: 'メルカリ',
              brand: 'Mercari',
              name: name ? (name.alt || name.innerText || '').trim() : 'メルカリ出品商品',
              price: price.innerText.trim(),
              image: img ? img.src : '',
              url: a.href,
              isSoldOut: !!el.querySelector('[aria-label*="売り切れ"], [aria-label*="SOLD"]')
            });
          }
        });
        return list;
      });
    } catch (e) { console.error('[メルカリ] 取得タイムアウト:', e.message); }

    // --- ヤフーフリマ ---
    try {
      await page.goto('https://paypayfleamarket.yahoo.co.jp/search/archive?open=1', { waitUntil: 'networkidle2', timeout: 15000 });
      results.yahoo = await page.evaluate(() => {
        const list = [];
        document.querySelectorAll('a[href*="/item/"]').forEach(el => {
          const img = el.querySelector('img');
          const price = el.querySelector('[class*="Price"]');
          if (price) {
            list.push({
              shop: 'ヤフーフリマ',
              brand: 'Yahoo! Flea',
              name: img ? img.alt : 'ヤフーフリマ商品',
              price: price.innerText.trim(),
              image: img ? img.src : '',
              url: el.href,
              isSoldOut: !!el.querySelector('[class*="SoldOut"]')
            });
          }
        });
        return list;
      });
    } catch (e) { console.error('[ヤフーフリマ] 取得タイムアウト:', e.message); }

    // --- ラクマ ---
    try {
      await page.goto('https://fril.jp/search/archive?sort=created_at', { waitUntil: 'networkidle2', timeout: 15000 });
      results.rakuma = await page.evaluate(() => {
        const list = [];
        document.querySelectorAll('.item').forEach(el => {
          const a = el.querySelector('a.link_to_item');
          const img = el.querySelector('img');
          const name = el.querySelector('.item-box__name');
          const price = el.querySelector('.item-box__price');
          if (a && price) {
            list.push({
              shop: 'ラクマ',
              brand: 'Rakuma',
              name: name ? name.innerText.trim() : 'ラクマ商品',
              price: price.innerText.trim(),
              image: img ? img.src : '',
              url: a.href,
              isSoldOut: !!el.querySelector('.item-box__soldout_tag')
            });
          }
        });
        return list;
      });
    } catch (e) { console.error('[ラクマ] 取得タイムアウト:', e.message); }

  } catch (err) {
    console.error('Puppeteer実行エラー:', err);
  } finally {
    if (browser) await browser.close();
  }

  return [...results.mercari, ...results.yahoo, ...results.rakuma];
}

/* =========================================================
   5. 統合APIエンドポイント (/api/items)
   ========================================================= */
app.get('/api/items', async (req, res) => {
  try {
    console.log('--- 全サイト巡回スクレイピング開始 ---');

    const [kindal, ragtag, kld, puppeteerItems] = await Promise.all([
      fetchKindal(),
      fetchRagtag(),
      fetchKld(),
      fetchPuppeteerPlatforms()
    ]);

    const allItems = [...kindal, ...ragtag, ...kld, ...puppeteerItems];

    // デモ用データ（全スクレイピングが空だった場合用のフォールバック）
    if (allItems.length === 0) {
      return res.json([
        { shop: 'カインドオル', brand: 'Maison Margiela', name: 'ドライバーズニット', price: '¥68,200', image: 'https://via.placeholder.com/400x500/17171c/888888?text=Kindal', url: '#', isSoldOut: false },
        { shop: 'メルカリ', brand: 'Dior Homme', name: '04AW ラスターコーティングデニム', price: '¥120,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=Mercari', url: '#', isSoldOut: false },
        { shop: 'RAGTAG', brand: 'Rick Owens', name: 'ジオバスケット スニーカー', price: '¥85,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=RAGTAG', url: '#', isSoldOut: true },
        { shop: 'ヤフーフリマ', brand: 'Number (N)ine', name: '01AW タイム期 グランジニット', price: '¥45,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=Yahoo', url: '#', isSoldOut: false },
        { shop: 'KLD', brand: 'Undercover', name: '85デニム パンツ', price: '¥210,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=KLD', url: '#', isSoldOut: false },
        { shop: 'ラクマ', brand: 'Raf Simons', name: '02SS テロ期 スウェット', price: '¥150,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=Rakuma', url: '#', isSoldOut: false }
      ]);
    }

    res.json(allItems);
  } catch (error) {
    console.error('API内部エラー:', error);
    res.status(500).json({ error: 'データ取得に失敗しました' });
  }
});

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`ARCHIVE WATCH サーバー起動完了`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`========================================`);
});
