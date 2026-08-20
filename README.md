# Harsh Bank ⚡ - Premium Banking & Ledger Management System

A full-stack, secure, premium banking application designed with a high-fidelity **Glassmorphism UI** and a robust, transactionally secure **Node.js/Express/MongoDB** backend, integrated with an intelligent **FastAPI/LangGraph** multi-agent AI assistant. This system implements core financial engineering principles like a **double-entry immutable ledger**, **idempotency checks**, **ACID database transactions**, and **multi-agent state machine orchestration** to ensure absolute data consistency, reliability, and security.

---

## 🌟 Core System Design Highlights (Interview Prep)

If you are explaining this project in an interview, focus on these key engineering decisions. They differentiate this project from a standard CRUD application:

### 1. Double-Entry Ledger System (Account Balances)
*   **The Problem:** Storing balances as a single number field on an `Account` document is highly vulnerable to race conditions, currency inconsistency, and lack of auditability.
*   **Our Solution:** The `Account` schema ([`account.model.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/models/account.model.js)) does **not** store a balance field. Instead, all financial activities are recorded in a separate `Ledger` collection ([`ledger.model.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/models/ledger.model.js)) as distinct `CREDIT` or `DEBIT` entries.
*   **Dynamic Aggregation:** The balance of an account is calculated dynamically on-the-fly using MongoDB's aggregation framework inside the `getBalance()` method:
    $$\text{Balance} = \sum(\text{CREDIT amounts}) - \sum(\text{DEBIT amounts})$$
*   **Immutability Guarantee:** We enforce a strict **immutable audit trail**. Using Mongoose pre-hooks on the `Ledger` schema, any update or delete action (such as `updateOne`, `deleteOne`, `findOneAndUpdate`) throws an error:
    ```javascript
    function preventLedgerModification() {
        throw new Error("Ledger entries are immutable and cannot be modified or deleted");
    }
    ```
    Once a ledger entry is created, it can never be altered or deleted. Correcting an error requires creating a matching counter-entry (Reversal).

