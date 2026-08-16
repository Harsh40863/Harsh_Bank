// Global State Management
let currentUser = null;
let activeAccounts = [];
let isSystemModeEnabled = false;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
    initApp();
    setupEventHandlers();
    generateIdempotencyKey();
});

// Toast Notification Manager
function showToast(title, message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    let icon = "ℹ️";
    if (type === "success") icon = "✅";
    if (type === "error") icon = "❌";
    if (type === "warning") icon = "⚠️";
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 5 seconds
    const timer = setTimeout(() => {
        toast.remove();
    }, 5000);
    
    // Close button handler
    toast.querySelector(".toast-close").addEventListener("click", () => {
        clearTimeout(timer);
        toast.remove();
    });
}

// Generate unique idempotency key for transactions
function generateIdempotencyKey() {
    const randomBytes = Array.from({length: 16}, () => Math.floor(Math.random() * 256));
    const hexString = randomBytes.map(b => b.toString(16).padStart(2, '0')).join('');
    // Format as UUID v4
    const key = [
        hexString.substring(0, 8),
        hexString.substring(8, 12),
        "4" + hexString.substring(13, 16),
        ((parseInt(hexString.substring(16, 18), 16) & 0x3f) | 0x80).toString(16) + hexString.substring(18, 20),
        hexString.substring(20, 32)
    ].join('-');
    
    document.getElementById("txIdempotencyKey").value = key;
}

// Helper to make API requests with JSON headers & error handling
async function apiRequest(url, method = "GET", body = null) {
    const headers = {
        "Content-Type": "application/json"
    };

    // Attach Authorization header if token is stored in memory or localStorage
    const savedUser = currentUser || JSON.parse(localStorage.getItem("banking_user") || "null");
    if (savedUser && savedUser.token) {
        headers["Authorization"] = `Bearer ${savedUser.token}`;
    }

    const options = {
        method,
        headers
    };
    
    if (body) {
        options.body = JSON.stringify(body);
    }
    
    try {
        const response = await fetch(url, options);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || `Request failed with status ${response.status}`);
        }
        return data;
    } catch (error) {
        console.error(`API Error (${url}):`, error);
        throw error;
    }
}

// Switch between Auth Panels (Sign In vs Register)
function setupAuthTabs() {
    const tabSignIn = document.getElementById("tabSignIn");
    const tabSignUp = document.getElementById("tabSignUp");
    const signInForm = document.getElementById("signInForm");
    const signUpForm = document.getElementById("signUpForm");
    
    tabSignIn.addEventListener("click", () => {
        tabSignIn.classList.add("active");
        tabSignUp.classList.remove("active");
        signInForm.classList.add("active");
        signUpForm.classList.remove("active");
    });
    
    tabSignUp.addEventListener("click", () => {
        tabSignUp.classList.add("active");
        tabSignIn.classList.remove("active");
        signUpForm.classList.add("active");
        signInForm.classList.remove("active");
    });
}

// Handle login state restoration from localStorage / cookies
async function initApp() {
    setupAuthTabs();
    
    const savedUser = localStorage.getItem("banking_user");
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            // Fetch accounts to check if user token is still valid
            await fetchUserAccounts();
            showDashboard();
        } catch (err) {
            console.log("Session expired or invalid, cleaning up.");
            clearLocalSession();
        }
    } else {
        showAuth();
    }
}

function clearLocalSession() {
    currentUser = null;
    activeAccounts = [];
    document.getElementById("accountsList").innerHTML = "";
    document.getElementById("txFromAccount").innerHTML = `<option value="" disabled selected>Select source account</option>`;
    localStorage.removeItem("banking_user");
    showAuth();
}

function showAuth() {
    document.getElementById("authView").classList.add("active");
    document.getElementById("dashboardView").classList.remove("active");
    document.getElementById("userProfileNav").style.display = "none";
}

function showDashboard() {
    document.getElementById("authView").classList.remove("active");
    document.getElementById("dashboardView").classList.add("active");
    document.getElementById("userProfileNav").style.display = "flex";
    
    // Update headers and profile details
    document.getElementById("navUserName").textContent = currentUser.name;
    document.getElementById("sidebarName").textContent = currentUser.name;
    document.getElementById("sidebarEmail").textContent = currentUser.email;
    document.getElementById("avatarLetter").textContent = currentUser.name.charAt(0).toUpperCase();
    document.getElementById("sidebarAvatar").textContent = currentUser.name.charAt(0).toUpperCase();
    
    // Show role badge
    const roleBadge = document.getElementById("sidebarRoleBadge");
    const navUserRole = document.getElementById("navUserRole");
    if (currentUser.systemUser) {
        roleBadge.textContent = "System User";
        roleBadge.className = "badge badge-active";
        navUserRole.textContent = "System User";
    } else {
        roleBadge.textContent = "Customer";
        roleBadge.className = "badge badge-muted";
        navUserRole.textContent = "Customer";
    }
    
    updateSystemConsoleView();
}

