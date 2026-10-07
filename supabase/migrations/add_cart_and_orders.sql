-- ============================================================================
-- Cart & Orders
-- ============================================================================
--
-- Adds the shopper cart and the order system ShoppieApp has never had.
--
-- The ShoppieChat architecture doc (docs/SHOPPIECHAT_ARCHITECTURE.md §10) says
-- ShoppieChat orders "should become normal ShoppieApp orders", that we must
-- "use the existing ShoppieApp order schema if one already exists", and that
-- we must snapshot name and price at order time, re-check stock during order
-- creation, prevent overselling, and return an order reference. There is no
-- order schema in this project today, so this file creates the one both the
-- storefront and ShoppieChat will share.
--
-- Design notes that matter for review:
--
-- * The client never sends a price. Checkout posts product ids and quantities
--   only; create_order() reads products.price itself. An optional
--   `expected_price` lets the client detect a price change, but it is never
--   used to *set* the price — a mismatch aborts the order.
-- * products only has a boolean `in_stock`, which cannot be decremented. This
--   adds `stock_qty`, nullable, meaning "not tracked". Existing rows keep
--   behaving exactly as they do today (boolean gate only) and a vendor opts in
--   by declaring a quantity. When tracked, stock is decremented under a row
--   lock and `in_stock` flips false at zero.
-- * Every write path goes through SECURITY DEFINER functions so row level
--   security never has to let a shopper touch products.stock_qty. Ownership is
--   resolved from auth.uid() inside the function — never from a client value.
-- * orders.buyer_id is nullable and orders.source records where the order came
--   from, so a WhatsApp/ShoppieChat order without a Supabase session can still
--   be a normal order row later on.

-- ---------------------------------------------------------------------------
-- 1. Optional stock tracking
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_qty INTEGER;

COMMENT ON COLUMN public.products.stock_qty IS
  'Units available when the vendor tracks inventory. NULL means not tracked: only products.in_stock gates the sale, and no decrement happens.';

-- ---------------------------------------------------------------------------
-- 2. cart_items
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1
    CHECK (quantity > 0 AND quantity <= 999),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_items_user_id_idx ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON public.cart_items(product_id);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_items_select_own" ON public.cart_items;
CREATE POLICY "cart_items_select_own" ON public.cart_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_insert_own" ON public.cart_items;
CREATE POLICY "cart_items_insert_own" ON public.cart_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_update_own" ON public.cart_items;
CREATE POLICY "cart_items_update_own" ON public.cart_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_delete_own" ON public.cart_items;
CREATE POLICY "cart_items_delete_own" ON public.cart_items
  FOR DELETE USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. orders
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL DEFAULT '',
  buyer_id UUID,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'store'
    CHECK (source IN ('store', 'chat', 'whatsapp', 'admin')),
  fulfillment_type TEXT NOT NULL DEFAULT 'pickup'
    CHECK (fulfillment_type IN ('pickup', 'delivery')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'ready', 'delivered', 'cancelled')),
  subtotal NUMERIC(14,2) NOT NULL CHECK (subtotal >= 0),
  customer_note TEXT CHECK (customer_note IS NULL OR char_length(customer_note) <= 500),
  conversation_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS orders_reference_key ON public.orders(reference);
