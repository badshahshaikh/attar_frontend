# MS Fragrance MCP Server

A Model Context Protocol (MCP) server that exposes read-only tools for querying MS Fragrance e-commerce store data. Connect this server to ChatGPT to interact with your store using natural language.

## Prerequisites

- Node.js v22 or higher
- npm 10.9 or higher
- Access to the MS Fragrance backend API
- Valid admin authentication token (JWT)

## Installation

```bash
cd ms_fragrance_mcp
npm install
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `BACKEND_API_URL` — Backend API URL (e.g., `http://localhost:5000`)
- `BACKEND_ADMIN_TOKEN` — Admin JWT token from backend authentication
- `MCP_PORT` — MCP server port (default: 3001)
- `NODE_ENV` — Environment (development/production)

## Local Startup

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## Testing

```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_latest_orders` | Retrieve the most recent orders |
| `get_order_details` | Get order by ID with full details |
| `search_orders` | Search orders by status, payment, search term |
| `search_customers` | Search customers by name/email |
| `get_customer_details` | Get customer profile by ID |
| `list_products` | List/filter products |
| `get_product_by_id` | Get product by ID |
| `get_sales_summary` | Calculate sales analytics |

## ChatGPT Integration

### Local Development
1. Start the server: `npm run dev`
2. Use MCP Inspector: `npx @modelcontextprotocol/inspector http://localhost:3001/mcp`

### Remote Deployment
1. Deploy to Vercel, Railway, or your preferred hosting
2. Ensure HTTPS is enabled
3. Set environment variables in your hosting platform
4. Configure ChatGPT to connect to `https://your-domain.com/mcp`

### ChatGPT Connection
1. Go to ChatGPT Settings → Apps → Add Custom App
2. Enter your MCP server URL (HTTPS required for remote)
3. Authenticate using your configured API key

## Security Considerations

- **Read-Only**: All tools are read-only. No write/delete operations.
- **Authentication**: Every request requires a valid admin JWT token.
- **Data Minimization**: Only necessary customer fields are returned (no passwords, tokens, or payment credentials).
- **Rate Limiting**: Consider implementing rate limiting for production use.
- **HTTPS**: Required for remote ChatGPT connections.

## Limitations

- Products can only be searched by category/brand/price, not by name/description
- Customer order history requires authenticated customer session
- Sales summary is calculated from fetched orders (not a dedicated analytics endpoint)
- No product reviews/ratings data available
- No inventory stock levels across all products (only per-product)

## Backend API Mappings

All tools map to existing backend endpoints:
- Orders: `GET /api/orders`, `GET /api/orders/:id`
- Customers: `GET /api/users`
- Products: `GET /api/products`, `GET /api/products/:id`

## License
MIT