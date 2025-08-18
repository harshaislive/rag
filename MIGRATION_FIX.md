# Database Migration Fix

## Issue
Upload was failing with 500 error: `column "description" of relation "resources" does not exist`

## Solution  
Manually added missing columns to production database:
- `description` (text)
- `uploaded_by` (varchar(255))
- `brand` (varchar(50))

## Commands Run
```sql
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "uploaded_by" varchar(255);
ALTER TABLE "resources" ADD COLUMN IF NOT EXISTS "brand" varchar(50);
```

## Status
✅ Columns added successfully
✅ Upload functionality should now work