// Setup Event Listeners
function setupEventHandlers() {
    // 1. Sign In Form
    document.getElementById("signInForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector("button[type='submit']");
        const textSpan = submitBtn.querySelector("span");
        const spinner = submitBtn.querySelector(".spinner");
        
        textSpan.style.display = "none";
        spinner.style.display = "inline-block";
        submitBtn.disabled = true;
        
        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;
        
        try {
            const data = await apiRequest("/api/auth/login", "POST", { email, password });
            
            // Set currentUser including the token returned from the backend
            currentUser = data.user;
            currentUser.token = data.token;
            
            await fetchUserAccounts();
            
            localStorage.setItem("banking_user", JSON.stringify(currentUser));
            showDashboard();
            showToast("Login Successful", `Welcome back, ${currentUser.name}!`, "success");
            e.target.reset();
        } catch (err) {
            showToast("Authentication Failed", err.message, "error");
        } finally {
            textSpan.style.display = "inline-block";
            spinner.style.display = "none";
            submitBtn.disabled = false;
        }
    });

    // 2. Sign Up Form
    document.getElementById("signUpForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = e.target.querySelector("button[type='submit']");
        const textSpan = submitBtn.querySelector("span");
        const spinner = submitBtn.querySelector(".spinner");
        
        textSpan.style.display = "none";
        spinner.style.display = "inline-block";
        submitBtn.disabled = true;
        
        const name = document.getElementById("registerName").value;
        const email = document.getElementById("registerEmail").value;
        const password = document.getElementById("registerPassword").value;
        const systemUser = document.getElementById("registerSystemUser").checked;
        
        try {
            const data = await apiRequest("/api/auth/register", "POST", { name, email, password, systemUser });
            
            currentUser = data.user;
            currentUser.token = data.token;
            
            await fetchUserAccounts();
            
            localStorage.setItem("banking_user", JSON.stringify(currentUser));
            showDashboard();
            showToast("Registration Successful", `Welcome to Harsh Bank, ${currentUser.name}!`, "success");
            e.target.reset();
        } catch (err) {
            showToast("Registration Failed", err.message, "error");
        } finally {
            textSpan.style.display = "inline-block";
            spinner.style.display = "none";
            submitBtn.disabled = false;
        }
    });

    // 3. Log Out Button
    document.getElementById("logoutBtn").addEventListener("click", async () => {
        try {
            await apiRequest("/api/auth/logout", "GET");
            clearLocalSession();
            showToast("Logged Out", "You have been securely logged out.", "success");
        } catch (err) {
            clearLocalSession(); // Fallback if server unreachable
        }
    });

    // 4. Create Account Button
    document.getElementById("createAccountBtn").addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        const textSpan = btn.querySelector("span");
        const spinner = btn.querySelector(".spinner");
        
        textSpan.style.display = "none";
        spinner.style.display = "inline-block";
        btn.disabled = true;
        
        try {
            const data = await apiRequest("/api/accounts", "POST");
            showToast("Account Created", "Your new checking account is ready.", "success");
            await fetchUserAccounts();
        } catch (err) {
            showToast("Creation Failed", err.message, "error");
        } finally {
            textSpan.style.display = "inline-block";
            spinner.style.display = "none";
            btn.disabled = false;
        }
    });

    // 5. Transfer Form Submission
    document.getElementById("transferForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("transferSubmitBtn");
        const textSpan = submitBtn.querySelector("span");
        const spinner = submitBtn.querySelector(".spinner");
        
        textSpan.style.display = "none";
        spinner.style.display = "inline-block";
        submitBtn.disabled = true;
        
        const fromAccount = document.getElementById("txFromAccount").value;
        const toAccount = document.getElementById("txToAccount").value.trim();
        const ammount = Number(document.getElementById("txAmount").value);
        const IdempotentKey = document.getElementById("txIdempotencyKey").value;
        
        try {
            const data = await apiRequest("/api/transaction", "POST", {
                fromAccount,
                toAccount,
                ammount,
                IdempotentKey
            });
            
            showToast("Transfer Successful", `Transferred ₹${ammount} successfully!`, "success");
            
            // Refresh balances and clear inputs
            await fetchUserAccounts();
            document.getElementById("txToAccount").value = "";
            document.getElementById("txAmount").value = "";
            generateIdempotencyKey(); // Regen key for next tx
        } catch (err) {
            showToast("Transfer Failed", err.message, "error");
        } finally {
            textSpan.style.display = "inline-block";
            spinner.style.display = "none";
            submitBtn.disabled = false;
        }
    });

    // 6. Regenerate Idempotency Key
    document.getElementById("regenIdempotencyBtn").addEventListener("click", generateIdempotencyKey);

    // 7. Toggle System Developer Console Mode
    document.getElementById("systemModeToggle").addEventListener("change", (e) => {
        isSystemModeEnabled = e.target.checked;
        const sysPanel = document.getElementById("systemPanel");
        if (isSystemModeEnabled) {
            sysPanel.style.display = "block";
            sysPanel.scrollIntoView({ behavior: "smooth" });
        } else {
            sysPanel.style.display = "none";
        }
    });

    // 8. System Initial Funding Form
    document.getElementById("systemFundForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById("systemFundSubmitBtn");
        const textSpan = submitBtn.querySelector("span");
        const spinner = submitBtn.querySelector(".spinner");
        
        textSpan.style.display = "none";
        spinner.style.display = "inline-block";
        submitBtn.disabled = true;
        
        const toAccount = document.getElementById("fundToAccount").value.trim();
        const ammount = Number(document.getElementById("fundAmount").value);
        // Generate random idempotent key for system funding
        const idempotentKey = `sys-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            await apiRequest("/api/transaction/system/initial-fund", "POST", {
                toAccount,
                ammount,
                idempotentKey
            });
            
            showToast("Funding Completed", `Injected ₹${ammount} into account ${toAccount}.`, "success");
            
            // Reload user accounts in case funded account belongs to logged-in user
            await fetchUserAccounts();
            document.getElementById("fundToAccount").value = "";
            document.getElementById("fundAmount").value = "";
        } catch (err) {
            showToast("Funding Failed", err.message, "error");
        } finally {
            textSpan.style.display = "inline-block";
            spinner.style.display = "none";
            submitBtn.disabled = false;
        }
    });
}

// Update the system console alert boxes and lock/unlock actions depending on user type
function updateSystemConsoleView() {
    const authStatus = document.getElementById("systemAuthStatus");
    const fundSubmit = document.getElementById("systemFundSubmitBtn");
    
    if (currentUser.systemUser) {
        authStatus.className = "alert-box success";
        authStatus.innerHTML = `<span>Authorized: You are logged in as a <strong>System User</strong>. You can fund customer accounts using the console below.</span>`;
        fundSubmit.disabled = false;
    } else {
        authStatus.className = "alert-box warning";
        authStatus.innerHTML = `<span>Unauthorized: You are logged in as a normal <strong>Customer</strong>. To fund accounts, you must register or log in with a <strong>System User</strong> account.</span>`;
        fundSubmit.disabled = true;
    }
}

// Fetch user accounts and their balances
async function fetchUserAccounts() {
    const listEl = document.getElementById("accountsList");
    const fromSelect = document.getElementById("txFromAccount");
    
    try {
        const data = await apiRequest("/api/accounts", "GET");
        activeAccounts = data.accounts || [];
        
        // Clear elements
        listEl.innerHTML = "";
        // Reset option list, leaving first placeholder
        fromSelect.innerHTML = `<option value="" disabled selected>Select source account</option>`;
        
        if (activeAccounts.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <p>You have no bank accounts registered yet.</p>
                    <p class="subtitle">Click "+ Open New Account" above to initialize a ledger balance.</p>
                </div>
            `;
            return;
        }
        
        // Fetch balance for each account asynchronously
        for (const account of activeAccounts) {
            let balance = 0;
            try {
                const balData = await apiRequest(`/api/accounts/${account._id}/balance`, "GET");
                balance = balData.balance;
            } catch (err) {
                console.error("Error loading balance for account:", account._id, err);
            }
            
            // Render card
            const card = document.createElement("div");
            card.className = "account-card";
            card.innerHTML = `
                <div class="account-card-header">
                    <span class="label">${account.currency} Checking</span>
                    <span class="badge badge-${account.status}">${account.status}</span>
                </div>
                <div class="account-card-body">
                    <h2>₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
                </div>
                <div class="account-card-footer">
                    <div class="account-id-wrap">
                        <span class="account-id">${account._id}</span>
                        <button class="btn-copy" data-id="${account._id}" title="Copy Account ID">📋</button>
                    </div>
                </div>
            `;
            
            listEl.appendChild(card);
            
            // Add as option in transfer dropdown if active
            if (account.status === "active") {
                const option = document.createElement("option");
                option.value = account._id;
                option.textContent = `Account: ${account._id.substring(0, 8)}... (₹${balance.toLocaleString('en-IN')})`;
                fromSelect.appendChild(option);
            }
        }
        
        // Add copy events
        listEl.querySelectorAll(".btn-copy").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const accId = btn.getAttribute("data-id");
                navigator.clipboard.writeText(accId).then(() => {
                    showToast("Copied to Clipboard", `Account ID ${accId.substring(0, 8)}... copied.`, "info");
                });
            });
        });
        
    } catch (err) {
        listEl.innerHTML = `
            <div class="empty-state">
                <p class="error-text">Failed to retrieve accounts</p>
                <p class="subtitle">${err.message}</p>
            </div>
        `;
        throw err;
    }
}
