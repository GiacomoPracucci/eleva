Eléva 
========

*Intelligent study companion that elevates learning through mindful AI assistance - designed to empower students, not replace their efforts*

Our Philosophy
--------------

**Eléva doesn't do your homework. Eléva elevates your learning.**

In an era where AI can solve any problem instantly, we believe the real challenge isn't getting answers---it's developing the critical thinking, problem-solving skills, and deep understanding that come from genuine intellectual effort. Eléva is designed to be your study companion, not your replacement.

Core Principles
---------------

### 🧠 **Mindful AI Assistance**

-   AI intervenes only when you're genuinely stuck, not when you're still thinking
-   Focus on clarifying concepts, not providing direct solutions
-   Encourage independent reasoning before offering guidance

### 🎯 **Student-Centered Learning**

-   You remain the protagonist of your learning journey
-   AI adapts to your personal learning style and pace
-   Every interaction is designed to strengthen your capabilities

### 📚 **Knowledge Consolidation**

-   Learning doesn't end when you find the answer
-   Post-solution activities reinforce and expand understanding
-   Curiosity-driven exploration of related topics

### 🔒 **Personal & Contextual**

-   Your materials, your subjects, your learning path
-   AI has deep context about your specific curriculum
-   Privacy-first approach to your academic data

Core Features
-------------

### 📋 **Personal Learning Environment**

-   **Custom Subject Management**: Create and organize your subjects with personalized materials
-   **Document Intelligence**: Upload PDFs, notes, photos, and documents that become part of your AI's knowledge base
-   **Vector-Based Context**: Advanced document retrieval ensures AI responses are grounded in your specific materials
-   **Learning Progress Tracking**: Monitor your growth across subjects and topics

### 🤔 **Intelligent Study Assistance**

-   **Doubt Resolution**: Get help when you're stuck, without getting the full solution
-   **Concept Clarification**: Deep explanations of underlying principles and theories
-   **Guided Problem-Solving**: Step-by-step guidance that maintains your active participation
-   **Contextual Hints**: Subtle nudges in the right direction based on your materials

### ✅ **Solution Validation**

-   **Answer Review**: Check if your solution approach is correct
-   **Error Analysis**: Understand where and why mistakes occurred
-   **Alternative Approaches**: Explore different ways to solve the same problem
-   **Confidence Building**: Validate your reasoning before submission

### 🚀 **Post-Learning Enhancement**

-   **Dynamic Quiz Generation**: Customized quizzes based on what you just studied
-   **Knowledge Gaps Identification**: Discover areas that need more attention
-   **Deep Dive Exploration**: Guided research into related topics and advanced concepts
-   **Literature Analysis**: Explore academic sources and expert perspectives
-   **Cross-Subject Connections**: Discover how topics relate across your curriculum

### 🔄 **Continuous Learning Loop**

-   **Reflection Prompts**: Questions that help you process and internalize knowledge
-   **Study Session Analysis**: Insights into your learning patterns and effectiveness
-   **Personalized Recommendations**: Suggested focus areas based on your progress
-   **Long-term Retention**: Spaced repetition and review scheduling

Technical Architecture
----------------------

### 🏗️ **Core Stack**

-   **Frontend**: Modern web application (React/Next.js)
-   **Backend**: Node.js/Python API
-   **Vector Database**: Qdrant for intelligent document retrieval
-   **AI Integration**: Multiple LLM providers for diverse capabilities
-   **User Data**: Secure, privacy-first storage

### 🔍 **Smart Context System**

-   Personal document vectorization and indexing
-   Real-time context retrieval during study sessions
-   Subject-specific knowledge graphs
-   Learning history and preference tracking

### 🛡️ **Privacy & Security**

-   End-to-end encryption for personal documents
-   Local-first data processing where possible
-   Transparent data usage policies
-   User control over AI training data

Development Roadmap
-------------------

### Phase 1: Foundation 🏗️

