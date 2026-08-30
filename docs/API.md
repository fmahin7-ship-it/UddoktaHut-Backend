# API Documentation

This document provides comprehensive documentation for all UddoktaHut Backend API endpoints, including request/response formats, authentication requirements, and usage examples.

## 📖 Table of Contents

- [Base Information](#base-information)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Authentication Endpoints](#authentication-endpoints)
- [Product Management APIs](#product-management-apis)
- [Store Management APIs](#store-management-apis)
- [Subscription APIs](#subscription-apis)
- [Analytics AI](#analytics-ai)
- [User Management APIs](#user-management-apis)
- [Rate Limiting](#rate-limiting)
- [Postman Collection](#postman-collection)

## 🌐 Base Information

**Base URL:** `http://localhost:4000/api`  
**API Version:** v1  
**Content Type:** `application/json`  
**Authentication:** JWT Bearer Token

### Response Format

All API responses follow this standard format:

```json
{
  "success": true,
  "data": {},
  "message": "Success message",
  "timestamp": "2024-10-19T10:30:00.000Z"
}
```

## 🔐 Authentication

### JWT Token Structure

```javascript
Header: {
  "Authorization": "Bearer <jwt_token>"
}
```

### Token Payload

```json
{
  "id": 123,
  "email": "user@example.com",
  "iat": 1634567890,
  "exp": 1635172690
}
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant D as Database

    C->>A: POST /auth/login
    A->>D: Validate credentials
    D-->>A: User data
    A->>A: Generate JWT
    A-->>C: JWT token + user info

    Note over C: Store token for subsequent requests

    C->>A: GET /products (with JWT)
    A->>A: Verify JWT
    A-->>C: Protected resource
```

## ❌ Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    }
  },
  "timestamp": "2024-10-19T10:30:00.000Z"
}
```

### Common Error Codes

| Code                    | HTTP Status | Description                       |
| ----------------------- | ----------- | --------------------------------- |
| `VALIDATION_ERROR`      | 400         | Input validation failed           |
| `UNAUTHORIZED`          | 401         | Invalid or missing authentication |
| `FORBIDDEN`             | 403         | Insufficient permissions          |
| `NOT_FOUND`             | 404         | Resource not found                |
| `SUBSCRIPTION_REQUIRED` | 403         | No active subscription            |
| `TRIAL_EXPIRED`         | 403         | Trial period ended                |
| `SUBSCRIPTION_EXPIRED`  | 403         | Subscription expired              |
| `INTERNAL_ERROR`        | 500         | Server error                      |

## 🔑 Authentication Endpoints

### Login User

**Endpoint:** `POST /auth/login`  
**Authentication:** None required  
**Description:** Authenticate user and receive JWT token

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "userpassword"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com",
      "onboarded": true,
      "role": 2
    }
  },
  "message": "Login successful"
}
```

#### Error Responses

```json
// 401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

### Register User

**Endpoint:** `POST /auth/register`  
**Authentication:** None required  
**Description:** Create new user account

#### Request Body

```json
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "securepassword",
  "phoneNumber": "+1234567890"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com",
      "phoneNumber": "+1234567890"
    }
  },
  "message": "Account created successfully"
}
```

### Get Current User

**Endpoint:** `GET /auth/me`  
**Authentication:** Required  
**Description:** Get current authenticated user information

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "name": "John Doe",
      "email": "user@example.com",
      "phoneNumber": "+1234567890",
      "onboarded": true,
      "role": 2,
      "template_name": "classic",
      "isActive": true
    }
  }
}
```

## 📦 Product Management APIs

### Get Products

**Endpoint:** `GET /products`  
**Authentication:** Required  
**Description:** Get paginated list of user's products with search and filtering

#### Query Parameters

| Parameter | Type    | Default | Description                              |
| --------- | ------- | ------- | ---------------------------------------- |
| page      | integer | 1       | Page number for pagination               |
| pageSize  | integer | 10      | Number of items per page                 |
| search    | string  | ""      | Search term for name, category, or SKU   |
| sortBy    | string  | "id"    | Sort field (id, name, price, created_at) |
| sortOrder | string  | "desc"  | Sort direction (asc, desc)               |

#### Example Request

```
GET /products?page=1&pageSize=20&search=laptop&sortBy=price&sortOrder=asc
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "name": "Gaming Laptop",
        "description": "High-performance gaming laptop",
        "image": "https://example.com/laptop.jpg",
        "price": "1299.99",
        "stock": 15,
        "status": "Active",
        "category": "Electronics",
        "sku": "LAPTOP-001",
        "created_at": "2024-10-19T10:00:00.000Z",
        "updated_at": "2024-10-19T10:00:00.000Z"
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 20
  }
}
```

### Create Product

**Endpoint:** `POST /products`  
**Authentication:** Required + Active Subscription  
**Description:** Create a new product in user's store

#### Request Body

```json
{
  "name": "Gaming Laptop",
  "description": "High-performance gaming laptop with RTX 4080",
  "image": "https://example.com/laptop.jpg",
  "price": 1299.99,
  "stock": 15,
  "category": "Electronics",
  "sku": "LAPTOP-001"
}
```

#### Validation Rules

- `name`: Required, 1-255 characters
- `description`: Optional, max 1000 characters
- `image`: Optional, valid URL format
- `price`: Required, positive decimal
- `stock`: Optional, non-negative integer
- `category`: Optional, max 100 characters
- `sku`: Required, unique across all products

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 123,
      "name": "Gaming Laptop",
      "description": "High-performance gaming laptop with RTX 4080",
      "image": "https://example.com/laptop.jpg",
      "price": "1299.99",
      "stock": 15,
      "status": "Active",
      "category": "Electronics",
      "sku": "LAPTOP-001",
      "store_id": 5,
      "created_at": "2024-10-19T10:30:00.000Z",
      "updated_at": "2024-10-19T10:30:00.000Z"
    }
  },
  "message": "Product created successfully"
}
```

### Update Product

**Endpoint:** `PATCH /products/:id`  
**Authentication:** Required + Active Subscription  
**Description:** Update existing product (only owner can update)

#### Request Body (Partial Update)

```json
{
  "name": "Updated Gaming Laptop",
  "price": 1199.99,
  "stock": 20
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 123,
      "name": "Updated Gaming Laptop",
      "price": "1199.99",
      "stock": 20,
      "updated_at": "2024-10-19T11:00:00.000Z"
    }
  },
  "message": "Product updated successfully"
}
```

### Delete Product

**Endpoint:** `DELETE /products/:id`  
**Authentication:** Required + Active Subscription  
**Description:** Delete product (only owner can delete)

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

## 🏪 Store Management APIs

### Get Public Store Info

**Endpoint:** `GET /store/:storeName`  
**Authentication:** None required  
**Description:** Get public store information by store name

#### Example Request

```
GET /store/awesome-electronics
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "store_name": "awesome-electronics",
    "template_name": "classic",
    "store_type": "ecommerce"
  }
}
```

### Get Public Store Products

**Endpoint:** `GET /store/:storeName/products`  
**Authentication:** None required (but store must have active subscription)  
**Description:** Get public product listing for a store

#### Query Parameters

Same as private product listing: `page`, `pageSize`, `search`, `sortBy`, `sortOrder`

#### Example Request

```
GET /store/awesome-electronics/products?page=1&pageSize=12&search=laptop
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "name": "Gaming Laptop",
        "image": "https://example.com/laptop.jpg",
        "price": "1299.99",
        "stock": 15,
        "status": "Active",
        "category": "Electronics",
        "sku": "LAPTOP-001"
      }
    ],
    "total": 25,
    "page": 1,
    "pageSize": 12,
    "templateName": "classic"
  }
}
```

### Update Store Template

**Endpoint:** `PATCH /store/:storeName/template`  
**Authentication:** Required + Active Subscription  
**Description:** Update store's frontend template (only store owner)

#### Request Body

```json
{
  "templateName": "modern"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "store": {
      "id": 5,
      "store_name": "awesome-electronics",
      "template_name": "modern",
      "store_type": "ecommerce",
      "updated_at": "2024-10-19T11:30:00.000Z"
    }
  },
  "message": "Store template updated successfully"
}
```

## 💳 Subscription APIs

### Get Subscription Status

**Endpoint:** `GET /subscription/status`  
**Authentication:** Required  
**Description:** Get current user's subscription status, store information, and plan limits.

#### Response (200 OK) — store owner with subscription

```json
{
  "success": true,
  "data": {
    "user": {
      "name": "John Doe",
      "email": "user@example.com",
      "phoneNumber": "+1234567890",
      "onboarded": true,
      "role": 2,
      "template_name": "classic",
      "storeName": "my-store",
      "storeUrl": "https://example.com/my-store",
      "isActive": true,
      "planSlug": "pro",
      "planName": "Pro",
      "includesAi": true,
      "maxProducts": 700,
      "productCount": 52,
      "productsRemaining": 648,
      "aiTokenLimitMonthly": 10000,
      "aiTokensUsed": 1200,
      "aiTokensRemaining": 8800,
      "subscriptionStatus": "active"
    }
  }
}
```

#### Response (200 OK) — legacy shape (subset)

```json
{
  "success": true,
  "data": {
    "user": {
      "name": "John Doe",
      "email": "user@example.com",
      "phoneNumber": "+1234567890",
      "onboarded": true,
      "role": 2,
      "template_name": "classic",
      "isActive": true
    }
  }
}
```

#### Response for User Without Store

```json
{
  "success": true,
  "data": {
    "user": {
      "name": "John Doe",
      "email": "user@example.com",
      "phoneNumber": "+1234567890",
      "onboarded": false,
      "role": 1
    }
  }
}
```

## Analytics AI

Base path: `/ai` (not under `/api`). Requires JWT and a plan with `includes_ai` (Pro or Business). See [ENTITLEMENTS.md](./ENTITLEMENTS.md).

### Health check

**Endpoint:** `GET /ai/health`  
**Authentication:** None  

Returns provider availability, tool list, and intent index status.

### Query (streaming)

**Endpoint:** `POST /ai/query`  
**Authentication:** Required (store owner JWT)  
**Content-Type:** `application/json`  
**Response:** `text/plain` stream (chunks of answer text)

#### Request body

```json
{
  "question": "How many products do I have?",
  "history": [
    { "role": "user", "content": "Show category breakdown" },
    { "role": "assistant", "content": "Here is your breakdown..." }
  ]
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `question` | yes | Max 500 characters |
| `history` | no | Up to 8 prior turns (`user` / `assistant`) |

#### Errors

| Situation | Typical message |
|-----------|-----------------|
| Trial / Basic plan | AI not included on plan |
| Monthly token cap | Token limit exceeded |
| Rate limit | 429 from `aiRateLimit` middleware |

Full behaviour: [AI_COPILOT.md](./AI_COPILOT.md).

## 👥 User Management APIs

### Get All Users (Admin Only)

**Endpoint:** `GET /users`  
**Authentication:** Required + Admin Role  
**Description:** Get paginated list of all users

#### Query Parameters

| Parameter | Type    | Default | Description             |
| --------- | ------- | ------- | ----------------------- |
| page      | integer | 1       | Page number             |
| pageSize  | integer | 10      | Items per page          |
| search    | string  | ""      | Search by name or email |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 123,
        "name": "John Doe",
        "email": "user@example.com",
        "phoneNumber": "+1234567890",
        "onboarded": true,
        "role": "store_owner",
        "created_at": "2024-10-19T09:00:00.000Z"
      }
    ],
    "total": 150,
    "page": 1,
    "pageSize": 10
  }
}
```

## 🚦 API Flow Examples

### Complete Store Setup Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as API
    participant D as Database

    U->>A: POST /auth/register
    A->>D: Create user + store + trial subscription
    D-->>A: User created
    A-->>U: Registration successful

    U->>A: POST /auth/login
    A->>D: Validate credentials
    A-->>U: JWT token

    U->>A: POST /products (with JWT)
    A->>A: Check subscription (trial valid)
    A->>D: Create product
    A-->>U: Product created

    U->>A: GET /subscription/status
    A->>D: Get subscription info
    A-->>U: Trial status + template_name
```

