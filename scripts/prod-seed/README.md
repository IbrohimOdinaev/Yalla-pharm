# Prod seed: pharmacy offers + avatars

Two one-shot operations to bring NovaFarma / OriyonFarma / SifatFarma in
line with WooCommerce on the prod database:

1. **Offers** — add ~16,926 random offers (5642 per pharmacy) so every
   active medicine has price+stock in every pharmacy.
2. **Avatars** — upload 3 themed JPEG avatars and set `IconUrl`.

Both are **idempotent** — re-running skips work that's already done.

## What gets seeded

- Price range: 5–500 TJS, rounded to 0.50.
- Stock range: 5–150 units, with ~7% out-of-stock (0) for realism.
- Existing offers (200 per pharmacy from older seed + WooCommerce's full
  catalog) are not touched.
- Pharmacies with a non-empty `IconUrl` are skipped unless `FORCE=1`.

## 1. Offers (SQL only)

Run on prod via Render's psql shell or any tool with `PROD_PG_DSN`:

```bash
psql "$PROD_PG_DSN" -f seed-offers.sql
```

Expected final output:

```
            title             | offers
------------------------------+--------
 NovaFarma 15284              |   5842
 OriyonFarma                  |   5842
 SifatFarma                   |   5842
 WooCommerce (pharm.yalla.tj) |   5842
```

## 2. Avatars (S3 upload + DB update)

Requires `mc` (MinIO client) and `psql` on the host running the script,
plus prod credentials.

```bash
export PROD_PG_DSN="postgresql://USER:PASS@HOST:5432/DB"
export PROD_S3_ENDPOINT="https://YOUR_MINIO_ENDPOINT"
export PROD_S3_KEY="YOUR_ACCESS_KEY"
export PROD_S3_SECRET="YOUR_SECRET_KEY"
export PROD_S3_BUCKET="yalla-farm-medicines"

./seed-avatars.sh
```

Pharmacy IDs are hard-coded (they match the seed in `UserConfiguration.cs`
and won't change). The script writes objects under
`medicines/YYYY/MM/DD/{guid}.jpg` to match the pattern used by the
`MinIoMedicineImageStorage` and the existing WooCommerce icon.

## Files

- `seed-offers.sql` — bulk INSERT, no destructive changes.
- `seed-avatars.sh` — idempotent S3 upload + DB update.
- `novafarma.jpg`, `oriyonfarma.jpg`, `sifatfarma.jpg` — 240×240 themed
  JPEGs (downloaded from loremflickr `pharmacy/medicine/pill/drugstore`
  tags). Replace with branded artwork at any time — `IconUrl` will pick
  up the new file on the next overwrite.

## Rollback

For avatars, just clear `IconUrl`:

```sql
UPDATE pharmacies SET "IconUrl" = NULL
WHERE id IN (
  '2c508c69-7ea1-4213-8dae-7b9d49b70d68',
  '305d3bb2-20fa-42fd-b751-b21cb9be3548',
  '4b1ab8a3-6120-43bb-9405-edec146dce4e'
);
```

For offers, take a snapshot before running the SQL — there's no per-row
`created_at`, so a partial undo would need either snapshot restore or a
custom delete keyed on the seed price/stock distribution.
