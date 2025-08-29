# Insurance Customer Service Agent

A comprehensive AI-powered insurance customer service platform built with OpenAI Agents SDK, featuring multi-agent orchestration, RAG (Retrieval-Augmented Generation), structured UI responses, and enterprise-grade observability.

## Architecture

### Frontend (Next.js)
- Modern React-based chat interface with Tailwind CSS
- **Structured UI Cards**: Automatic rendering of policy details, claim status, premium calculations, and knowledge base results
- **Smart JSON Parsing**: Detects and renders structured responses as interactive cards
- Real-time chat with contextual conversation flow
- Responsive design optimized for mobile and desktop

### Backend (NestJS)
- RESTful API with comprehensive insurance operations
- **JWT Authentication**: Login, token refresh, and role-based access control
- **Prometheus Metrics**: `/metrics` endpoint for observability and monitoring
- **Structured Logging**: Request tracing with correlation IDs and user context
- **Input Validation**: Comprehensive validation with custom validators
- **Admin Management**: Document ingestion and deletion capabilities
- Swagger/OpenAPI documentation with interactive testing

### Orchestrator (Python + OpenAI Agents SDK)
- **Multi-Agent Architecture** with forced tool usage and structured responses:
  - **Orchestrator**: Intelligent routing with conversation context
  - **PolicyDetails Agent**: User-specific policy data via API integration
  - **ClaimStatus Agent**: Real-time claim tracking with structured JSON responses
  - **SubmitClaim Agent**: Guided claim submission with validation
  - **CalculatePremium Agent**: Dynamic premium calculations with structured UI cards
  - **KnowledgeBase Agent**: **FORCED** knowledge base search (no training data answers)
- **PostgreSQL + pgvector**: Vector embeddings for semantic search
- **Arize Phoenix Tracing**: OpenTelemetry integration for agent observability
- **Structured JSON Responses**: All tools return UI-ready structured data
- **Session Management**: SQLite-based conversation persistence

## Key Features

### 🤖 **Forced Knowledge Base Usage**
- **CRITICAL FIX**: Agents can no longer answer from training data
- Knowledge base agent MUST call `search_knowledge_base_tool` for every query
- Vector search with pgvector for semantic understanding
- Structured knowledge base cards with sources and relevance scoring

### 💳 **Structured UI Responses**
- **ClaimStatusTable**: Real-time claim tracking with status, dates, and policy info
- **PolicySummaryCard**: Complete policy details with coverage breakdowns
- **PremiumCalculationCard**: Interactive premium changes with cost comparisons
- **KnowledgeBaseCard**: Search results with sources and document metadata
- **ConfirmationCard**: User-friendly confirmations for submissions

### 🔐 **Enterprise Security & Auth**
- **JWT Authentication**: Secure login with token refresh capabilities
- **Role-Based Access Control**: Admin and user role separation
- **Input Validation**: Comprehensive validation with custom constraints
- **Request Correlation**: Trace IDs for debugging and monitoring

### 📊 **Observability & Monitoring**
- **Prometheus Metrics**: Request counts, duration, and success rates
- **Arize Phoenix Tracing**: OpenTelemetry integration for agent workflows
- **Structured Logging**: JSON logs with user context and trace correlation
- **Health Endpoints**: System status and dependency checks

### 🎯 **Smart Agent Orchestration**
- **Context-Aware Routing**: Maintains conversation flow across agent handoffs
- **Forced Tool Usage**: Agents cannot skip required API calls or searches
- **Structured JSON**: All responses formatted for immediate UI rendering
- **Session Persistence**: SQLite-based conversation state management

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- OpenAI API key
- PostgreSQL with pgvector extension
- Docker & Docker Compose (recommended)

### Option 1: Docker Compose (Recommended)
```bash
# Copy environment files
cp env.example .env
cp apps/orchestrator/env.example apps/orchestrator/.env

# Edit .env files with your OpenAI API key and credentials

# Start all services
docker-compose up -d

# Ingest knowledge base
cd apps/orchestrator
python update_kb.py
```

### Option 2: Manual Setup

