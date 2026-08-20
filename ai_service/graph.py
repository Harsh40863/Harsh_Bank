"""
Harsh Bank AI Service — Multi-Agent LangGraph State Machine
============================================================

Architecture:
  create_agent() factory → builds tool-calling agents via llm.bind_tools()
  Teller Agent         → user-facing, handles queries & spending analytics
  Underwriter Agent    → backend-only, evaluates loans & executes disbursement
  Orchestrator Graph   → routes between Teller ↔ Underwriter

Usage:
  agent = create_agent(llm, tools=[...], system_prompt="...")
  result = agent.invoke({"messages": [{"role": "user", "content": "..."}]})
"""

from langgraph.graph import StateGraph, MessagesState, START, END
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.memory import MemorySaver
from langchain_mistralai import ChatMistralAI
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langsmith import traceable
from tools import (
    analyze_spending_tool,
    check_loan_tool,
    execute_loan_transfer_tool,
    request_loan_evaluation,
)
import os
from dotenv import load_dotenv

load_dotenv()


# ============================================================
# AGENT FACTORY — create_agent()
# ============================================================

def create_agent(llm, tools, system_prompt):
    """
    Build a self-contained tool-calling agent with llm.bind_tools().

    Args:
        llm:           The ChatModel instance (e.g. ChatMistralAI)
        tools:         List of LangChain @tool-decorated functions
        system_prompt: System instruction string for the agent

    Returns:
        A compiled LangGraph that supports agent.invoke({"messages": [...]})
    """

    # Bind tools to the LLM so it can generate tool_calls
    llm_with_tools = llm.bind_tools(tools)

    # ---- Model Node ----
    # Prepends the system prompt, then calls the LLM with tools bound
    def agent_node(state):
        system_msg = SystemMessage(content=system_prompt)
        messages = [system_msg] + state["messages"]
        response = llm_with_tools.invoke(messages)
        return {"messages": [response]}

    # ---- Tool Execution Node ----
    tool_node = ToolNode(tools)

    # ---- Conditional Routing ----
    # If the LLM returned tool_calls → execute them
    # If it returned a plain text response → we're done
    def should_continue(state):
        last_message = state["messages"][-1]
        if hasattr(last_message, "tool_calls") and last_message.tool_calls:
            return "tools"
        return END

    # ---- Assemble the ReAct loop ----
    graph = StateGraph(MessagesState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", END: END},
    )
    graph.add_edge("tools", "agent")  # Tool results feed back to agent

    return graph.compile()


# ============================================================
# ORCHESTRATOR STATE
# ============================================================

class OrchestratorState(MessagesState):
    """Extended state for the parent multi-agent orchestration graph."""
    account_id: str
    user_token: str
    underwriter_ran: bool


# ============================================================
# LLM ENGINE
# ============================================================

llm = ChatMistralAI(
    model="mistral-large-latest",
    temperature=0,
)


# ============================================================
# SYSTEM PROMPTS
# ============================================================

TELLER_PROMPT = """You are HarshBot, Harsh Bank's friendly AI Teller Assistant.

CAPABILITIES:
- Answer general banking questions
- Analyze spending using the analyze_spending_tool
- Route loan requests to the Underwriter via request_loan_evaluation

RULES:
1. When the user asks about spending, expenses, or wants a breakdown, call analyze_spending_tool with their account_id.
2. When returning analytics data, you MUST include the raw JSON in your response wrapped exactly like:
   <<<ANALYTICS_JSON>>>the exact JSON from the tool<<<END_ANALYTICS_JSON>>>
   This allows the frontend to render a visual chart. Also give a brief text summary.
3. When the user asks about loans, borrowing, or loan eligibility, call request_loan_evaluation with their account_id.
4. You CANNOT approve or execute loans yourself — only the Underwriter can.
5. If you see results from a loan evaluation (success or denial), summarize them for the user in a friendly, professional manner.
6. Format currency in Indian Rupees (₹).
7. If the user wants to repay their loan, instruct them to transfer the money using the Send Money form on the left, using the bank's Reserve Account ID: 000000000000000000000000.

The user's account ID is: {account_id}"""


