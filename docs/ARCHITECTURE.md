# System Architecture

This document describes UddoktaHut Backend architecture. Related: [ENTITLEMENTS.md](./ENTITLEMENTS.md) (plan caps), [AI_COPILOT.md](./AI_COPILOT.md) (analytics chat).

## 📐 High-Level Architecture

UddoktaHut Backend follows a **Multi-Tenant SaaS Architecture** with subscription-based access control and role-based permissions.

### Architecture Diagram

```mermaid
graph TB
    Client[Client Applications] --> LB[Load Balancer/Reverse Proxy]
    LB --> API[Express.js API Server]

    API --> Auth[Authentication Middleware]
    API --> Sub[Subscription Middleware]
    API --> Ent[Entitlement Middleware]
    API --> Valid[Validation Middleware]

    Auth --> JWT[JWT Token Service]
    Sub --> SubService[Subscription Service]
    Ent --> EntSvc[Entitlements + AI Usage]

    API --> Controllers[Controllers Layer]
    Controllers --> Services[Business Logic Services]
    Services --> Models[Sequelize Models]
    Models --> DB[(PostgreSQL + pgvector)]

    API --> Public[Public Store APIs]
    API --> Protected[Protected Owner APIs]
    API --> AiCopilot["Analytics Copilot"]

    subgraph "External Services"
        Email[Email Service]
        OpenAI[OpenAI API]
        Langfuse[Langfuse optional]
    end

    Services --> Email
    AiCopilot --> OpenAI
    AiCopilot --> Langfuse
```

## 🏢 Multi-Tenant Architecture

### Tenant Isolation Strategy

The system implements **Row-Level Security (RLS)** for multi-tenancy:

```mermaid
graph LR
    User1[User 1] --> Store1[Store 1]
    User2[User 2] --> Store2[Store 2]
    User3[User 3] --> Store3[Store 3]

    Store1 --> Products1[Products 1]
    Store2 --> Products2[Products 2]
    Store3 --> Products3[Products 3]

    Products1 --> DB[(Shared Database)]
    Products2 --> DB
    Products3 --> DB

    subgraph "Data Isolation"
        DB --> RLS[Row-Level Security]
        RLS --> Filter1[WHERE store_id = 1]
        RLS --> Filter2[WHERE store_id = 2]
        RLS --> Filter3[WHERE store_id = 3]
    end
```

### Tenant Data Flow

1. **User Authentication** → JWT contains user_id
2. **Store Resolution** → Query store by user_id
3. **Data Filtering** → All queries filtered by store_id
4. **Response** → Only tenant's data returned

## 🔧 Component Architecture

### Layered Architecture Pattern

```
┌─────────────────────────────────┐
│         Presentation Layer       │
│    (Routes, Controllers, MW)     │
├─────────────────────────────────┤
│        Business Logic Layer      │
│         (Services)              │
├─────────────────────────────────┤
│        Data Access Layer        │
│    (Models, Repositories)       │
├─────────────────────────────────┤
│        Database Layer           │
│     (PostgreSQL, Sequelize)     │
└─────────────────────────────────┘
```

### Component Responsibilities

#### 1. **Presentation Layer**

- **Routes** - HTTP endpoint definitions
- **Controllers** - Request/response handling
- **Middleware** - Authentication, validation, subscription checks

#### 2. **Business Logic Layer**

- **Services** - Core business logic
- **Validators** - Input validation with Zod
- **Utilities** - Helper functions and constants

#### 3. **Data Access Layer**

- **Models** - Sequelize ORM models
- **Migrations** - Database schema versioning
- **Seeders** - Initial data population

## 🔐 Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth Controller
    participant M as Auth Middleware
    participant J as JWT Service
    participant D as Database

    C->>A: POST /auth/login
    A->>D: Validate credentials
    D-->>A: User data
    A->>J: Generate JWT token
    J-->>A: Signed token
    A-->>C: Token + user info

    Note over C: Store token for subsequent requests

    C->>M: GET /products (with token)
    M->>J: Verify token
    J-->>M: Decoded payload
    M->>D: Get user data
    D-->>M: User info
    M-->>C: Authorized request proceeds