#### 1. Start PostgreSQL with Vector Extension
```bash
# Using Docker
docker run -d \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=insurance \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

#### 2. Start the Backend API
```bash
cd apps/api
npm install
export JWT_SECRET="your-jwt-secret"
export ENABLE_PROMETHEUS=true
npm run start:dev
```

#### 3. Start the Orchestrator
```bash
cd apps/orchestrator
pip install -r requirements.txt
export OPENAI_API_KEY="your-api-key"
export NEST_API_URL="http://localhost:3000"
export PHOENIX_ENABLED=true  # Optional: for tracing
python main.py
```

#### 4. Ingest Knowledge Base
```bash
cd apps/orchestrator
python update_kb.py
```

#### 5. Start the Frontend
```bash
cd apps/web
npm install
npm run dev
```

### Access Points
- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000
- **API Docs**: http://localhost:3000/docs
- **Orchestrator**: http://localhost:8001
- **Prometheus Metrics**: http://localhost:3000/metrics
- **Phoenix Tracing**: http://localhost:6006 (if enabled)

## Environment Variables

### Root `.env`
```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=insurance

# API Secrets
JWT_SECRET=your-jwt-secret-key
ADMIN_SHARED_SECRET=your-admin-secret

# Phoenix Tracing (Optional)
PHOENIX_ENABLED=true
PHOENIX_PROJECT_NAME=insurance-agent
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
PHOENIX_API_KEY=  # Optional for Phoenix Cloud
```

### Orchestrator `apps/orchestrator/.env`
```bash
# Core Services
OPENAI_API_KEY=your-openai-api-key
NEST_API_URL=http://localhost:3000
ADMIN_SHARED_SECRET=your-admin-secret

# Database & Embeddings
DB_URL=postgres://postgres:postgres@localhost:5432/insurance
EMBEDDING_MODEL=text-embedding-3-small

# Service Authentication
ORCH_SERVICE_EMAIL=admin@insurance.com
ORCH_SERVICE_PASSWORD=admin123

# Phoenix Tracing
PHOENIX_ENABLED=true
PHOENIX_PROJECT_NAME=insurance-agent
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

### API Configuration
```bash
# Security
JWT_SECRET=your-jwt-secret-key
ADMIN_SHARED_SECRET=your-admin-secret

# Observability
ENABLE_PROMETHEUS=true
NODE_ENV=development

# Server
PORT=3000
```

## API Endpoints

### Authentication
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh JWT access token

### Insurance Operations
- `GET /insurance/policy?user_id={id}` - Get policy details
- `GET /insurance/claims?claim_id={id}` - Get claim status  
- `POST /insurance/claims` - Submit new claim
- `POST /insurance/premium` - Calculate premium changes
- `GET /insurance/policies` - Get all policies (admin)
- `GET /insurance/claims/all` - Get all claims (admin)

### Chat & Orchestration
- `POST /chat` - Process chat messages through the orchestrator

### Admin Operations
- `POST /admin/ingest` - Ingest documents into knowledge base
- `DELETE /admin/documents/{id}` - Delete documents from knowledge base

### Observability
- `GET /metrics` - Prometheus metrics endpoint
- `GET /health` - Health check endpoint

## Sample Queries & Expected Responses

### 🔍 **Knowledge Base Queries** (Forces Vector Search)
```
User: "What is the deductible for the Gold plan?"
Agent: 🔍 Searches knowledge base → Returns structured card
Result: "Gold Plan has a deductible amount of $500 per incident"
```

```
User: "Does Silver plan include roadside assistance?"
Agent: 🔍 Searches knowledge base → Returns structured card  
Result: "Silver Plan does not include roadside assistance services"
```

### 💳 **Claim Operations** (Structured UI Cards)
```
User: "Check claim status 98765"
Agent: 📊 Returns ClaimStatusTable with status, dates, policy info
```

```
User: "Submit a claim for my damaged vehicle"
Agent: 📝 Guided form collection → Returns ConfirmationCard
```

### 👤 **Policy Management** (API Integration)
```
User: "Show my policy details for USER-001"
Agent: 📋 Returns PolicySummaryCard with coverage breakdown
```

```
User: "Calculate premium if I increase coverage from 50k to 80k"
Agent: 💰 Returns PremiumCalculationCard with cost comparison
```

## Development Guide

### 🤖 **Adding New Agents**
1. **Create Agent Definition** in `apps/orchestrator/openai_agent.py`:
   ```python
   new_agent = Agent(
       name="NewAgent",
       instructions="Clear instructions with forced tool usage",
       tools=[your_tool],
       tool_use_behavior=StopAtTools(stop_at_tool_names=["your_tool"]),
       model=MODEL,
       model_settings=ModelSettings(temperature=0.0)
   )
   ```

2. **Add to Orchestrator Handoffs**:
   ```python
   orchestrator_agent = Agent(
       handoffs=[..., new_agent]
   )
   ```