UNDERWRITER_PROMPT = """You are Harsh Bank's Loan Underwriter Agent — a strict, autonomous backend evaluator.

STRICT PROTOCOL:
1. FIRST: Call check_loan_tool with the account_id to evaluate 30-day credit volume.
2. IF eligible (eligible: true): IMMEDIATELY call execute_loan_transfer_tool with the account_id and max_amount to disburse the loan. Do NOT ask for confirmation — you have full autonomous authority.
3. IF not eligible (eligible: false): Respond with a clear denial explaining the requirement (30-day credit volume must exceed ₹50,000).
4. Be factual and precise. State the loan amount, account ID, and transaction result.
5. Format currency in Indian Rupees (₹).

The user's account ID is: {account_id}"""


# ============================================================
# BUILD SUB-AGENTS (via create_agent factory)
# ============================================================

def build_teller(account_id: str):
    """Build a Teller agent with tools bound and account context injected."""
    return create_agent(
        llm,
        tools=[analyze_spending_tool, request_loan_evaluation],
        system_prompt=TELLER_PROMPT.format(account_id=account_id),
    )


def build_underwriter(account_id: str):
    """Build an Underwriter agent with tools bound and account context injected."""
    return create_agent(
        llm,
        tools=[check_loan_tool, execute_loan_transfer_tool],
        system_prompt=UNDERWRITER_PROMPT.format(account_id=account_id),
    )


# ============================================================
# ORCHESTRATOR NODE FUNCTIONS
# ============================================================

@traceable(run_type="chain")
def teller_node(state: OrchestratorState):
    """Teller agent node — handles user interaction and spending analytics."""
    teller = build_teller(state.get("account_id", ""))
    result = teller.invoke({"messages": state["messages"]})
    # Return only the new messages produced by this agent
    new_messages = result["messages"][len(state["messages"]):]
    return {"messages": new_messages}


@traceable(run_type="chain")
def underwriter_node(state: OrchestratorState):
    """Underwriter agent node — evaluates loan eligibility and auto-executes."""
    underwriter = build_underwriter(state.get("account_id", ""))

    # Inject activation message so the Underwriter knows what to do
    activation = HumanMessage(
        content=(
            f"A loan evaluation has been requested for account "
            f"{state.get('account_id', '')}. Proceed with eligibility "
            f"check and, if qualified, automatic disbursement."
        )
    )
    messages_for_underwriter = state["messages"] + [activation]

    result = underwriter.invoke({"messages": messages_for_underwriter})

    # Return only new messages (exclude the activation + input messages)
    new_messages = result["messages"][len(messages_for_underwriter):]
    
    # Append a HumanMessage instruction so the Teller has a User role message 
    # as the last message in the list, preventing API validation errors.
    instruction = HumanMessage(
        content=(
            "The loan underwriter has completed the evaluation. "
            "Please summarize the result and details for the customer."
        )
    )
    new_messages.append(instruction)
    
    return {"messages": new_messages, "underwriter_ran": True}


# ============================================================
# ROUTING LOGIC
# ============================================================

def route_after_teller(state: OrchestratorState) -> str:
    """
    Decide next step after the Teller finishes:
      • If underwriter already ran → END (teller is giving final summary)
      • If request_loan_evaluation was called → route to Underwriter
      • Otherwise → END
    """
    # Second pass through teller (post-underwriter) → done
    if state.get("underwriter_ran", False):
        return END

    # Find the last HumanMessage to scope our search to current turn only
    last_human_idx = -1
    for i in range(len(state["messages"]) - 1, -1, -1):
        if isinstance(state["messages"][i], HumanMessage):
            last_human_idx = i
            break

    # Check messages from this turn for the handoff tool call
    for msg in state["messages"][last_human_idx + 1 :]:
        if isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                if tc["name"] == "request_loan_evaluation":
                    return "underwriter"
    return END


# ============================================================
# BUILD THE MULTI-AGENT ORCHESTRATION GRAPH
# ============================================================

def build_graph():
    """Compile the parent orchestration graph with MemorySaver checkpointer."""
    graph = StateGraph(OrchestratorState)

    # Nodes
    graph.add_node("teller", teller_node)
    graph.add_node("underwriter", underwriter_node)

    # Edges
    graph.add_edge(START, "teller")
    graph.add_conditional_edges(
        "teller",
        route_after_teller,
        {"underwriter": "underwriter", END: END},
    )
    graph.add_edge("underwriter", "teller")  # Always return to Teller for final response

    # Compile with in-memory checkpointer for thread persistence
    checkpointer = MemorySaver()
    return graph.compile(checkpointer=checkpointer)


# ---- Singleton compiled graph instance ----
banking_graph = build_graph()
