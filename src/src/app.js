const shops = [
  "ALL",
  "メルカリ",
  "ヤフーフリマ",
  "ラクマ",
  "カインドオル",
  "RAGTAG",
  "KLD"
];

const brands = [
  "ALL",
  "Dior Homme",
  "Saint Laurent",
  "Rick Owens",
  "Number (N)ine",
  "Undercover",
  "Jean Paul Gaultier",
  "Enfant Riches Déprimés",
  "Julius",
  "Raf Simons",
  "Helmut Lang",
  "Balmain"
];

const categories = [
  "ALL",
  "Tシャツ",
  "シャツ",
  "ジャケット",
  "コート",
  "デニム",
  "パンツ",
  "ニット",
  "シューズ",
  "バッグ",
  "アクセサリー"
];

let products = [];

/* =========================
   データ取得（API接続）
   ========================= */

async function fetchProducts() {
  try {
    const response = await fetch("/api/items");
    const data = await response.json();

    console.log("取得データ:", data);

    if (Array.isArray(data) && data.length > 0) {
      products = data.map(item => ({
        shop: item.shop || "その他",
        brand: item.brand || "KINDAL",
        category: item.category || "ALL",
        name: item.name || item.title || "名称不明",
        price: typeof item.price === "number" 
          ? item.price 
          : Number(String(item.price || 0).replace(/[^0-9]/g, '')) || 0,
        image: item.image || item.img || "",
        url: item.url || item.link || "#",
        sold: item.isSoldOut || item.sold || false
      }));

      renderProducts();
    }
  } catch (error) {
    console.error("API接続エラー:", error);
  }
}

/* =========================
   画面要素
   ========================= */

const shopTabs = document.getElementById("shopTabs");
const brandTabs = document.getElementById("brandTabs");
const categoryTabs = document.getElementById("categoryTabs");
const grid = document.getElementById("grid");
const resultCount = document.getElementById("resultCount");
const showSold = document.getElementById("showSold");
const sort = document.getElementById("sort");

let selectedShop = "ALL";
let selectedBrand = "ALL";
let selectedCategory = "ALL";

/* =========================
   タブ生成
   ========================= */

function createTabs(container, items, selected, onClick) {
  if (!container) return;
  container.innerHTML = "";

  items.forEach(item => {
    const button = document.createElement("button");
    button.textContent = item;

    if (item === selected) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      onClick(item);
    });

    container.appendChild(button);
  });
}

/* =========================
   商品一覧の描画
   ========================= */

function renderProducts() {
  if (!grid) return;

  let filtered = products.filter(product => {
    const shopOK =
      selectedShop === "ALL" ||
      product.shop === selectedShop;

    const brandOK =
      selectedBrand === "ALL" ||
      product.brand.toLowerCase().includes(selectedBrand.toLowerCase()) ||
      product.name.toLowerCase().includes(selectedBrand.toLowerCase());

    const categoryOK =
      selectedCategory === "ALL" ||
      product.category === selectedCategory;

    const soldOK =
      showSold.checked || !product.sold;

    return shopOK && brandOK && categoryOK && soldOK;
  });

  /* 並び替え */
  if (sort.value === "low") {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort.value === "high") {
    filtered.sort((a, b) => b.price - a.price);
  }

  /* HTML描画 */
  grid.innerHTML = "";

  filtered.forEach(product => {
    const card = document.createElement("a");
    card.className = "product-card";
    card.href = product.url;
    card.target = "_blank";
    card.rel = "noopener noreferrer";

    card.innerHTML = `
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
      </div>

      <div class="product-info">
        <div class="product-shop">${product.shop}</div>
        <div class="product-brand">${product.brand}</div>
        <div class="product-name">${product.name}</div>
        <div class="product-price">¥${product.price.toLocaleString()}</div>
        ${
          product.sold
            ? `<div class="sold">SOLD</div>`
            : `<div class="available">AVAILABLE</div>`
        }
      </div>
    `;

    grid.appendChild(card);
  });

  if (resultCount) {
    resultCount.textContent = `${filtered.length} ITEMS`;
  }
}

/* =========================
   初期化
   ========================= */

function render() {
  createTabs(shopTabs, shops, selectedShop, shop => {
    selectedShop = shop;
    render();
  });

  createTabs(brandTabs, brands, selectedBrand, brand => {
    selectedBrand = brand;
    render();
  });

  createTabs(categoryTabs, categories, selectedCategory, category => {
    selectedCategory = category;
    render();
  });

  renderProducts();
}

render();
fetchProducts();

// 1分ごとにデータを更新
setInterval(fetchProducts, 60000);

if (showSold) showSold.addEventListener("change", renderProducts);
if (sort) sort.addEventListener("change", renderProducts);
