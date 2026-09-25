-- Vendor discounts and promotions.
--
-- `price` keeps its meaning: the price a shopper actually pays. A promotion
-- adds the "was" price plus optional campaign metadata on top of it, so an
-- active discount is simply `original_price > price`. That is the rule the
-- product carousel already assumed (see components/horizontal-product-carousel.tsx)
-- before the columns existed.
--
-- `promo_ends_at` is optional. When it is set and has passed, the promotion is
-- treated as over: shoppers see `original_price` as the effective price again
-- and no discount badge. This makes flash sales revert on their own without
-- the vendor having to edit the listing at midnight.

ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_label TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_ends_at TIMESTAMPTZ;

-- Shoppers filter the store by price, so the discount a promo is judged on is
-- the price they will pay, not the struck-through one.
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- The "Deals" carousel only ever selects products that have a promotion.
CREATE INDEX IF NOT EXISTS idx_products_on_promotion
  ON products(original_price, promo_ends_at)
  WHERE original_price IS NOT NULL;