```

### Authorization Layers

1. **JWT Authentication** - Verify token validity
2. **Role-Based Access** - Check user roles
3. **Subscription Validation** - Verify active subscription (trial not expired)
4. **Plan Entitlements** - Product cap on create; AI access and monthly token budget on `POST /ai/query` ([ENTITLEMENTS.md](./ENTITLEMENTS.md))
5. **Resource Ownership** - Ensure data belongs to user's store

## 💳 Subscription Architecture

### Subscription State Management

```mermaid
stateDiagram-v2
    [*] --> NoSubscription
    NoSubscription --> Trialing: User creates store
    Trialing --> Active: User subscribes
    Trialing --> Expired: Trial period ends
    Active --> Expired: Subscription ends
    Expired --> Active: User renews
    Active --> Active: Auto-renewal
```

### Subscription Middleware Flow

```mermaid
graph TD
    Request[Incoming Request] --> Auth{Authenticated?}
    Auth -->|No| Reject[401 Unauthorized]
    Auth -->|Yes| Store{Store Exists?}
    Store -->|No| NoStore[403 No Store]
    Store -->|Yes| Sub{Subscription Exists?}
    Sub -->|No| NoSub[403 No Subscription]
    Sub -->|Yes| Valid{Subscription Valid?}
    Valid -->|No| Expired[403 Subscription Expired]
    Valid -->|Yes| Allow[Continue to Controller]
```

### Plan entitlements (on top of subscription)

Subscription middleware answers: is the trial/subscription still valid? Entitlement middleware answers: what does this plan allow?

| Check | When | Service |
|-------|------|---------|
| `max_products` | `POST /product` create | `productLimitService` |
| `includes_ai` | `POST /ai/query` | `entitlements.js` |
| `ai_token_limit_monthly` | before AI query runs | `aiUsageService` |

Token usage is recorded after a successful stream into `ai_usage_monthly` (per store, `YYYY-MM` period). See [ENTITLEMENTS.md](./ENTITLEMENTS.md).

## 🤖 Analytics AI

Store owners on Pro/Business get a streaming analytics copilot at `POST /ai/query`. Code under `app/services/ai/`.

```mermaid
sequenceDiagram
    participant C as Client
    participant API as aiController
    participant E as Entitlements
    participant R as resolveIntent
    participant T as Tool handlers
    participant LLM as OpenAI

    C->>API: question + history (JWT)
    API->>E: includes_ai + token budget
    E-->>API: ok or 403
    API->>R: embed question + recent history
    R->>R: pgvector match on tool_routing
    API->>LLM: tool calling loop max 3 rounds
    LLM->>T: get_store_summary etc
    T-->>LLM: tenant-scoped SQL results
    LLM-->>API: answer text
    API-->>C: text/plain stream
    API->>E: record tokens_used
```

- Nine fixed tools — no raw Text-to-SQL; `storeName` injected server-side.
- Intent routing via `tool_routing` table — seed with `npm run seed-intent-utterances`.
- Up to 8 history turns; recent turns also feed intent matching.
- Eval harness: `npm run ai:eval` (same `runCopilot.js` as HTTP).

Details: [AI_COPILOT.md](./AI_COPILOT.md).

## 📊 Data Flow Architecture

### Product Management Flow

```mermaid
graph TD
    Client[Client Request] --> Router[Express Router]
    Router --> AuthMW[Auth Middleware]
    AuthMW --> SubMW[Subscription Middleware]
    SubMW --> ValMW[Validation Middleware]
    ValMW --> Controller[Product Controller]

    Controller --> Service[Product Service]
    Service --> Model[Product Model]
    Model --> DB[(Database)]

    DB --> Model
    Model --> Service
    Service --> Controller
    Controller --> Response[JSON Response]
```

### Public Store Access Flow

```mermaid
graph TD
    Customer[Customer Request] --> Router[Store Router]
    Router --> SubCheck[Store Subscription Check]
    SubCheck --> Valid{Store Active?}
    Valid -->|No| Unavailable[Store Unavailable]
    Valid -->|Yes| Controller[Store Controller]

    Controller --> Service[Store Service]
    Service --> Join[JOIN Store + Products]
    Join --> DB[(Database)]

    DB --> Products[Product List + Template]
    Products --> Response[Public Response]