-   [ ] User authentication and profile management
-   [ ] Subject creation and basic document upload
-   [ ] Simple Q&A interface with context awareness
-   [ ] Basic solution validation

### Phase 2: Intelligence 🧠

-   [ ] Advanced vector search and retrieval
-   [ ] Multi-modal document processing (PDFs, images, handwritten notes)
-   [ ] Intelligent doubt resolution system
-   [ ] Learning progress tracking

### Phase 3: Enhancement 🚀

-   [ ] Dynamic quiz generation
-   [ ] Deep exploration and research tools
-   [ ] Cross-subject connection discovery
-   [ ] Literature analysis and citation tools

### Phase 4: Optimization 📈

-   [ ] Personalized learning path recommendations
-   [ ] Advanced analytics and insights
-   [ ] Collaborative features (study groups, peer learning)
-   [ ] Mobile application

Contributing
------------

We welcome contributions that align with our philosophy of empowering learners rather than replacing their efforts. Please read our contributing guidelines and join our mission to revolutionize how students interact with AI in their academic journey.

License
-------

[To be determined - likely open source to encourage educational innovation]

* * * * *

*"The best AI doesn't give you fish or teach you to fish---it helps you become the kind of person who naturally thinks like a fisherman."*

**Eléva** - Where AI meets authentic learning.

Docker Deployment
-----------------

The project now ships with a containerized setup that runs the PostgreSQL + pgvector database, FastAPI backend, and the Vite/React frontend behind an Nginx proxy.

### Prerequisites

- Docker Desktop (or the Docker Engine) 25+
- Docker Compose v2 (ships with modern Docker Desktop builds)

### 1. Configure environment files

1. Copy the backend template and fill in secrets:
   ```bash
   cp backend/.env.docker.example backend/.env.docker
   ```
   - Update `SECRET_KEY` with a strong random value.
   - Keep `DATABASE_URL` as-is unless you change the database credentials in `docker-compose.yml`.
   - Provide real values for optional integrations as needed (e.g. `OPENAI_API_KEY`, SMTP, AWS S3). Leave them blank to disable those features.

2. (Optional) Override frontend build values by creating `frontend/.env.docker` based on the provided example. If you skip this, the defaults baked into the Dockerfile are used.

3. (Optional) Create a root `.env` file to override Compose-level defaults (e.g. `POSTGRES_USER`, `POSTGRES_PASSWORD`, `VITE_API_URL`).

### 2. Build and start the stack

```bash
docker compose build        # builds backend + frontend images
docker compose up -d        # launches db, backend, and frontend
```

What you get:

- Frontend (SPA served by Nginx): <http://localhost:8080>
- Backend API (FastAPI + automatic docs): <http://localhost:8000/docs>
- PostgreSQL + pgvector: `localhost:5432`

The backend waits for the database, applies Alembic migrations automatically, and then starts `uvicorn`.

### 3. Common operational tasks

- Inspect logs: `docker compose logs -f backend` (replace `backend` with any service name)
- Run the super-admin bootstrapper inside the backend container:
  ```bash
  docker compose exec backend python create_super_admin.py
  ```
- Stop services while keeping database data: `docker compose down`
- Reset everything (including the database volume):
  ```bash
  docker compose down -v
  ```

### 4. Customisation hints

- **Change exposed ports:** Edit the `ports` section per service in `docker-compose.yml`.
- **Skip automatic migrations:** Start the backend with `RUN_MIGRATIONS=false docker compose up backend`.
- **Adjust frontend API target:** Set `VITE_API_URL` (either via `frontend/.env.docker` or a root `.env`) if you deploy the API under a different host.

### 5. Security reminders

- Do **not** commit filled `.env` files. The templates live in git; your real secrets should not.
- Rotate any credentials that were previously stored in plain text (e.g. existing OpenAI or AWS keys) before deploying this stack.
- For production usage, place the services behind HTTPS (e.g. Traefik, Nginx, Caddy) and configure proper backups for the `eleva-db-data` volume.