3. **Update Routing Logic** in orchestrator instructions

### 📚 **Extending Knowledge Base**
1. **Add Documents**:
   ```bash
   # Via API
   curl -X POST http://localhost:3000/admin/ingest \
     -H "X-Admin-Secret: your-secret" \
     -d '{"title": "...", "content": "...", "source": "..."}'
   
   # Or update knowledge_base.json and run:
   cd apps/orchestrator && python update_kb.py
   ```

2. **Ensure Forced Search** - All knowledge queries must use `search_knowledge_base_tool`

### 🔧 **API Integration**
1. **Backend Endpoint** (NestJS):
   ```typescript
   @Get('new-endpoint')
   async newOperation(@Query() dto: NewDto) {
     return this.service.process(dto);
   }
   ```

2. **Orchestrator Tool**:
   ```python
   @function_tool
   def new_tool(param: str) -> Dict[str, Any]:
       # Call NestJS API
       response = httpx.post(f"{NEST_API_URL}/new-endpoint", ...)
       return response.json()
   ```

3. **Agent Integration** with forced tool usage

### 🧪 **Testing**

#### Unit Tests
```bash
# API Tests
cd apps/api && npm test

# Run specific test suites
npm test -- auth.service.spec.ts
npm test -- roles.guard.spec.ts
```

#### Integration Testing
```bash
# Test orchestrator
cd apps/orchestrator && python test_orchestrator.py

# Test knowledge base
python update_kb.py  # Should complete without errors

# Test API endpoints
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/insurance/policy?user_id=USER-001"
```

#### Monitoring & Debugging
```bash
# Check Prometheus metrics
curl http://localhost:3000/metrics

# Phoenix tracing (if enabled)
# Visit http://localhost:6006

# View structured logs
tail -f apps/api/logs/app.log | jq .
```

## 🚀 **Recent Major Updates**

### ✅ **Knowledge Base Fix** (Critical)
- **FORCED tool usage** - Agents can no longer answer from training data
- **Enhanced content structure** - Requires synthesis rather than direct copying
- **Structured UI responses** - Knowledge base results render as interactive cards

### ✅ **Enterprise Observability**
- **Arize Phoenix Tracing** - OpenTelemetry integration for agent workflows
- **Prometheus Metrics** - Request monitoring and performance tracking
- **Structured Logging** - JSON logs with correlation IDs and user context

### ✅ **Enhanced Security**  
- **JWT Token Refresh** - Secure session management
- **Role-Based Access Control** - Admin/user separation
- **Input Validation** - Comprehensive validation with custom constraints

### ✅ **Production Ready Features**
- **Docker Compose** - Complete containerized deployment
- **Admin Management** - Document ingestion and deletion APIs
- **Health Checks** - System monitoring endpoints
- **Unit & Integration Tests** - Comprehensive test coverage

## Troubleshooting

### 🔧 **Common Issues**

#### Knowledge Base Not Working
```bash
# Re-ingest updated knowledge base
cd apps/orchestrator
python update_kb.py

# Check database connection
psql postgres://postgres:postgres@localhost:5432/insurance -c "SELECT COUNT(*) FROM documents;"
```

#### Agent Answering from Training Data
```bash
# Verify agent instructions have StopAtTools
grep -n "StopAtTools" apps/orchestrator/openai_agent.py

# Check knowledge base agent forced search
grep -A 5 "CRITICAL.*MUST.*call" apps/orchestrator/openai_agent.py
```

#### API Authentication Issues
```bash
# Test login endpoint
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@insurance.com","password":"admin123"}'

# Check JWT secret is set
echo $JWT_SECRET
```

#### Phoenix Tracing Not Working
```bash
# Check if Phoenix is enabled
echo $PHOENIX_ENABLED

# Verify Phoenix service
docker-compose ps phoenix

# Check orchestrator logs
docker-compose logs orchestrator | grep -i phoenix
```

### 🔍 **Debug Mode**
```bash
# Enable detailed logging
export LOG_LEVEL=DEBUG
export PHOENIX_ENABLED=true

# View real-time logs
docker-compose logs -f orchestrator
docker-compose logs -f api
```

## Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/your-feature`
3. **Follow the development guide** above for adding agents/endpoints
4. **Add tests** for new functionality
5. **Update this README** if adding major features
6. **Submit pull request** with clear description

## License

This project is licensed under the MIT License. See `LICENSE` file for details.