### Customer Browse Store Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant A as API
    participant D as Database

    C->>A: GET /store/awesome-electronics
    A->>D: Check store exists + subscription valid
    A-->>C: Store info + template

    C->>A: GET /store/awesome-electronics/products
    A->>D: Get active products + template
    A-->>C: Product list + template_name

    Note over C: Customer browses with correct theme
```

## 🔒 Middleware Chain

### Protected Endpoint Middleware Stack

```
Request → CORS → Helmet → Auth → Subscription → Validation → Controller
```

#### Middleware Functions

1. **Authentication Middleware** - Verify JWT token
2. **Subscription Middleware** - Check active subscription/trial
3. **Validation Middleware** - Validate request data with Zod
4. **Error Handler** - Centralized error response formatting

## 📊 Rate Limiting

### Default Limits

| Endpoint Category   | Requests | Time Window |
| ------------------- | -------- | ----------- |
| Authentication      | 5        | 15 minutes  |
| Product Creation    | 100      | 1 hour      |
| Product Updates     | 200      | 1 hour      |
| Public Store Access | 1000     | 1 hour      |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1634567890
```

## 📋 Postman Collection

### Environment Variables

```json
{
  "base_url": "http://localhost:4000/api",
  "jwt_token": "{{auth_token}}",
  "store_name": "awesome-electronics"
}
```

### Collection Structure

```
UddoktaHut API/
├── Authentication/
│   ├── Register User
│   ├── Login User
│   └── Get Current User
├── Products/
│   ├── Get Products
│   ├── Create Product
│   ├── Update Product
│   └── Delete Product
├── Store/
│   ├── Get Store Info
│   ├── Get Store Products
│   └── Update Template
└── Subscription/
    └── Get Status
└── AI/
    ├── Health
    └── Query (stream)
```

## 🧪 Testing Examples

### cURL Examples

#### Register User

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword"
  }'
```

#### Create Product

```bash
curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Gaming Laptop",
    "price": 1299.99,
    "stock": 15,
    "category": "Electronics",
    "sku": "LAPTOP-001"
  }'
```

#### Get Store Products

```bash
curl -X GET "http://localhost:4000/api/store/awesome-electronics/products?page=1&pageSize=10" \
  -H "Content-Type: application/json"
```

---

This API documentation provides comprehensive coverage of all endpoints with request/response examples and usage patterns for building client applications.
