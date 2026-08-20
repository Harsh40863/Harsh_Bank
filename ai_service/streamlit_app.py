import streamlit as st
import httpx
import pandas as pd
import json
import re
import os

SESSION_CACHE_FILE = os.path.join(os.path.dirname(__file__), ".session_cache.json")

def load_cached_session():
    if os.path.exists(SESSION_CACHE_FILE):
        try:
            with open(SESSION_CACHE_FILE, "r") as f:
                data = json.load(f)
                st.session_state.token = data.get("token")
                st.session_state.user = data.get("user")
                st.session_state.chat_thread_id = data.get("chat_thread_id")
        except Exception as e:
            print("Error loading cached session:", str(e))

def save_cached_session():
    try:
        with open(SESSION_CACHE_FILE, "w") as f:
            json.dump({
                "token": st.session_state.token,
                "user": st.session_state.user,
                "chat_thread_id": st.session_state.chat_thread_id
            }, f)
    except Exception as e:
        print("Error saving cached session:", str(e))

def clear_cached_session():
    if os.path.exists(SESSION_CACHE_FILE):
        try:
            os.remove(SESSION_CACHE_FILE)
        except Exception as e:
            print("Error clearing cached session:", str(e))

# Set page configuration
st.set_page_config(
    page_title="Harsh Bank - AI Portal",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

EXPRESS_API_URL = "http://localhost:3000"
AI_SERVICE_URL = "http://localhost:8000"

# Custom styles for Glassmorphic dark theme
st.markdown("""
<style>
    .reportview-container {
        background: #0a0d14;
    }
    .main {
        background-color: #0a0d14;
        color: #f1f3f9;
    }
    h1, h2, h3, h4 {
        font-family: 'Plus Jakarta Sans', sans-serif !important;
        font-weight: 700 !important;
        color: #ffffff !important;
    }
    .stButton>button {
        background: linear-gradient(135deg, #7c4dff 0%, #448aff 100%);
        color: white;
        border: none;
        padding: 8px 20px;
        border-radius: 8px;
        font-weight: 600;
        transition: all 0.3s ease;
    }
    .stButton>button:hover {
        filter: brightness(1.15);
        box-shadow: 0 4px 15px rgba(124, 77, 255, 0.4);
    }
    .chat-bubble {
        padding: 12px 16px;
        border-radius: 12px;
        margin-bottom: 10px;
        font-size: 14px;
        line-height: 1.5;
        max-width: 85%;
        word-wrap: break-word;
    }
    .bot-bubble {
        background: rgba(124, 77, 255, 0.1);
        border: 1px solid rgba(124, 77, 255, 0.2);
        border-radius: 12px 12px 12px 2px;
        align-self: flex-start;
    }
    .user-bubble {
        background: rgba(68, 138, 255, 0.15);
        border: 1px solid rgba(68, 138, 255, 0.25);
        border-radius: 12px 12px 2px 12px;
        align-self: flex-end;
        margin-left: auto;
    }
</style>
""", unsafe_allow_html=True)


# Initialize Session State
if "token" not in st.session_state:
    st.session_state.token = None
if "user" not in st.session_state:
    st.session_state.user = None
if "accounts" not in st.session_state:
    st.session_state.accounts = []
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "chat_thread_id" not in st.session_state:
    st.session_state.chat_thread_id = None


# ============================================================
# API HELPERS
# ============================================================

def api_login(email, password):
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                f"{EXPRESS_API_URL}/api/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                data = response.json()
                st.session_state.token = data["token"]
                st.session_state.user = data["user"]
                save_cached_session()
                fetch_accounts()
                return True, "Login successful!"
            else:
                return False, response.json().get("message", "Authentication failed.")
    except Exception as e:
        return False, f"Server unreachable: {str(e)}"


def api_register(name, email, password):
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                f"{EXPRESS_API_URL}/api/auth/register",
                json={"name": name, "email": email, "password": password}
            )
            if response.status_code == 201:
                data = response.json()
                st.session_state.token = data["token"]
                st.session_state.user = data["user"]
                save_cached_session()
                fetch_accounts()
                return True, "Account registered successfully!"
            else:
                return False, response.json().get("message", "Registration failed.")
    except Exception as e:
        return False, f"Server unreachable: {str(e)}"


