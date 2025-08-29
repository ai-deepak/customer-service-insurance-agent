# Phoenix Tracing Setup

This document explains how to set up Arize Phoenix tracing for our Insurance Agent system.

## Overview

Phoenix provides powerful observability for our OpenAI Agents SDK implementation, allowing us to:
- Trace multi-agent conversations
- Monitor agent performance and latency
- Debug agent routing decisions
- Analyze user interaction patterns
- Track tool usage and effectiveness

Based on: [Arize Phoenix OpenAI Agents SDK Tracing](https://arize.com/docs/phoenix/integrations/llm-providers/openai/openai-agents-sdk-tracing)

## Quick Start (Local Phoenix)

### 1. Install Dependencies
```bash
cd apps/orchestrator
pip install -r requirements.txt
```

### 2. Start Local Phoenix Instance
```bash
# In a separate terminal
pip install arize-phoenix
phoenix serve
```
This will start Phoenix at `http://localhost:6006`

### 3. Configure Environment
```bash
# In your .env file
PHOENIX_ENABLED=true
PHOENIX_PROJECT_NAME=insurance-agent
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006
```

### 4. Start the Orchestrator
```bash
cd apps/orchestrator
python main.py
```

### 5. Access Phoenix Dashboard
Open `http://localhost:6006` in your browser to view traces.

## Phoenix Cloud Setup

### 1. Sign Up for Phoenix Cloud
- Go to [Phoenix Cloud](https://app.phoenix.arize.com/login)
- Create an account and get your API key

### 2. Configure for Cloud
```bash
# In your .env file
PHOENIX_ENABLED=true
PHOENIX_PROJECT_NAME=insurance-agent
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com
PHOENIX_API_KEY=your-api-key-here
```

## What Gets Traced

With Phoenix enabled, you'll see:

### 🤖 **Agent Interactions**
- Orchestrator routing decisions
- Specialist agent handoffs
- Tool calls and responses
- Session context and memory

### 🔧 **Tool Usage**
- Policy detail lookups
- Claim status queries
- Premium calculations
- Knowledge base searches

### 📊 **Performance Metrics**
- Response latencies
- Token usage
- Error rates
- User session flows

### 🎯 **Business Context**
- User roles and permissions
- Session IDs for conversation tracking
- Agent decision paths
- Confirmation flows

## Viewing Traces

In the Phoenix dashboard, you can:

1. **Trace Timeline**: See the full conversation flow
2. **Agent Handoffs**: Visualize routing between agents
3. **Tool Calls**: Monitor API calls and database queries
4. **Performance**: Analyze latency and bottlenecks
5. **Errors**: Debug failed interactions

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PHOENIX_ENABLED` | Enable/disable tracing | `false` | No |
| `PHOENIX_PROJECT_NAME` | Project name in Phoenix | `insurance-agent` | No |
| `PHOENIX_COLLECTOR_ENDPOINT` | Phoenix endpoint | `http://localhost:6006` | No |
| `PHOENIX_API_KEY` | API key for Phoenix Cloud | - | Only for cloud |

## Docker Setup

Add to your `docker-compose.yml`:

```yaml
services:
  phoenix:
    image: arizephoenix/phoenix:latest
    ports:
      - "6006:6006"
    environment:
      - PHOENIX_WORKING_DIR=/app/data
    volumes:
      - phoenix_data:/app/data

  orchestrator:
    # ... existing config ...
    environment:
      - PHOENIX_ENABLED=true
      - PHOENIX_COLLECTOR_ENDPOINT=http://phoenix:6006
    depends_on:
      - phoenix

volumes:
  phoenix_data:
```

## Troubleshooting

### Common Issues

**1. "Phoenix tracing dependencies not installed"**
```bash
pip install arize-phoenix-otel openinference-instrumentation-openai-agents
```

**2. "Connection refused to Phoenix"**
- Ensure Phoenix is running: `phoenix serve`
- Check the endpoint: `PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006`

**3. "No traces appearing"**
- Verify `PHOENIX_ENABLED=true`
- Check orchestrator logs for Phoenix initialization messages
- Ensure OpenAI API key is set

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=DEBUG
export PHOENIX_ENABLED=true
```

## Benefits

With Phoenix tracing, you get:

✅ **Complete Visibility**: See every step of your agent conversations  
✅ **Performance Insights**: Identify slow tools and optimize  
✅ **Error Debugging**: Quickly diagnose failed interactions  
✅ **User Analytics**: Understand conversation patterns  
✅ **Production Monitoring**: Real-time observability  

## Next Steps

1. Set up Phoenix locally and explore basic tracing
2. Configure Phoenix Cloud for production monitoring
3. Create custom dashboards for business metrics
4. Set up alerts for error rates and latency
5. Integrate with your CI/CD pipeline for performance testing
