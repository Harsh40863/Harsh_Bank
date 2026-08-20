"""
Harsh Bank AI Service — FastAPI Entry Point
============================================
POST /chat    → Send a message to the multi-agent banking assistant
GET  /health  → Health check
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langsmith import traceable
from graph import banking_graph
from tools import current_user_token, current_account_id
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
import uuid
import os

load_dotenv()

# Ensure LangSmith tracing is enabled
os.environ.setdefault("LANGSMITH_TRACING", "true")

app = FastAPI(title="Harsh Bank AI Service")

# CORS — allow frontend on Express port 3000
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# REQUEST / RESPONSE MODELS
# ============================================================

class ChatRequest(BaseModel):
    message: str
    account_id: str
    thread_id: str | None = None
    token: str  # User's JWT for Express API calls


class ChatResponse(BaseModel):
    reply: str
    thread_id: str


# ============================================================
# CHAT ENDPOINT
# ============================================================

@app.post("/chat", response_model=ChatResponse)
@traceable(run_type="chain")
async def chat(request: ChatRequest):
    """
    Main chat endpoint.
    Sends the user message through the multi-agent orchestration graph:
      User → Teller → (optional) Underwriter → Teller → Response
    """

    # Generate or reuse thread_id for MemorySaver checkpointer
    thread_id = request.thread_id or str(uuid.uuid4())

    # Set per-request context variables so tools can read them
    current_user_token.set(request.token)
    current_account_id.set(request.account_id)

    # LangGraph config with thread_id for state persistence
    config = {"configurable": {"thread_id": thread_id}}

    # Build input state for the orchestration graph
    input_state = {
        "messages": [HumanMessage(content=request.message)],
        "account_id": request.account_id,
        "user_token": request.token,
        "underwriter_ran": False,
    }

    # Invoke the multi-agent graph
    try:
        result = banking_graph.invoke(input_state, config=config)
    except Exception as e:
        err_msg = str(e)
        if "rate_limited" in err_msg or "429" in err_msg or "Rate limit" in err_msg:
            return ChatResponse(
                reply="⚠️ Mistral AI API Rate Limit exceeded. Please wait a moment before sending another message.",
                thread_id=thread_id
            )
        elif "invalid_request_message_order" in err_msg or "400" in err_msg:
            return ChatResponse(
                reply="⚠️ Message sequence validation error. Chat state cleared. Please start a new thread.",
                thread_id=thread_id
            )
        else:
            return ChatResponse(
                reply=f"⚠️ Chatbot Error: {err_msg}",
                thread_id=thread_id
            )

    # Extract the last AI text message (skip tool-call-only messages)
    ai_reply = ""
    for msg in reversed(result["messages"]):
        if (
            isinstance(msg, AIMessage)
            and msg.content
            and not getattr(msg, "tool_calls", None)
        ):
            ai_reply = msg.content
            break

    if not ai_reply:
        ai_reply = "I'm sorry, I couldn't process your request. Please try again."

    return ChatResponse(reply=ai_reply, thread_id=thread_id)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health():
    return {"status": "ok", "service": "Harsh Bank AI Orchestrator"}