def fetch_accounts():
    if not st.session_state.token:
        return
    try:
        headers = {"Authorization": f"Bearer {st.session_state.token}"}
        with httpx.Client(timeout=10.0) as client:
            response = client.get(f"{EXPRESS_API_URL}/api/accounts", headers=headers)
            if response.status_code == 200:
                accounts = response.json().get("accounts", [])
                st.session_state.accounts = []
                for acc in accounts:
                    bal_resp = client.get(f"{EXPRESS_API_URL}/api/accounts/{acc['_id']}/balance", headers=headers)
                    balance = bal_resp.json().get("balance", 0) if bal_resp.status_code == 200 else 0
                    acc["balance"] = balance
                    st.session_state.accounts.append(acc)
    except Exception as e:
        st.error(f"Error fetching accounts: {str(e)}")


def open_new_account():
    try:
        headers = {"Authorization": f"Bearer {st.session_state.token}"}
        with httpx.Client(timeout=10.0) as client:
            response = client.post(f"{EXPRESS_API_URL}/api/accounts", headers=headers)
            if response.status_code == 201:
                st.success("New bank account opened successfully!")
                fetch_accounts()
            else:
                st.error(response.json().get("message", "Account creation failed."))
    except Exception as e:
        st.error(str(e))


def execute_normal_transfer(from_acc, to_acc, amount, key):
    try:
        headers = {"Authorization": f"Bearer {st.session_state.token}"}
        with httpx.Client(timeout=10.0) as client:
            response = client.post(
                f"{EXPRESS_API_URL}/api/transaction",
                headers=headers,
                json={
                    "fromAccount": from_acc,
                    "toAccount": to_acc,
                    "ammount": amount,
                    "idempotentKey": key
                }
            )
            if response.status_code == 201:
                st.success("Funds transferred successfully!")
                fetch_accounts()
                return True
            else:
                st.error(response.json().get("message", "Transfer failed."))
                return False
    except Exception as e:
        st.error(str(e))
        return False


# ============================================================
# APP LAYOUT
# ============================================================

if st.session_state.token is None:
    load_cached_session()
    if st.session_state.token:
        fetch_accounts()

st.title("⚡ Harsh Bank AI Orchestrator & Audit Portal")
st.markdown("---")

# ---- Auth Panel ----
if not st.session_state.token:
    st.subheader("🔑 Access Vault Portal")
    auth_tab1, auth_tab2 = st.tabs(["Sign In", "Register Account"])
    
    with auth_tab1:
        login_email = st.text_input("Email Address", placeholder="name@example.com", key="login_em")
        login_password = st.text_input("Password", type="password", placeholder="••••••••", key="login_pw")
        if st.button("Sign In Securely"):
            success, msg = api_login(login_email, login_password)
            if success:
                st.success(msg)
                st.rerun()
            else:
                st.error(msg)
                
    with auth_tab2:
        reg_name = st.text_input("Full Name", placeholder="John Doe", key="reg_nm")
        reg_email = st.text_input("Email Address", placeholder="name@example.com", key="reg_em")
        reg_password = st.text_input("Password", type="password", placeholder="••••••••", key="reg_pw")
        if st.button("Register Account"):
            success, msg = api_register(reg_name, reg_email, reg_password)
            if success:
                st.success(msg)
                st.rerun()
            else:
                st.error(msg)

