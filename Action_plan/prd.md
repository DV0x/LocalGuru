# Product Requirements Document (PRD)

## 1. Overview

**Product Name:**  
Localguru – The Smart Travel Recommendation Engine

**Objective:**  
To create a web-based answer engine that helps travelers identify underrated and secret places to visit. The engine processes user queries (via text or voice), semantically searches curated Reddit data, and leverages an LLM through a RAG approach to deliver precise, context-aware recommendations in an intuitive card layout.

**Target Audience:**  
- Global travelers looking for unique travel tips.
- Users with specific queries (e.g., layovers, airport hacks, local travel tips) who need quick, actionable insights.
- Travelers preferring both text and voice input.

## 2. Problem Statement

Travelers often struggle to find lesser-known local insights from the overwhelming amount of travel content available online. Generic travel sites may not provide the precision or personalization needed. There is a demand for a solution that:
- Quickly interprets both text and voice queries.
- Searches and extracts high-quality, relevant content from platforms like Reddit.
- Leverages semantic search to filter through massive data and return accurate recommendations.
- Presents results in a visually engaging, concise format.

## 3. Product Features & Functional Requirements

### 3.1 User Input and Interaction
- **Text Input:**  
  A simple, responsive search bar where users can type queries.
- **Voice Input:**  
  Integration with the Web Speech API to capture voice queries and convert them to text.
- **Feedback Mechanisms:**  
  Loading indicators and error messages for improved user experience.

### 3.2 Data Retrieval and Semantic Search
- **Reddit Integration:**  
  - Retrieve posts and comments from curated subreddits (travel tips, airport hacks, local guides).
  - Filter and preprocess data for relevance.
- **Semantic Search:**  
  - Convert both user queries and Reddit content into vector embeddings.
  - Use a vector database (e.g., Supabase with pgvector) to perform fast, similarity-based searches.
  - Continuously update the vector index with new data using background jobs.

### 3.3 Retrieval-Augmented Generation (RAG)
- **Prompt Enrichment:**  
  - Combine user query with top semantically matched Reddit posts to form an enriched prompt.
- **LLM Integration:**  
  - Call an external LLM (e.g., OpenAI GPT) to process the enriched prompt.
  - Generate precise, context-aware answers.
- **Result Formatting:**  
  - Format the LLM output into structured "card" layouts that include key details, recommendations, and actionable insights.

### 3.4 Frontend Display
- **Responsive UI:**  
  - Render the generated answers in a card format that is mobile-friendly and visually appealing.
  - Ensure dynamic content loading and interactive elements (e.g., clickable cards for more detail).

## 4. Non-Functional Requirements

### 4.1 Performance and Latency
- **Target Latency:**  
  - Overall end-to-end response should be in the 2–4 second range.
  - Semantic search query: ~50–200 milliseconds using pre-indexed vector data.
- **Scalability:**  
  - Use serverless API endpoints (Next.js API routes) to auto-scale based on demand.
  - Implement caching mechanisms to reduce redundant external API calls.

### 4.2 Reliability and Availability
- **Data Caching:**  
  - Use Supabase to cache curated Reddit data and LLM responses.
- **Robust Error Handling:**  
  - Gracefully handle API failures (Reddit, LLM, or embedding services) and provide fallback messages.

### 4.3 Security
- **Authentication & API Security:**  
  - Secure API endpoints using proper authentication (if user data is stored).
  - Protect API keys and environment variables through secure storage practices.
- **Data Privacy:**  
  - Ensure no sensitive user data is logged or exposed.

## 5. User Flow

1. **User Query Submission:**  
   - User enters a query via text or uses the voice command.
2. **Processing and Semantic Search:**  
   - The query is sent to a backend API endpoint.
   - The system converts the query into an embedding.
   - A semantic search is performed on pre-indexed Reddit data (stored in Supabase) to retrieve the most relevant posts.
3. **Retrieval-Augmented Generation:**  
   - The system constructs an enriched prompt using the user query and the retrieved Reddit snippets.
   - This prompt is sent to an LLM which returns a refined, precise answer.
4. **Result Display:**  
   - The LLM's output is formatted into a card layout.
   - The result is rendered on the user interface for the traveler to review.


