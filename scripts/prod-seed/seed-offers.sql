-- Idempotent seed: ~17K random offers across all non-WooCommerce pharmacies.
-- Skips any (medicine_id, pharmacy_id) pair that already has an offer.
--
-- Price: 5..500 TJS, rounded to 0.50
-- Stock: 5..150 units, with ~7% intentionally out-of-stock (0)
--
-- Safe to re-run; existing offers are not touched.

INSERT INTO offers (id, medicine_id, pharmacy_id, price, stock_quantity)
SELECT
  gen_random_uuid(),
  m.id,
  p.id,
  ROUND(((5 + RANDOM() * 495) * 2)::numeric, 0) / 2,
  CASE WHEN RANDOM() < 0.07 THEN 0 ELSE 5 + (RANDOM() * 145)::int END
FROM medicines m
CROSS JOIN pharmacies p
WHERE m.is_active = true
  AND p.title NOT ILIKE '%woocommerce%'
  AND NOT EXISTS (
    SELECT 1 FROM offers o2
    WHERE o2.medicine_id = m.id AND o2.pharmacy_id = p.id
  );

-- Verification: should show every active pharmacy with offers count == active medicines count.
SELECT p.title, COUNT(o.id) AS offers
FROM pharmacies p
LEFT JOIN offers o ON o.pharmacy_id = p.id
GROUP BY p.title
ORDER BY p.title;
