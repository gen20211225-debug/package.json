const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname)));
app.use('/src', express.static(path.join(__dirname, 'src')));

// 共通ヘッダー（ブロック防止）
const HTTP_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

/* =========================================================
   1. カインドオル (Kindal)
   ========================================================= */
async function fetchKindal() {
  try {
    const { data } = await axios.get('https://www.kind.co.jp/searches', { headers: HTTP_HEADERS });
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
   2. RAGTAG
   ========================================================= */
async function fetchRagtag() {
  try {
    const { data } = await axios.get('https://www.ragtag.jp/search', { headers: HTTP_HEADERS });
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
   3. KLD
   ========================================================= */
async function fetchKld() {
  try {
    const { data } = await axios.get('https://kld-c.jp/collections/all', { headers: HTTP_HEADERS });
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
   統合API (/api/items)
   ========================================================= */
app.get('/api/items', async (req, res) => {
  try {
    const [kindal, ragtag, kld] = await Promise.all([
      fetchKindal(),
      fetchRagtag(),
      fetchKld()
    ]);

    const allItems = [...kindal, ...ragtag, ...kld];

    // スクレイピングデータが取得できない場合のテスト用モックデータ
    if (allItems.length === 0) {
      return res.json([
        { shop: 'カインドオル', brand: 'Maison Margiela', name: 'ドライバーズニット', price: '¥68,200', image: 'https://via.placeholder.com/400x500/17171c/888888?text=Kindal', url: '#', isSoldOut: false },
        { shop: 'RAGTAG', brand: 'Rick Owens', name: 'ジオバスケット スニーカー', price: '¥85,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=RAGTAG', url: '#', isSoldOut: true },
        { shop: 'KLD', brand: 'Undercover', name: '85デニム パンツ', price: '¥210,000', image: 'https://via.placeholder.com/400x500/17171c/888888?text=KLD', url: '#', isSoldOut: false }
      ]);
    }

    res.json(allItems);
  } catch (error) {
    console.error('API内部エラー:', error);
    res.status(500).json({ error: 'データ取得に失敗しました' });
  }
});

app.listen(PORT, () => console.log(`ARCHIVE WATCH Running on http://localhost:${PORT}`));
