# MS Fragrance Backend

Express API for MS Fragrance product management. The API uses Supabase PostgreSQL through the `pg` connection pool. The React frontend continues to communicate only with this API.

## Stack

- Node.js
- Express
- PostgreSQL on Supabase
- Multer for local image uploads

## Development Setup

From the backend directory:

```bash
npm install
npm run dev
```

The API runs at `http://localhost:5000`.

## Environment Variables

Create `ms_fragrance_backend/.env` from `.env.example`:

```env
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
DATABASE_URL=postgresql://postgres:your-password@db.example.supabase.co:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=product-images
```

`DATABASE_URL` is backend-only. Never place it in the root frontend `.env` or expose it to Vite.

`SUPABASE_SERVICE_ROLE_KEY` is backend-only and must never be committed or sent to the frontend.

Create a public Supabase Storage bucket named `product-images` before using image uploads. Upload and delete operations remain controlled by the Express backend.

## Supabase Schema

The PostgreSQL schema is in `schema.sql`. The backend initializes it when the first database query runs. Structured product fields use JSONB and database flags use PostgreSQL booleans.

## Migrating Existing SQLite Data

Keep the existing `data/ms_fragrance.db` file as a backup. After configuring a real `DATABASE_URL`, run:

```bash
npm run migrate:supabase
```

The migration reads SQLite, upserts products by numeric ID, preserves existing IDs, and does not delete or modify the SQLite database. An alternate source file can be selected with `SQLITE_PATH`.

## Migrating Local Images

Existing local `/uploads/...` image files can be copied to Storage explicitly after configuring the Storage variables:

```bash
npm run migrate:images
```

The command skips external and already-migrated URLs, updates PostgreSQL only after a successful upload, and never deletes original local files.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Health check |
| GET | `/api/products` | List products with search, filters, and pagination |
| GET | `/api/products/:id` | Get one product by numeric ID |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |
| POST | `/api/products/upload-image` | Upload an image using multipart field `image` |
| GET | `/api/products/brands` | Supported brands |
| GET | `/api/products/fragrance-families` | Supported fragrance families |
