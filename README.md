# Harsh Bank ⚡ - Premium Banking & Ledger Management System

A full-stack, secure, premium banking application designed with a high-fidelity **Glassmorphism UI** and a robust, transactionally secure **Node.js/Express/MongoDB** backend. This system implements core financial engineering principles like a **double-entry immutable ledger**, **idempotency checks**, and **ACID database transactions** to ensure absolute data consistency and system reliability.

---

## 🌟 Core System Design Highlights (Interview Prep)

If you are explaining this project in an interview, focus on these key engineering decisions. They differentiate this project from a standard CRUD application:

### 1. Double-Entry Ledger System (Account Balances)
*   **The Problem:** Storing balances as a single number field on an `Account` document is highly vulnerable to race conditions, currency inconsistency, and lack of auditability.
*   **Our Solution:** The `Account` schema ([`account.model.js`](file:///Users/harshvaishnav/Desktop/banking/src/models/account.model.js)) does **not** store a balance field. Instead, all financial activities are recorded in a separate `Ledger` collection ([`ledger.model.js`](file:///Users/harshvaishnav/Desktop/banking/src/models/ledger.model.js)) as distinct `CREDIT` or `DEBIT` entries.
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
*   **Our Solution:** We use MongoDB Session & Transactions ([`transaction.controller.js`](file:///Users/harshvaishnav/Desktop/banking/src/controllers/transaction.controller.js)).
    1.  We start a session: `const session = await mongoose.startSession();`
    2.  We start a transaction: `session.startTransaction();`
    3.  All operations (saving transaction as pending, writing the DEBIT ledger, writing the CREDIT ledger, and marking the transaction completed) are executed within this session.
    4.  If everything succeeds, we call `await session.commitTransaction()`.
    5.  If any operation fails, `await session.abortTransaction()` runs, rolling back all database writes.
*   **Notification Safety:** Transactional email alerts are triggered only **after** the database transaction is successfully committed.

### 3. Client-Side Idempotency (Safe-Retries)
*   **The Problem:** If a client submits a transfer and experiences a timeout, they may hit "Submit" again. Without checks, this leads to double transfers.
*   **Our Solution:** The transfer form in [`script.js`](file:///Users/harshvaishnav/Desktop/banking/public/script.js) generates a unique UUID `idempotencykey` on page load. When the API `/api/transaction` is hit, the controller verifies if this key was processed before:
    *   If **Completed:** It returns the original completed transaction details instantly with a `200 OK` status, preventing duplicate execution.
    *   If **Pending:** It tells the client that the transaction is already processing.
    *   Only if the key is brand new does it initiate the transfer.

### 4. Token Blacklisting (Secure Sign-Out)
*   **The Problem:** Since JWTs are stateless, they remain valid until they expire, even if a user logs out.
*   **Our Solution:** When a user logs out via [`auth.controller.js`](file:///Users/harshvaishnav/Desktop/banking/src/controllers/auth.controller.js), the active JWT is saved in a `tokenBlacklist` collection ([`blacklist.model.js`](file:///Users/harshvaishnav/Desktop/banking/src/models/blacklist.model.js)).
*   **Auth Middleware Check:** Our auth middlewares ([`auth.middleware.js`](file:///Users/harshvaishnav/Desktop/banking/src/middleware/auth.middleware.js)) query this blacklist first. If the incoming token is blacklisted, entry is denied with a `401 Unauthorized` status.
*   **Automatic Cleanup (TTL Index):** To prevent database bloat, the blacklist uses a MongoDB TTL (Time-To-Live) index that automatically purges blacklisted tokens after 3 days.

### 5. Multi-Role Authorization & Initial Funding
*   The system differentiates between standard **Customers** and **System Users** (Developers/Bank Admins).
*   System Users have access to a Developer Console in the frontend and a protected API endpoint (`/api/transaction/system/initial-fund`) that allows issuing initial funds from the bank's system reserve account to customer accounts.
*   This is secured using the [`authSystemUserMiddleware`](file:///Users/harshvaishnav/Desktop/banking/src/middleware/auth.middleware.js) which checks for `systemUser: true` in the authenticated user's schema records.

---

## 📂 Project Architecture & Directory Structure

The project follows a modular MVC directory design:

```text
banking/
│
├── public/                     # High-End Frontend Assets (Static SPA)
│   ├── index.html              # Premium layout structure
│   ├── style.css               # Vanilla CSS with Custom Properties, Glassmorphism, animations
│   └── script.js               # Event handlers, API caller, and Idempotency key generator
│
├── src/                        # Express Backend Source Code
│   ├── config/
│   │   └── db.js               # Mongoose MongoDB Connection Handler
│   │
│   ├── middleware/
│   │   └── auth.middleware.js  # JWT Auth and System User check middlewares
│   │
│   ├── models/
│   │   ├── user_model.js       # User schema, password hashing & comparison methods
│   │   ├── account.model.js    # Account details and ledger-based balance calculation method
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
├── requirements.txt            # Dependency list for replication
├── package.json                # Node package declarations and scripts
└── server.js                   # Main application entry point
```

---

## 🛠️ Environment Configuration & Setup

Create a `.env` file in the root directory matching the variables used in [`db.js`](file:///Users/harshvaishnav/Desktop/banking/src/config/db.js) and [`email.service.js`](file:///Users/harshvaishnav/Desktop/banking/src/services/email.service.js):

```env
MONGO_URI=mongodb://localhost:27017/banking
JWT_SECRET=your_jwt_signing_secret_key
EMAIL_USER=your_gmail_address@gmail.com
CLIENT_ID=google_oauth_client_id
CLIENT_SECRET=google_oauth_client_secret
REFRESH_TOKEN=google_oauth_refresh_token
```

### Quick Start Commands

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Run backend server (development mode with Nodemon):**
    ```bash
    npm run dev
    ```

3.  **Run backend server (production mode):**
    ```bash
    npm start
    ```

4.  **Access the application:**
    Open `http://localhost:3000` in your web browser.

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
    *   Aggregates the ledger and returns the computed real-time balance for the given account.

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
