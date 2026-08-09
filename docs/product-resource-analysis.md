# Product Resource Coverage Analysis

Sprint 15.70-A | 2026-08-09

## 1. Current Product Categories (9 total)

From `SALES_PRODUCTS` array in `lib/products/hot-products.ts:27-37`:

| # | ID | Name (zh-CN) | Name (en) |
|---|----|--------------|-----------|
| 1 | `bathroom_faucet` | 浴室水龙头 | Bathroom faucets |
| 2 | `faucet_parts` | 龙头配件与零件 | Faucet parts & accessories |
| 3 | `shower_tray` | 淋浴底盆 | Shower trays |
| 4 | `bathtub` | 浴缸 | Bathtubs |
| 5 | `shower_door` | 淋浴房与淋浴门 | Shower doors & enclosures |
| 6 | `shower_system` | 花洒与淋浴系统 | Shower heads & systems |
| 7 | `backwall` | 淋浴背板与墙板 | Shower backwalls & panels |
| 8 | `drain` | 浴缸与淋浴排水件 | Bath & shower drains |
| 9 | `valve` | 卫浴阀门 | Bathroom valves |

## 2. Current REPRESENTATIVE_PRODUCTS Entries (4 of 9)

From `REPRESENTATIVE_PRODUCTS` record in `lib/products/hot-products.ts:20-25`:

| Category | Title | Brand | Product URL | Image URL | Source |
|----------|-------|-------|-------------|-----------|--------|
| `shower_tray` | SlimLine acrylic shower base | DreamLine | dreamline.com product page | **null** | DreamLine official product page |
| `bathtub` | Studio 60 × 36-inch drop-in bathtub | American Standard | americanstandard-us.com | Shopify CDN (cdn.shopify.com) | American Standard official product page |
| `shower_door` | Unidoor frameless hinged shower door | DreamLine | dreamline.com collection page | Cloudinary (res.cloudinary.com) | DreamLine official collection page |
| `bathroom_faucet` | Lahara single-handle bathroom faucet | Delta | deltafaucet.com | **null** | Delta official product page |

## 3. Missing Categories (5 without representative products)

| ID | Name | Priority note |
|----|------|---------------|
| `faucet_parts` | 龙头配件与零件 | High volume; parts often shipped separately |
| `shower_system` | 花洒与淋浴系统 | Core Yundor product line |
| `backwall` | 淋浴背板与墙板 | Niche but present in trade data |
| `drain` | 浴缸与淋浴排水件 | Accessory category |
| `valve` | 卫浴阀门 | Overlaps with faucet parts |

## 4. Image Availability

| Status | Count | Categories |
|--------|-------|------------|
| Stable CDN image URL | 2 | `bathtub` (Shopify CDN), `shower_door` (Cloudinary) |
| Image URL is null | 2 (of 4 with entries) | `shower_tray`, `bathroom_faucet` |
| No entry at all | 5 | `faucet_parts`, `shower_system`, `backwall`, `drain`, `valve` |

**Coverage**: 2 of 9 categories (22%) have a usable representative product image.

## 5. Data Structure: RepresentativeProduct Interface

Defined in `lib/products/hot-products.ts:2`:

```typescript
export interface RepresentativeProduct {
  title: string;         // Product model/name
  brand: string;         // Manufacturer brand
  productUrl: string;    // URL to official product page
  imageUrl: string|null; // URL to official product image (null = not yet acquired)
  sourceName: string;    // Human-readable source attribution
}
```

In `HotProduct` interface (line 3): `representativeProduct: RepresentativeProduct | null`

In `rankHotProducts` (line 55): each product gets `representativeProduct: REPRESENTATIVE_PRODUCTS[product.id] || null`

## 6. How Images Are Rendered: HotProductList Logic

From `app/page.tsx:245` (`HotProductList` component, line 237-251):

```tsx
{product.representativeProduct?.imageUrl
  ? <a className="hot-product-image" href={product.representativeProduct.productUrl} target="_blank" rel="noreferrer">
      <img src={product.representativeProduct.imageUrl} alt={product.representativeProduct.title}/>
    </a>
  : <span className="hot-product-image placeholder">{product.name.slice(0,1)}</span>
}
```

- **Image available**: Clickable image wrapped in `<a>` linking to official product page. Image loads from CDN URL. Opens in new tab.
- **Image unavailable (null)**: CSS-styled placeholder `<span>` showing first character of the Chinese product name (e.g. "淋" for 淋浴底盆).
- **No representative product at all**: Same placeholder fallback as above (the optional chain `?.imageUrl` returns `undefined`, triggering the placeholder branch).

The "Representative" attribution link (brand · title) is rendered separately below the image, linking to `productUrl`. It only renders when `representativeProduct` exists.

## 7. Next Steps

### Immediate (this Sprint context)
- Source representative products for the 5 missing categories
- Acquire stable image URLs for `shower_tray` and `bathroom_faucet` (already have product pages, just need images)
- Verify image URL stability for `bathtub` (Shopify CDN) and `shower_door` (Cloudinary) — both appear stable

### Recommended order by business priority

1. **`shower_system`** — Core Yundor product line; high buyer relevance
2. **`faucet_parts`** — High shipment volume; complements bathroom_faucet
3. **`valve`** — Core plumbing category
4. **`drain`** — Accessory but complements bathtub/shower_tray
5. **`backwall`** — Lowest priority; niche category

### Image stability verification criteria
- Prefer official manufacturer CDN URLs (e.g. Shopify, Cloudinary) over retailer hotlinks
- Avoid Google Image Search result URLs (they expire)
- Avoid AI-generated or stock photos
- Image must be traceable to brand's official product page
- Record date verified for each image URL
