-- Bulk upsert RPC function for efficient import
-- Replaces O(n) HTTP requests with single database call

CREATE OR REPLACE FUNCTION public.bulk_upsert_records(
  p_account_id UUID,
  p_batch_id UUID,
  p_records JSONB  -- Array of record objects
)
RETURNS TABLE (
  inserted_count INT,
  updated_count INT,
  record_ids JSONB  -- Array of {ebay_order_id, id} for order_remarks
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_inserted INT := 0;
  v_updated INT := 0;
  v_ids JSONB := '[]'::JSONB;
  v_record JSONB;
  v_result RECORD;
BEGIN
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    INSERT INTO bookkeeping_records (
      account_id, import_batch_id, ebay_order_id, sale_date, item_name,
      qty, sale_price_cents, status, ebay_fees_cents, amazon_price_cents,
      amazon_tax_cents, amazon_shipping_cents, amazon_order_id
    ) VALUES (
      p_account_id,
      p_batch_id,
      v_record->>'ebay_order_id',
      (v_record->>'sale_date')::DATE,
      v_record->>'item_name',
      COALESCE((v_record->>'qty')::INT, 1),
      (v_record->>'sale_price_cents')::INT,
      COALESCE(v_record->>'status', 'SUCCESSFUL')::bookkeeping_status,
      (v_record->>'ebay_fees_cents')::INT,
      (v_record->>'amazon_price_cents')::INT,
      (v_record->>'amazon_tax_cents')::INT,
      (v_record->>'amazon_shipping_cents')::INT,
      v_record->>'amazon_order_id'
    )
    ON CONFLICT (account_id, ebay_order_id) WHERE deleted_at IS NULL
    DO UPDATE SET
      sale_date = EXCLUDED.sale_date,
      item_name = EXCLUDED.item_name,
      qty = EXCLUDED.qty,
      sale_price_cents = EXCLUDED.sale_price_cents,
      status = EXCLUDED.status,
      ebay_fees_cents = EXCLUDED.ebay_fees_cents,
      amazon_price_cents = EXCLUDED.amazon_price_cents,
      amazon_tax_cents = EXCLUDED.amazon_tax_cents,
      amazon_shipping_cents = EXCLUDED.amazon_shipping_cents,
      amazon_order_id = EXCLUDED.amazon_order_id,
      updated_at = NOW()
    RETURNING id, ebay_order_id, (xmax = 0) AS was_inserted INTO v_result;

    IF v_result.was_inserted THEN
      v_inserted := v_inserted + 1;
    ELSE
      v_updated := v_updated + 1;
    END IF;

    v_ids := v_ids || jsonb_build_object(
      'ebay_order_id', v_result.ebay_order_id,
      'id', v_result.id
    );
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_updated, v_ids;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_upsert_records TO authenticated;
