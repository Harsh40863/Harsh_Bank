"""
Harsh Bank AI Service — LangChain Tool Definitions
===================================================
Each tool wraps an HTTP call to the Express API and is
decorated with both @tool (LangChain) and @traceable (LangSmith)
for full observability on the LangChain dashboard.
"""

import httpx
import os
import uuid
import contextvars
from langchain_core.tools import tool
from langsmith import traceable
from dotenv import load_dotenv

load_dotenv()

EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:3000")
SYSTEM_USER_TOKEN = os.getenv("SYSTEM_USER_TOKEN", "")

# ============================================================
# PER-REQUEST CONTEXT (async-safe via contextvars)
# ============================================================
# Set by FastAPI before each graph invocation so that tools
# can access the current user's JWT without polluting tool
# function signatures visible to the LLM.

current_user_token = contextvars.ContextVar("current_user_token", default="")
current_account_id = contextvars.ContextVar("current_account_id", default="")


# ============================================================
# TOOL 1 — SMART SPEND ANALYTICS (Read-Only)
# ============================================================

@tool
@traceable(run_type="tool")
def analyze_spending_tool(account_id: str) -> str:
    """Fetch a breakdown of the user's spending over the last 30 days grouped by category.
    Returns JSON with category names and total amounts spent.
    Use this when the user asks about their expenses, spending habits, or wants a spending report."""
    token = current_user_token.get()
    with httpx.Client(timeout=15.0) as client:
        response = client.get(
            f"{EXPRESS_API_URL}/api/accounts/{account_id}/analytics",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 200:
            return response.text
        return f"Error fetching analytics: {response.status_code} — {response.text}"


# ============================================================
# TOOL 2 — LOAN ELIGIBILITY CHECK (Read-Only)
# ============================================================

@tool
@traceable(run_type="tool")
def check_loan_tool(account_id: str) -> str:
    """Check if a user is eligible for a pre-approved instant loan based on
    their 30-day credit volume. Returns eligibility status, maximum loan
    amount, and total credit volume."""
    token = current_user_token.get()
    with httpx.Client(timeout=15.0) as client:
        response = client.get(
            f"{EXPRESS_API_URL}/api/accounts/{account_id}/loan-eligibility",
            headers={"Authorization": f"Bearer {token}"},
        )
        if response.status_code == 200:
            return response.text
        return f"Error checking loan eligibility: {response.status_code} — {response.text}"


# ============================================================
# TOOL 3 — EXECUTE LOAN DISBURSEMENT (Action)
# ============================================================

def get_system_user_token() -> str:
    token = os.getenv("SYSTEM_USER_TOKEN", "")
    if token:
        return token
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{EXPRESS_API_URL}/api/auth/login",
                json={"email": "bank@harshbank.com", "password": "bankpassword"}
            )
            if resp.status_code == 200:
                return resp.json().get("token", "")
    except Exception as e:
        print("Failed to auto-acquire system token:", str(e))
    return ""


@tool
@traceable(run_type="tool")
def execute_loan_transfer_tool(account_id: str, amount: int) -> str:
    """Execute a loan disbursement by transferring funds from the System
    Reserve Account to the user's account. Only call this AFTER confirming
    eligibility via check_loan_tool. This moves real money."""
    idempotent_key = f"ai-loan-{account_id}-{uuid.uuid4().hex[:12]}"
    token = get_system_user_token()
    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            f"{EXPRESS_API_URL}/api/transaction/system/initial-fund",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "toAccount": account_id,
                "ammount": amount,
                "idempotentKey": idempotent_key,
            },
        )
        if response.status_code == 201:
            return (
                f"SUCCESS: Loan of ₹{amount:,} disbursed to account {account_id}. "
                f"Transaction: {response.text}"
            )
        return f"FAILED: Loan disbursement error {response.status_code} — {response.text}"


# ============================================================
# TOOL 4 — ROUTE TO UNDERWRITER (Handoff Signal)
# ============================================================

@tool
@traceable(run_type="tool")
def request_loan_evaluation(account_id: str) -> str:
    """Route the user's loan request to the Underwriter Agent for eligibility
    evaluation and potential automatic disbursement. Use this whenever the
    user asks about loans, borrowing money, or loan eligibility."""
    return (
        f"Routing account {account_id} to the Loan Underwriter for "
        f"eligibility evaluation and potential automatic disbursement."
    )
