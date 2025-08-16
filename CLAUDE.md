# Beforest Knowledge Management System

## 🎯 **Project Overview**
A professional RAG (Retrieval-Augmented Generation) system built with Azure OpenAI, featuring a dual-interface design for document management and AI-powered conversations.

## 🏗️ **Architecture**
- **Frontend**: Next.js 15 with TypeScript and shadcn/ui
- **Backend**: Azure OpenAI GPT-5 and text-embedding-3-large
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS with Beforest brand colors
- **AI SDK**: v4 with Azure OpenAI integration

## 🎨 **Brand Colors (Beforest)**
```css
Primary: #342e29 (Dark Earth), #86312b (Rich Red), #344736 (Forest Green), #002140 (Deep Blue)
Secondary: #ffc083 (Warm Yellow), #ff774a (Coral Orange), #b8dc99 (Soft Green), #b0ddf1 (Light Blue)
Neutral: #51514d (Charcoal), #e7e4df (Soft Gray), #fdfbf7 (Off White)
```

## 📱 **Main Interfaces**

### 1. Knowledge Garden
- Multi-format document upload (PDF, DOC, DOCX, TXT)
- Drag & drop functionality
- Document management and organization
- Processing status tracking
- Bulk upload capabilities

### 2. Chat Interface
- Real-time AI conversations
- Source citations from uploaded documents
- Message history and search
- Streaming responses
- Copy/export functionality

## ⚙️ **Current Configuration**

### Azure OpenAI Setup
- **Chat Model**: gpt-5-chat-2 (deployment: gpt-5-chat-2)
- **Embedding Model**: text-embedding-3-large (deployment: text-embedding-3-large)
- **API Version**: 2024-12-01-preview
- **Tool Choice**: Required (for reliable function calling)

### Environment Variables
```bash
# Chat Model (harsh-mdpv63be-eastus2.cognitiveservices.azure.com)
AZURE_OPENAI_API_VERSION="2024-12-01-preview"
AZURE_OPENAI_DEPLOYMENT="gpt-5-chat-2"
AZURE_OPENAI_ENDPOINT="https://harsh-mdpv63be-eastus2.cognitiveservices.azure.com/"
AZURE_OPENAI_KEY="[key]"

# Embedding Model (openaiharsha.openai.azure.com)
AZURE_EMBEDDING_ENDPOINT="https://openaiharsha.openai.azure.com/"
AZURE_EMBEDDING_DEPLOYMENT="text-embedding-3-large"
AZURE_EMBEDDING_API_VERSION="2024-12-01-preview"
AZURE_EMBEDDING_API_KEY="[key]"

# Database
DATABASE_URL="postgres://[connection_string]"
```

## 🛠️ **Development Commands**

### Setup
```bash
npm install                 # Install dependencies
npm run db:migrate         # Run database migrations
```

### Development
```bash
npm run dev                # Start development server
npm run build              # Build for production
npm run start              # Start production server
```

### Database
```bash
npm run db:generate        # Generate new migrations
npm run db:migrate         # Apply migrations
npm run db:studio          # Open Drizzle Studio
npm run db:push            # Push schema to database
```

### Code Quality
```bash
npm run lint               # Run ESLint
npm run typecheck          # Run TypeScript checks
```

## 📂 **Key Files**

### API Routes
- `/api/chat` - Main chat endpoint with tool execution
- `/api/upload` - File upload handling (planned)
- `/api/documents` - Document management (planned)

### Components
- `app/(preview)/page.tsx` - Main chat interface
- `lib/ai/embedding.ts` - Azure OpenAI embedding functions
- `lib/db/schema/` - Database schemas
- `lib/env.mjs` - Environment configuration

### Configuration
- `drizzle.config.ts` - Database configuration
- `next.config.mjs` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS setup

## 🔧 **Current Status**

### ✅ Working Components
- Azure OpenAI Chat (gpt-5-chat-2)
- Azure OpenAI Embeddings (text-embedding-3-large)
- Function calling with tools
- Database connectivity
- Real-time streaming responses
- Knowledge base search functionality

### 🚧 In Development
- Knowledge Garden upload interface
- Document processing pipeline
- Source citation system
- Enhanced UI with Beforest branding
- Multi-format file support

## 📋 **Planned Features**

### Phase 1: UI Foundation
- [ ] Install shadcn/ui components
- [ ] Apply Beforest brand theme
- [ ] Create main navigation layout
- [ ] Implement responsive design

### Phase 2: Knowledge Garden
- [ ] File upload component
- [ ] Document list/grid views
- [ ] Processing status indicators
- [ ] Document metadata management

### Phase 3: Enhanced Chat
- [ ] Source citation display
- [ ] Message history
- [ ] Export functionality
- [ ] Advanced search

### Phase 4: Advanced Features
- [ ] Document preview
- [ ] User management
- [ ] Analytics dashboard
- [ ] Performance optimization

## 🚨 **Important Notes**

### Azure OpenAI Configuration
- **Tool Choice**: Must be set to 'required' or 'auto' for function calling
- **Max Steps**: Set to 5 for multi-step tool execution
- **API Versions**: Use 2024-12-01-preview for both chat and embeddings

### Database Schema
```sql
-- Embeddings table (existing)
embeddings: id, content, embedding, similarity

-- Documents table (planned)
documents: id, name, file_type, file_size, upload_date, processing_status
```

### Performance Considerations
- Embedding generation: ~1-2 seconds per query
- Chat responses: ~2-3 seconds average
- File processing: Varies by document size

## 🔍 **Troubleshooting**

### Common Issues
1. **Tool execution not working**: Ensure `toolChoice: 'required'` or `toolChoice: 'auto'`
2. **Embedding errors**: Verify Azure endpoint and API key configuration
3. **Database connection**: Check PostgreSQL connection string
4. **Environment variables**: Ensure all required vars are set

### Debug Commands
```bash
# Check environment variables
npm run dev | grep "Azure config"

# View database schema
npm run db:studio

# Check API endpoints
curl http://localhost:3000/api/chat
```

## 📞 **Support**
For issues or questions, refer to:
- `RAG_INTERFACE_PLAN.md` - Detailed implementation plan
- Azure OpenAI documentation
- shadcn/ui component library
- Drizzle ORM documentation

---
**Last Updated**: 2025-08-14
**Version**: 1.0.0
**Status**: Active Development