CREATE INDEX IF NOT EXISTS orders_buyer_id_idx ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_vendor_id_idx ON public.orders(vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_vendor_status_idx ON public.orders(vendor_id, status);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_buyer" ON public.orders;
CREATE POLICY "orders_select_buyer" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "orders_select_vendor" ON public.orders;
CREATE POLICY "orders_select_vendor" ON public.orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.vendors v
      WHERE v.id = orders.vendor_id AND v.user_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies — rows are only written by the
-- SECURITY DEFINER functions below.

-- ---------------------------------------------------------------------------
-- 4. order_items  (snapshots — never re-read from products for display)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  line_total NUMERIC(14,2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON public.order_items(product_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_related" ON public.order_items;
CREATE POLICY "order_items_select_related" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.buyer_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.vendors v
                        WHERE v.id = o.vendor_id AND v.user_id = auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 5. updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER set_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. create_order()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_order(
  p_items JSONB,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_buyer      UUID := auth.uid();
  v_note       TEXT := NULLIF(btrim(coalesce(p_note, '')), '');
  -- Merged cart lines: product_id -> {"quantity": int, "expected_price": num|null}
  v_lines      JSONB := '{}'::JSONB;
  v_item       JSONB;
  v_pid        UUID;
  v_key        TEXT;
  v_qty        INTEGER;
  v_num        NUMERIC;
  v_expected   NUMERIC;
  v_existing   JSONB;
  v_wanted     INTEGER;
  v_resolved   INTEGER := 0;
  v_product    RECORD;
  v_group      RECORD;
  v_reference  TEXT;
  v_order_id   UUID;
  v_orders     JSONB := '[]'::JSONB;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'ORDER_FAILED:not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'ORDER_FAILED:empty_cart';
  END IF;

  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'ORDER_FAILED:too_many_items';
  END IF;

  IF v_note IS NOT NULL AND char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'ORDER_FAILED:note_too_long';
  END IF;

  -- ── 1. Validate every line's shape and merge duplicate product rows ──
  -- Prices from the client are never trusted here: expected_price is only a
  -- change-detection guard compared against products.price below.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object'
       OR jsonb_typeof(v_item->'product_id') IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item->'quantity') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'ORDER_FAILED:invalid_item';
    END IF;

    IF lower(v_item->>'product_id')
         !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'ORDER_FAILED:invalid_item';
    END IF;

    v_num := (v_item->>'quantity')::numeric;
    IF v_num < 1 OR v_num > 999 OR v_num <> trunc(v_num) THEN
      RAISE EXCEPTION 'ORDER_FAILED:invalid_item';
    END IF;
    v_qty := v_num::integer;

    v_expected := NULL;
    IF v_item ? 'expected_price'
       AND jsonb_typeof(v_item->'expected_price') IS DISTINCT FROM 'null' THEN
      IF jsonb_typeof(v_item->'expected_price') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'ORDER_FAILED:invalid_item';
      END IF;
      v_expected := (v_item->>'expected_price')::numeric;
      IF v_expected < 0 THEN
        RAISE EXCEPTION 'ORDER_FAILED:invalid_item';
      END IF;
    END IF;

    v_pid := lower(v_item->>'product_id')::uuid;
    v_key := v_pid::text;
    v_existing := coalesce(v_lines->v_key, '{}'::jsonb);
    -- Quantities add up across duplicate rows (capped by the 999 CHECK on the
    -- cart; here the per-line cap above keeps each addition in range and the
    -- merged total is still bounded by 100 lines * 999).
    v_lines := jsonb_set(
      v_lines,
      ARRAY[v_key],
      jsonb_build_object(
        'quantity', coalesce((v_existing->>'quantity')::integer, 0) + v_qty,
        'expected_price',
          CASE WHEN v_existing->>'expected_price' IS NOT NULL
               THEN v_existing->'expected_price'
               ELSE to_jsonb(v_expected)
          END
      ),
      true
    );
  END LOOP;

  -- ── 2. Lock and validate the products this order touches ──────────────
  SELECT count(*) INTO v_wanted FROM jsonb_object_keys(v_lines);

  FOR v_product IN
    SELECT p.id, p.vendor_id, p.name, p.image_url, p.price, p.in_stock, p.stock_qty
      FROM public.products p
     WHERE p.id IN (SELECT k::uuid FROM jsonb_object_keys(v_lines) AS k)
     ORDER BY p.id
       FOR UPDATE
  LOOP
    v_resolved := v_resolved + 1;
    v_expected := (v_lines->(v_product.id::text))->>'expected_price';

    IF NOT v_product.in_stock THEN
      RAISE EXCEPTION 'ORDER_FAILED:out_of_stock:%', v_product.name;
    END IF;

    IF v_expected IS NOT NULL AND v_expected IS DISTINCT FROM v_product.price THEN
      RAISE EXCEPTION 'ORDER_FAILED:price_changed:%', v_product.name;
    END IF;

    IF v_product.stock_qty IS NOT NULL
       AND ((v_lines->(v_product.id::text))->>'quantity')::integer > v_product.stock_qty THEN
      RAISE EXCEPTION 'ORDER_FAILED:insufficient_stock:%', v_product.name;
    END IF;
  END LOOP;

  IF v_resolved <> v_wanted THEN
    RAISE EXCEPTION 'ORDER_FAILED:unavailable_product';
  END IF;

  -- ── 3. One order per vendor, snapshotting name/price at this moment ───
  FOR v_group IN
    SELECT p.vendor_id,
           sum(p.price * ((v_lines -> (p.id::text)) ->> 'quantity')::integer)::numeric(14,2)
             AS subtotal
      FROM public.products p
     WHERE p.id IN (SELECT k::uuid FROM jsonb_object_keys(v_lines) AS k)
     GROUP BY p.vendor_id
     ORDER BY p.vendor_id
  LOOP
    LOOP
      v_reference := 'SHP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.orders o WHERE o.reference = v_reference
      );
    END LOOP;

    INSERT INTO public.orders
      (reference, buyer_id, vendor_id, source, fulfillment_type, status, subtotal, customer_note)
    VALUES
      (v_reference, v_buyer, v_group.vendor_id, 'store', 'pickup', 'pending',
       v_group.subtotal, v_note)
    RETURNING id INTO v_order_id;

    INSERT INTO public.order_items
      (order_id, product_id, product_name, product_image, unit_price, quantity, line_total)
    SELECT v_order_id,
           p.id,
           p.name,
           p.image_url,
           p.price,
           ((v_lines -> (p.id::text)) ->> 'quantity')::integer,
           round(p.price * ((v_lines -> (p.id::text)) ->> 'quantity')::integer, 2)
      FROM public.products p
     WHERE p.vendor_id = v_group.vendor_id
       AND p.id IN (SELECT k::uuid FROM jsonb_object_keys(v_lines) AS k)
     ORDER BY p.id;

    -- Tracked stock only: decrement under the row locks taken above; a product
    -- drops off the shelf when it reaches zero. Untracked products (NULL) keep
    -- behaving exactly as they always have — the boolean gate alone.
    UPDATE public.products p
       SET stock_qty = p.stock_qty - ((v_lines -> (p.id::text)) ->> 'quantity')::integer,
           in_stock  = (p.stock_qty - ((v_lines -> (p.id::text)) ->> 'quantity')::integer) > 0
     WHERE p.vendor_id = v_group.vendor_id
       AND p.stock_qty IS NOT NULL
       AND p.id IN (SELECT k::uuid FROM jsonb_object_keys(v_lines) AS k);

    v_orders := v_orders || jsonb_build_array(jsonb_build_object(
      'id',               v_order_id,
      'reference',        v_reference,
      'vendor_id',        v_group.vendor_id,
      'subtotal',         v_group.subtotal,
      'status',           'pending',
      'fulfillment_type', 'pickup',
      'fulfillment',      'pickup'
    ));
  END LOOP;

  -- ── 4. Everything was purchased — the shopper starts from an empty cart ─
  DELETE FROM public.cart_items
   WHERE user_id = v_buyer
     AND product_id IN (SELECT k::uuid FROM jsonb_object_keys(v_lines) AS k);

  RETURN v_orders;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order(JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(JSONB, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. update_order_status()
-- ---------------------------------------------------------------------------
--
-- Only the vendor who owns the order may transition it, and only along the
-- legal path. The buyer has no write access at all — their view of an order is
-- read-only, which is why orders carries no UPDATE policy.

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id UUID,
  p_status TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller  UUID := auth.uid();
  v_order   public.orders%ROWTYPE;
  v_allowed TEXT[];
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'ORDER_FAILED:not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('pending', 'confirmed', 'ready', 'delivered', 'cancelled') THEN
    RAISE EXCEPTION 'ORDER_FAILED:invalid_status';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_FAILED:not_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vendors v
    WHERE v.id = v_order.vendor_id AND v.user_id = v_caller
  ) THEN
    RAISE EXCEPTION 'ORDER_FAILED:not_owner' USING ERRCODE = '42501';
  END IF;

  IF v_order.status = p_status THEN
    RETURN to_jsonb(v_order);
  END IF;

  v_allowed := CASE v_order.status
    WHEN 'pending'   THEN ARRAY['confirmed', 'cancelled']
    WHEN 'confirmed' THEN ARRAY['ready', 'cancelled', 'pickup_ready']
    WHEN 'pickup_ready' THEN ARRAY['delivered', 'cancelled']
    WHEN 'ready'     THEN ARRAY['delivered', 'cancelled']
    ELSE ARRAY[]::TEXT[]  -- delivered / cancelled are terminal
  END;

  IF NOT (p_status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'ORDER_FAILED:illegal_transition:%->%', v_order.status, p_status;
  END IF;

  UPDATE public.orders
  SET status = p_status,
      confirmed_at = CASE WHEN p_status = 'confirmed' THEN now() ELSE confirmed_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN to_jsonb(v_order);
END;
$$;

REVOKE ALL ON FUNCTION public.update_order_status(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status(UUID, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