```

## 🗄️ Database Architecture

### Entity Relationship Design

```mermaid
erDiagram
    User {
        int id PK
        string email UK
        string name
        string phone_number
        string password_hash
        timestamp created_at
        timestamp updated_at
    }

    Role {
        int id PK
        string role_name UK
        timestamp created_at
    }

    UserRole {
        int user_id FK
        int role_id FK
        boolean onboarded
        timestamp created_at
    }

    Store {
        int id PK
        int user_id FK
        string store_name UK
        string store_type
        string template_name
        timestamp created_at
        timestamp updated_at
    }

    Product {
        int id PK
        int store_id FK
        string name
        text description
        string image
        decimal price
        int stock
        string status
        string category
        string sku UK
        timestamp created_at
        timestamp updated_at
    }

    Subscription {
        int id PK
        int store_id FK
        int plan_id FK
        string status
        timestamp trial_ends_at
        timestamp end_date
        timestamp created_at
        timestamp updated_at
    }

    Plan {
        int id PK
        string name
        decimal price
        int duration_months
        text features
        timestamp created_at
    }

    User ||--o{ UserRole : has
    Role ||--o{ UserRole : assigned
    User ||--|| Store : owns
    Store ||--o{ Product : contains
    Store ||--|| Subscription : has
    Plan ||--o{ Subscription : defines
```

## 🚀 Performance Architecture

### Optimization Strategies

#### 1. **Database Optimization**

- **Indexes** on frequently queried columns
- **JOIN optimization** for related data
- **Query batching** for bulk operations
- **Connection pooling** for concurrent requests

#### 2. **Caching Strategy**

```mermaid
graph LR
    Request --> Cache{Cache Hit?}
    Cache -->|Yes| Return[Return Cached Data]
    Cache -->|No| DB[Query Database]
    DB --> Store[Store in Cache]
    Store --> Return
```

#### 3. **Pagination Implementation**

- **Limit/Offset** for simple pagination
- **Cursor-based** for large datasets
- **Search optimization** with full-text indexes

## 🔄 API Architecture

### RESTful Design Principles

#### Resource-Based URLs

- `/api/products` - Product collection
- `/api/products/:id` - Specific product
- `/api/store/:storeName` - Store resource
- `/api/subscription/status` - Subscription state

#### HTTP Method Usage

- `GET` - Read operations (no subscription check)
- `POST` - Create operations (subscription required)
- `PATCH` - Update operations (subscription required)
- `DELETE` - Delete operations (subscription required)

### API Middleware Stack

```
Request → CORS → Helmet → Auth → Subscription → Validation → Controller
```

## 📦 Deployment Architecture

### Environment Structure

```mermaid
graph TB
    Dev[Development Environment]
    Staging[Staging Environment]
    Prod[Production Environment]

    Dev --> Git[Git Repository]
    Git --> CI[CI/CD Pipeline]
    CI --> Test[Automated Tests]
    Test --> Staging
    Staging --> Manual[Manual Testing]
    Manual --> Prod

    subgraph "Production Infrastructure"
        LB[Load Balancer]
        App1[App Server 1]
        App2[App Server 2]
        DB[Database Cluster]
        Cache[Redis Cache]
    end

    Prod --> LB
    LB --> App1
    LB --> App2
    App1 --> DB
    App2 --> DB
    App1 --> Cache
    App2 --> Cache
```

## 🛡️ Error Handling Architecture

### Centralized Error Management

```mermaid
graph TD
    Error[Application Error] --> Handler[Error Handler Middleware]
    Handler --> Type{Error Type?}

    Type -->|Validation| Zod[Zod Validation Error]
    Type -->|Database| Sequelize[Sequelize Error]
    Type -->|Business| Custom[Custom Business Error]
    Type -->|Unknown| Generic[Generic Server Error]

    Zod --> Format[Format Response]
    Sequelize --> Format
    Custom --> Format
    Generic --> Format

    Format --> Log[Log Error]
    Log --> Response[JSON Error Response]
```

## 📈 Scalability Considerations

### Horizontal Scaling

- **Stateless API design** - No server-side sessions
- **Database connection pooling** - Shared connections
- **Load balancing** - Distribute requests across instances

### Vertical Scaling

- **Database optimization** - Efficient queries and indexes
- **Memory management** - Proper garbage collection
- **CPU utilization** - Async/await patterns

### Future Enhancements

- **Microservices architecture** - Service decomposition
- **Event-driven architecture** - Async communication
- **CQRS pattern** - Command/Query separation

## 🔍 Monitoring & Observability

### Logging Strategy

- **Structured logging** with JSON format
- **Request/response logging** for debugging
- **Error tracking** with stack traces
- **Performance metrics** for optimization

### Health Checks

- **Database connectivity** checks
- **`GET /ai/health`** — LLM provider, embedding model, `tool_routing` row count
- **External service** availability (OpenAI, optional Langfuse)
- **Memory/CPU usage** monitoring
- **Response time** tracking

---

This architecture provides a solid foundation for a scalable, secure, and maintainable multi-tenant SaaS application.