else:
    # Sidebar Profile details
    user = st.session_state.user
    is_bank_admin = user["name"].lower() == "bank" or user["email"] == "bank@harshbank.com"
    
    with st.sidebar:
        st.header("👤 Security Vault")
        st.write(f"**Name:** {user['name']}")
        st.write(f"**Email:** {user['email']}")
        st.write(f"**Role:** {'Bank Admin' if is_bank_admin else 'Customer'}")
        
        if st.button("Log Out"):
            clear_cached_session()
            st.session_state.token = None
            st.session_state.user = None
            st.session_state.accounts = []
            st.session_state.chat_history = []
            st.session_state.chat_thread_id = None
            st.rerun()

    # ============================================================
    # BANK ADMIN VIEW
    # ============================================================
    if is_bank_admin:
        st.header("🛡️ Master Bank Command Center")
        st.caption("AI-disbursed ledger reports and autonomous banking controllers.")
        
        adm_tab1, adm_tab2 = st.tabs(["💰 Disbursed Loans Audit", "👥 User List & Loan Status"])
        
        with adm_tab1:
            st.subheader("Master Loan Ledger")
            try:
                headers = {"Authorization": f"Bearer {st.session_state.token}"}
                with httpx.Client(timeout=10.0) as client:
                    resp = client.get(f"{EXPRESS_API_URL}/api/system/loans-disbursed", headers=headers)
                    if resp.status_code == 200:
                        loans = resp.json().get("loans", [])
                        if loans:
                            df_loans = pd.DataFrame(loans)
                            # Formatting clean output
                            df_loans = df_loans.rename(columns={
                                "recipientName": "Recipient Name",
                                "recipientEmail": "Email",
                                "ammount": "Amount (INR)",
                                "transactionStatus": "Status",
                                "createdAt": "Date"
                            })
                            st.dataframe(df_loans[["Recipient Name", "Email", "Amount (INR)", "Status", "Date"]], use_container_width=True)
                        else:
                            st.info("No system disbursed loans recorded.")
            except Exception as e:
                st.error(f"Error loading ledger: {str(e)}")
                
        with adm_tab2:
            st.subheader("Manage Customers & Manual Loan Grant Console")
            
            # Fetch users loans list
            users_list = []
            try:
                headers = {"Authorization": f"Bearer {st.session_state.token}"}
                with httpx.Client(timeout=10.0) as client:
                    resp = client.get(f"{EXPRESS_API_URL}/api/system/users-loans", headers=headers)
                    if resp.status_code == 200:
                        users_list = resp.json().get("users", [])
            except Exception as e:
                st.error(f"Error fetching user list: {str(e)}")

            # Display users in a dataframe
            if users_list:
                df_users = pd.DataFrame(users_list)
                df_users = df_users.rename(columns={
                    "name": "Customer Name",
                    "email": "Email Address",
                    "accountId": "Account ID",
                    "creditVolume": "30-Day Credit (INR)",
                    "loanStatus": "Status",
                    "loanAmount": "Loan Granted (INR)"
                })
                st.dataframe(df_users[["Customer Name", "Email Address", "Account ID", "30-Day Credit (INR)", "Status", "Loan Granted (INR)"]], use_container_width=True)
            else:
                st.info("No accounts registered.")

            st.write("---")
            st.subheader("Disburse Instant Loan (Autonomous Authority)")
            
            # Manual Grant Form
            col_g1, col_g2 = st.columns(2)
            with col_g1:
                grant_to = st.text_input("Recipient Account ID", placeholder="Paste target account ID here")
            with col_g2:
                grant_amt = st.number_input("Disbursement Amount (INR)", min_value=1, value=10000, step=1000)
                
            if st.button("Disburse Reserve Funds"):
                if not grant_to:
                    st.error("Recipient Account ID is required.")
                else:
                    try:
                        id_key = f"adm-manual-loan-{grant_to[:8]}-{int(pd.Timestamp.now().timestamp())}"
                        headers = {"Authorization": f"Bearer {st.session_state.token}"}
                        with httpx.Client(timeout=10.0) as client:
                            res = client.post(
                                f"{EXPRESS_API_URL}/api/transaction/system/initial-fund",
                                headers=headers,
                                json={
                                    "toAccount": grant_to,
                                    "ammount": grant_amt,
                                    "idempotentKey": id_key
                                }
                            )
                            if res.status_code == 201:
                                st.success(f"Successfully granted ₹{grant_amt:,} to account {grant_to}!")
                                st.rerun()
                            else:
                                st.error(res.json().get("message", "Failed to disburse."))
                    except Exception as e:
                        st.error(str(e))

    # ============================================================
    # CUSTOMER VIEW (AI chatbot, accounts list)
    # ============================================================
    else:
        st.header(f"⚡ Welcome back, {user['name']}!")
        
        # Accounts list
        st.subheader("My Accounts Overview")
        if not st.session_state.accounts:
            st.info("You don't have any accounts. Open your first checking account below!")
            if st.button("+ Open New Checking Account"):
                open_new_account()
                st.rerun()
        else:
            cols = st.columns(len(st.session_state.accounts) + 1)
            for i, acc in enumerate(st.session_state.accounts):
                with cols[i]:
                    st.markdown(f"""
                    <div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
                        <span style="font-size: 11px; font-weight: 700; color: #8a99ad;">{acc['currency']} Checking</span>
                        <h2 style="margin: 10px 0;">₹{acc['balance']:,}</h2>
                        <span style="font-family: monospace; font-size: 11px; color: #576575;">ID: {acc['_id']}</span>
                    </div>
                    """, unsafe_allow_html=True)
            with cols[-1]:
                st.write("")
                st.write("")
                if st.button("+ Open New Checking Account"):
                    open_new_account()
                    st.rerun()

        st.write("---")

        # Layout: Left side normal transfer, Right side AI Chat panel
        col_main1, col_main2 = st.columns([1, 1.2])

        with col_main1:
            st.subheader("💸 Send Money")
            if st.session_state.accounts:
                source_options = [acc["_id"] for acc in st.session_state.accounts]
                src_acc = st.selectbox("From Account", source_options)
                dest_acc = st.text_input("Destination Account ID")
                tx_amt = st.number_input("Amount (INR)", min_value=1, step=100)
                tx_key = st.text_input("Idempotency Safe-Retry Key", value=f"tx-{src_acc[:4]}-{int(pd.Timestamp.now().timestamp())}")
                
                if st.button("Execute Transfer"):
                    if not dest_acc:
                        st.error("Destination Account ID is required.")
                    else:
                        execute_normal_transfer(src_acc, dest_acc, tx_amt, tx_key)
            else:
                st.info("Create an account first to transfer money.")

        with col_main2:
            st.subheader("🤖 HarshBot Multi-Agent AI Assistant")
            
            # Message Input & Quick Action buttons
            col_btn1, col_btn2 = st.columns(2)
            with col_btn1:
                if st.button("📊 Smart Spend Analytics"):
                    # Inject query
                    st.session_state.chat_history.append({"role": "user", "content": "Give me a breakdown of my expenses this month"})
                    # Trigger call
                    with st.spinner("HarshBot is compiling analytics report..."):
                        headers = {"Content-Type": "application/json"}
                        try:
                            resp = httpx.post(
                                f"{AI_SERVICE_URL}/chat",
                                headers=headers,
                                json={
                                    "message": "Give me a breakdown of my expenses this month",
                                    "account_id": st.session_state.accounts[0]["_id"],
                                    "thread_id": st.session_state.chat_thread_id,
                                    "token": st.session_state.token
                                },
                                timeout=45.0
                            )
                            if resp.status_code == 200:
                                d = resp.json()
                                st.session_state.chat_thread_id = d["thread_id"]
                                st.session_state.chat_history.append({"role": "bot", "content": d["reply"]})
                        except Exception as e:
                            st.session_state.chat_history.append({"role": "bot", "content": f"Connection Error: {str(e)}"})
                    st.rerun()

            with col_btn2:
                if st.button("💸 Check Loan Eligibility"):
                    st.session_state.chat_history.append({"role": "user", "content": "Am I eligible for a loan?"})
                    with st.spinner("HarshBot is checking credit history..."):
                        headers = {"Content-Type": "application/json"}
                        try:
                            resp = httpx.post(
                                f"{AI_SERVICE_URL}/chat",
                                headers=headers,
                                json={
                                    "message": "Am I eligible for a loan?",
                                    "account_id": st.session_state.accounts[0]["_id"],
                                    "thread_id": st.session_state.chat_thread_id,
                                    "token": st.session_state.token
                                },
                                timeout=45.0
                            )
                            if resp.status_code == 200:
                                d = resp.json()
                                st.session_state.chat_thread_id = d["thread_id"]
                                st.session_state.chat_history.append({"role": "bot", "content": d["reply"]})
                        except Exception as e:
                            st.session_state.chat_history.append({"role": "bot", "content": f"Connection Error: {str(e)}"})
                    st.rerun()

            # Chat UI rendering
            chat_container = st.container(height=350)
            with chat_container:
                for msg in st.session_state.chat_history:
                    role_class = "user-bubble" if msg["role"] == "user" else "bot-bubble"
                    content = msg["content"]
                    
                    # Extract spend analytics JSON if present
                    analytics_match = re.search(r"<<<ANALYTICS_JSON>>>(.*?)<<<END_ANALYTICS_JSON>>>", content, re.DOTALL)
                    if analytics_match:
                        clean_text = re.sub(r"<<<ANALYTICS_JSON>>>.*?<<<END_ANALYTICS_JSON>>>", "", content, flags=re.DOTALL).strip()
                        st.markdown(f'<div class="chat-bubble {role_class}">{clean_text}</div>', unsafe_allow_html=True)
                        try:
                            analytics_data = json.loads(analytics_match.group(1))
                            df_chart = pd.DataFrame(analytics_data.get("analytics", []))
                            if not df_chart.empty:
                                st.write("**Visual Spend Breakdown:**")
                                st.chart_type = st.vega_lite_chart(df_chart, {
                                    "mark": {"type": "arc", "innerRadius": 30},
                                    "encoding": {
                                        "theta": {"field": "total", "type": "quantitative"},
                                        "color": {"field": "category", "type": "nominal"}
                                    }
                                }, use_container_width=True)
                        except Exception as e:
                            st.error(f"Chart Render Error: {str(e)}")
                    else:
                        st.markdown(f'<div class="chat-bubble {role_class}">{content}</div>', unsafe_allow_html=True)

            # TextInput for chatting
            user_msg = st.chat_input("Message HarshBot AI Teller...")
            if user_msg:
                st.session_state.chat_history.append({"role": "user", "content": user_msg})
                with st.spinner("Waiting for reply..."):
                    headers = {"Content-Type": "application/json"}
                    try:
                        resp = httpx.post(
                            f"{AI_SERVICE_URL}/chat",
                            headers=headers,
                            json={
                                "message": user_msg,
                                "account_id": st.session_state.accounts[0]["_id"],
                                "thread_id": st.session_state.chat_thread_id,
                                "token": st.session_state.token
                            },
                            timeout=45.0
                        )
                        if resp.status_code == 200:
                            d = resp.json()
                            st.session_state.chat_thread_id = d["thread_id"]
                            st.session_state.chat_history.append({"role": "bot", "content": d["reply"]})
                        else:
                            st.session_state.chat_history.append({"role": "bot", "content": f"Service Error: {resp.text}"})
                    except Exception as e:
                        st.session_state.chat_history.append({"role": "bot", "content": f"Connection Error: {str(e)}"})
                st.rerun()
