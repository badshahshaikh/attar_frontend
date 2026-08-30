# MS Fragrance – MVP Backend

Simple Node.js + Express + PostgreSQL backend for MS Fragrance product management.

## Stack
- **Runtime**: Node.js
- **Framework**: Express
- **Database**: PostgreSQL (via `pg`)
- **Image upload**: Multer (stored locally in `/uploads`)

## Setup

### 1. Install dependencies
```bash
cd ms_fragrance_backend
npm install
```

### 2. Create PostgreSQL database
```sql
CREATE DATABASE ms_fragrance;
```

### 3. Run the schema
```bash
psql -U postgres -d ms_fragrance -f schema.sql
```

### 4. Configure .env
Edit `.env` and set your `DB_PASSWORD` (and other values if different):
```
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ms_fragrance
DB_USER=postgres
DB_PASSWORD=your_actual_password
```

### 5. Start the backend
```bash
npm run dev    # development (nodemon, auto-restarts)
npm start      # production
```

## Admin Panel
Open **http://localhost:5000** in your browser.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get single product |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/:id` | Update a product |
| DELETE | `/api/products/:id` | Delete a product |
| POST | `/api/products/upload-image` | Upload product image (multipart/form-data, field: `image`) |
| GET | `/api/health` | Health check |

## Connecting the React Frontend
In your React app, replace the `mockProducts` import with an API call:

```js
// Before (mockProducts.js)
import { mockProducts } from '../data/mockProducts';

// After (API)
const [products, setProducts] = useState([]);
useEffect(() => {
  fetch('http://localhost:5000/api/products')
    .then(r => r.json())
    .then(setProducts);
}, []);
```

The API response shape exactly mirrors `mockProducts.js` (camelCase, same field names).
