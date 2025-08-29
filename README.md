# Insurance Customer Service Agent

An AI-powered insurance customer service chatbot built with OpenAI Agents SDK, featuring RAG (Retrieval-Augmented Generation) for policy information and direct API integration for claims and premium operations.

## Architecture

### Frontend (Next.js)
- Modern React-based chat interface
- Responsive design with Tailwind CSS
- Real-time chat with the AI agent
- Structured UI components for policy details, claims, and knowledge base results

### Backend (NestJS)
- RESTful API endpoints for insurance operations
- JWT authentication and authorization
- Rate limiting and security middleware
- Swagger API documentation

### Orchestrator (Python + OpenAI Agents SDK)
- **Replaced LangGraph with OpenAI Agents SDK**
- Multi-agent architecture with specialized agents:
  - **Orchestrator**: Routes user queries to appropriate specialists
  - **PolicyDetails Agent**: Handles policy information requests
  - **ClaimStatus Agent**: Manages claim status queries
  - **SubmitClaim Agent**: Processes new claim submissions
  - **CalculatePremium Agent**: Handles premium calculations
  - **KnowledgeBase Agent**: Provides RAG-based policy information
- **RAG Integration**: Automatically searches vector database for policy questions
- **API Integration**: Calls NestJS backend for operational queries

## Key Features

### 1. **RAG for Policy Information**
- When users ask about available policies, coverage options, or general questions, the system automatically searches the knowledge base
- Uses vector embeddings to find relevant information
- Provides accurate, up-to-date policy information

### 2. **Direct API Integration**
- **User Policy Queries**: Fetches real policy data from the backend
- **Claim Operations**: Checks status and submits new claims
- **Premium Calculations**: Real-time premium estimates for coverage changes

### 3. **Smart Routing**
- Orchestrator automatically determines the best agent for each query type
- Maintains conversation context across turns
- Seamlessly switches between RAG and API modes

## Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- OpenAI API key
- PostgreSQL with vector extension

### 1. Start the Backend API
```bash
cd apps/api
npm install
npm run start:dev
```

### 2. Start the Orchestrator
```bash
cd apps/orchestrator
pip install -r requirements.txt
export OPENAI_API_KEY="your-api-key"
export NEST_API_URL="http://localhost:3000"
python main.py
```

### 3. Start the Frontend
```bash
cd apps/web
npm install
npm run dev
```

### 4. Access the Application
- Frontend: http://localhost:3001
- API: http://localhost:3000
- Orchestrator: http://localhost:8001
- API Docs: http://localhost:3000/docs

## Environment Variables

### Orchestrator
```bash
OPENAI_API_KEY=your-openai-api-key
NEST_API_URL=http://localhost:3000
DB_URL=postgres://user:pass@localhost:5432/insurance
EMBEDDING_MODEL=text-embedding-3-small
ORCH_SERVICE_EMAIL=admin@insurance.com
ORCH_SERVICE_PASSWORD=admin123
```

### API
```bash
JWT_SECRET=your-jwt-secret
PORT=3000
```

## API Endpoints

### Insurance Operations
- `GET /insurance/policy?user_id={id}` - Get policy details
- `GET /insurance/claims?claim_id={id}` - Get claim status
- `POST /insurance/claims` - Submit new claim
- `POST /insurance/premium` - Calculate premium changes
- `GET /insurance/policies` - Get all policies (admin)
- `GET /insurance/claims/all` - Get all claims (admin)

### Chat
- `POST /chat` - Process chat messages through the orchestrator

## Sample Queries

### Policy Information (RAG)
- "What are the different insurance plans available?"
- "What does collision coverage include?"
- "What are the benefits of roadside assistance?"

### User Operations (API)
- "Show me my policy details for USER-001"
- "Check claim status 98765"
- "Submit a claim for policy POL-1001"
- "Calculate premium if I increase coverage from 50k to 80k"

## Development

### Adding New Agents
1. Create a new agent in `openai_agent.py`
2. Add it to the orchestrator's handoffs list
3. Update the routing logic if needed

### Extending RAG
1. Add documents to the vector database
2. Update the `search_knowledge_base_tool` function
3. Modify the knowledge base agent instructions

### API Integration
1. Add new endpoints in the NestJS backend
2. Create corresponding tools in the orchestrator
3. Update the agent instructions to use the new tools

## Testing

### Test the Orchestrator
```bash
cd apps/orchestrator
python test_orchestrator.py
```

### Test the API
```bash
# Test insurance endpoints
curl "http://localhost:3000/insurance/policy?user_id=USER-001"
curl "http://localhost:3000/insurance/claims?claim_id=98765"
```

## Migration from LangGraph

This implementation replaces the previous LangGraph-based orchestrator with OpenAI Agents SDK:

### Key Changes
- **Replaced** `graph.py` with `openai_agent.py`
- **Updated** `main.py` to use the new agent system
- **Enhanced** with RAG capabilities for policy information
- **Improved** error handling and response formatting

### Benefits
- **Better Performance**: OpenAI Agents SDK is optimized for production use
- **RAG Integration**: Automatic knowledge base search for policy questions
- **Cleaner Architecture**: Simplified agent definitions and routing
- **Better Error Handling**: More robust error management and user feedback

## Troubleshooting

### Common Issues
1. **OpenAI API Errors**: Check your API key and quota
2. **Database Connection**: Verify PostgreSQL is running and accessible
3. **Authentication**: Ensure the orchestrator can authenticate with the API
4. **Vector Search**: Check that the vector extension is installed in PostgreSQL

### Debug Mode
Enable debug logging in the orchestrator:
```bash
export LOG_LEVEL=DEBUG
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.