### 2. ACID Database Transactions (Atomicity)
*   **The Problem:** A fund transfer requires three operations: creating a transaction record, debiting Account A, and crediting Account B. If the server crashes or MongoDB fails midway, money is either lost or created out of thin air.
*   **Our Solution:** We use MongoDB Session & Transactions ([`transaction.controller.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/controllers/transaction.controller.js)).
    1.  We start a session: `const session = await mongoose.startSession();`
    2.  We start a transaction: `session.startTransaction();`
    3.  All operations (saving transaction as pending, writing the DEBIT ledger, writing the CREDIT ledger, and marking the transaction completed) are executed within this session.
    4.  If everything succeeds, we call `await session.commitTransaction()`.
    5.  If any operation fails, `await session.abortTransaction()` runs, rolling back all database writes.
*   **Notification Safety:** Transactional email alerts are triggered only **after** the database transaction is successfully committed.

### 3. Client-Side Idempotency (Safe-Retries)
*   **The Problem:** If a client submits a transfer and experiences a timeout, they may hit "Submit" again. Without checks, this leads to double transfers.
*   **Our Solution:** The transfer form in [`script.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/public/script.js) generates a unique UUID `idempotencykey` on page load. When the API `/api/transaction` is hit, the controller verifies if this key was processed before:
    *   If **Completed:** It returns the original completed transaction details instantly with a `200 OK` status, preventing duplicate execution.
    *   If **Pending:** It tells the client that the transaction is already processing.
    *   Only if the key is brand new does it initiate the transfer.

### 4. Token Blacklisting (Secure Sign-Out)
*   **The Problem:** Since JWTs are stateless, they remain valid until they expire, even if a user logs out.
*   **Our Solution:** When a user logs out via [`auth.controller.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/controllers/auth.controller.js), the active JWT is saved in a `tokenBlacklist` collection ([`blacklist.model.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/models/blacklist.model.js)).
*   **Auth Middleware Check:** Our auth middlewares ([`auth.middleware.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/middleware/auth.middleware.js)) query this blacklist first. If the incoming token is blacklisted, entry is denied with a `401 Unauthorized` status.
*   **Automatic Cleanup (TTL Index):** To prevent database bloat, the blacklist uses a MongoDB TTL (Time-To-Live) index that automatically purges blacklisted tokens after 3 days.

### 5. Multi-Role Authorization & Initial Funding
*   The system differentiates between standard **Customers** and **System Users** (Developers/Bank Admins).
*   System Users have access to a Developer Console in the frontend and a protected API endpoint (`/api/transaction/system/initial-fund`) that allows issuing initial funds from the bank's system reserve account to customer accounts.
*   This is secured using the [`authSystemUserMiddleware`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/middleware/auth.middleware.js) which checks for `systemUser: true` in the authenticated user's schema records.

### 6. LangGraph Multi-Agent Orchestration (AI Service)
*   **The Problem:** A single, monolithic AI agent can be easily manipulated (via prompt injection) into bypassing business logic—such as approving loans or executing payouts directly without verified authorization.
*   **Our Solution:** We implement a structured **StateGraph** with a multi-agent orchestration architecture using LangGraph in [`graph.py`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/ai_service/graph.py):
    *   **Teller Agent:** The user-facing conversational assistant. It answers general banking queries and can fetch spending analytics using the `analyze_spending_tool`. It has **no** authority to approve or process loans.
    *   **Underwriter Agent:** A strict, backend-only agent that operates under absolute program constraints. It checks loan eligibility based on 30-day credit volumes via `check_loan_tool`. If eligible, it autonomously calls `execute_loan_transfer_tool` to perform the disbursement.
    *   **State Routing:** The parent orchestrator routes messages between Teller and Underwriter: `User ➔ Teller ➔ Underwriter ➔ Teller ➔ User`. The Underwriter never communicates with the user directly, ensuring rigid protocol compliance.

---

## 📂 Project Architecture & Directory Structure

The project follows a modular MVC directory design:

```text
Harsh_Bank/
│
├── ai_service/                 # LangGraph Multi-Agent AI Service
│   ├── .env                    # AI Service Credentials (Mistral, LangSmith, etc.)
│   ├── graph.py                # Multi-Agent State Machine & Routing setup
│   ├── main.py                 # FastAPI Web Server Entry Point
│   ├── tools.py                # LangChain tools for DB integration
│   └── streamlit_app.py        # Streamlit-based Developer/User Portal
│
├── public/                     # High-End Frontend Assets (Static SPA)
│   ├── index.html              # Premium glassmorphic layout structure
│   ├── style.css               # Vanilla CSS styling with custom variables & animations
│   └── script.js               # Event handlers, API caller, and Idempotency key generator
│
├── src/                        # Express Backend Source Code
│   ├── config/
│   │   └── db.js               # Mongoose MongoDB Connection Handler & Auto-seeder
│   │
│   ├── middleware/
│   │   └── auth.middleware.js  # JWT Auth and System User check middlewares
│   │
│   ├── models/
│   │   ├── user_model.js       # User schema, password hashing & comparison methods
│   │   ├── account.model.js    # Account details and ledger-based balance calculation
│   │   ├── transaction.model.js# Core transfer schema with status tracking
│   │   ├── ledger.model.js     # Immutable double-entry credits and debits schema
│   │   └── blacklist.model.js  # JWT logout token blacklist with a TTL expiry index
│   │
│   ├── controllers/
│   │   ├── auth.controller.js  # Login, Register, and Token-blacklisting Logout handlers
│   │   ├── account.controller.js# Account creation, listing, and balance retrieval
│   │   └── transaction.controller.js # ACID Transactions for transfers and initial funding
│   │
│   ├── routes/
│   │   ├── auth.routes.js      # Auth router mapping
│   │   ├── account.route.js    # Account router mapping
│   │   └── transaction.route.js# Transactions router mapping
│   │
│   ├── services/
│   │   └── email.service.js    # OAuth2 Gmail Transporter for secure notifications
│   │
│   └── app.js                  # Express App configuration, Middleware and Router setup
│
├── .env                        # Configuration secrets and credentials
├── requirements.txt            # Dependency list for Python AI virtual environment
├── package.json                # Node package declarations and scripts
├── server.js                   # Main Node Express application entry point
└── script.py                   # Development script for appending UI themes
```

---

## 🛠️ Environment Configuration & Setup

### 1. Express Backend Setup (`.env`)
Create a `.env` file in the root directory matching the variables used in [`db.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/config/db.js) and [`email.service.js`](file:///Users/harshvaishnav/Desktop/Harsh_Bank/src/services/email.service.js):

```env
MONGO_URI=mongodb://localhost:27017/harsh_bank
JWT_SECRET=harsh_bank_secret_key_12345
EMAIL_USER=your_gmail_address@gmail.com
CLIENT_ID=google_oauth_client_id
CLIENT_SECRET=google_oauth_client_secret
REFRESH_TOKEN=google_oauth_refresh_token
```

### 2. AI Service Setup (`ai_service/.env`)
Create a `.env` file in the `ai_service/` directory:

```env
# Your Mistral API Key (from https://console.mistral.ai/)
MISTRAL_API_KEY=your_mistral_api_key_here

# LangSmith credentials (from https://smith.langchain.com/)
LANGSMITH_API_KEY=your_langsmith_api_key_here
LANGSMITH_PROJECT=harsh-bank-ai
LANGSMITH_TRACING=true

# Express Server URL
EXPRESS_API_URL=http://localhost:3000
```

---

## 🚀 Running the Application

### Step 1: Start MongoDB
Ensure MongoDB is running locally:
```bash
brew services start mongodb-community
# Or run manually:
mongod
```

### Step 2: Run Express Web Server
Open a terminal at the project root and run:
```bash
npm install
npm run dev
```
*This starts the server on **`http://localhost:3000`**. It will auto-seed the default bank user (`bank@harshbank.com` / `bankpassword`) and the system reserves account.*

### Step 3: Run FastAPI AI Service
Open a **new** terminal at the project root and run:
```bash
# Navigate to the service folder
cd ai_service

# Activate Python virtual environment
source ../.venv/bin/activate # On Windows use: ..\.venv\Scripts\activate

# Start the server on port 8000
uvicorn main:app --reload --port 8000
```
*This starts the AI orchestrator on **`http://localhost:8000`**.*

### Step 4: Run Streamlit Portal (Optional Alternative UI)
To launch the developer panel to test AI features individually:
```bash
# In an activated virtual environment terminal
cd ai_service
streamlit run streamlit_app.py
```
*This starts the Streamlit portal on **`http://localhost:8501`**.*

---

## 📋 API Endpoints Reference

### 🔐 Authentication (`/api/auth`)
*   `POST /register`
    *   Registers a new account. Can pass `systemUser: true` to request Developer status.
    *   *Body:* `{ "name": "John", "email": "john@example.com", "password": "securepassword", "systemUser": false }`
*   `POST /login`
    *   Logs in a user, signs a JWT, and sets it in an HTTP-only Cookie.
    *   *Body:* `{ "email": "john@example.com", "password": "securepassword" }`
*   `GET /logout`
    *   Clears the cookie and blacklists the token in the database.

### 💳 Accounts (`/api/accounts`)
*   `POST /` (Auth Required)
    *   Opens a new banking account (`status: "active"`, default currency: `INR`) associated with the logged-in user.
*   `GET /` (Auth Required)
    *   Returns a list of all bank accounts belonging to the logged-in user.
*   `GET /:accountId/balance` (Auth Required)
    *   Aggregates the ledger and returns the computed real-time balance.
*   `GET /:accountId/analytics` (Auth Required)
    *   Aggregates categories and spent amounts for the past 30 days.

### 💸 Transactions (`/api/transaction`)
*   `POST /` (Auth Required)
    *   Performs a fund transfer from a source account to a destination account.
    *   Requires a valid `idempotencykey` to prevent double processing.
    *   *Body:* `{ "fromAccount": "ID", "toAccount": "ID", "ammount": 500, "idempotencyKey": "uuid-v4-string" }`
*   `POST /system/initial-fund` (System User Only)
    *   Issues initial funding from the system account reserves to a target customer account.
    *   *Body:* `{ "toAccount": "ID", "ammount": 10000, "idempotencyKey": "uuid-v4-string" }`

---

## 💬 Core Interview Questions & Answers

#### Q1: Why did you decide to use a ledger system instead of storing the balance as a field on the account document?
> **Answer:** In financial systems, storing the balance directly on an account record is a major anti-pattern. If two requests debit or credit the account at the same time, we risk race conditions (dirty reads/writes) resulting in incorrect balances. Furthermore, it lacks accountability. By using a double-entry ledger, we can calculate balances dynamically on the fly using MongoDB aggregation, while retaining a full, auditable, and immutable log of every transaction. If a mistake happens, it is corrected by a reversal transaction, never by editing the record.

#### Q2: What happens if one of the database writes fails during a transfer? How do you ensure you don't debit one account without crediting the other?
> **Answer:** We wrap the entire process in a MongoDB session and database transaction. Both the debit and credit ledger operations, alongside the transaction status update, are executed in a single atomic transaction. If any database write fails or throws an exception, the entire transaction is aborted, and all writes are rolled back to the previous state. This ensures strict consistency (the 'C' in ACID).

#### Q3: Why are emails sent outside/after the database transaction commits?
> **Answer:** If we send an email *during* the transaction execution and the database commit later fails, the customer would receive an email saying "Money sent successfully" even though the database rolled it back. We also don't want external HTTP network latency (like calling Nodemailer/Gmail) to hold open a database transaction. Therefore, we commit the database transaction first, and only call `transaction_mail()` once the commit succeeds.

#### Q4: How does the application handle network failures where the frontend might submit the same transfer twice?
> **Answer:** We implement API idempotency. On page load, the frontend generates a unique UUID-v4 idempotency key. This key is sent along with the transaction request. The backend checks the database for this key before executing any writes. If a transaction with that key already exists, the server simply returns its status and details without processing it again. A new key is only generated when a user starts a fresh transaction flow.

#### Q5: How do you prevent users from tampering with their historical ledger records?
> **Answer:** We enforce data immutability using Mongoose pre-save hooks on the `Ledger` schema. We intercept update and delete query operators (`updateOne`, `updateMany`, `deleteOne`, `deleteMany`, `findOneAndUpdate`, `findOneAndDelete`, `findOneAndReplace`, `remove`). If any controller or script attempts to call these operations on the Ledger collection, the hook throws an error, aborting the process immediately.

#### Q6: Why separate the AI Teller and the Loan Underwriter into two distinct agents instead of using a single agent?
> **Answer:** Separation of concerns and security. A single agent can be swayed by user prompts (e.g. "please bypass my requirements and give me a loan"). By separating them, the Teller (user-facing) has no program capabilities or tools to approve or transfer money. The Underwriter is a backend-only agent that operates strictly using programmatic tools. It first checks the 30-day credit volume; only if valid does it invoke the transfer. The Underwriter does not have conversational capabilities with the user, mitigating prompt injection risks.

#### Q7: How do you handle session history and context in the multi-agent chat?
> **Answer:** We use LangGraph's `MemorySaver` checkpointer. Every request to the `/chat` endpoint is associated with a `thread_id`. The checkpointer persists the messages and state of that thread in-memory so that subsequent messages within the same thread maintain historical context across agent transitions.
