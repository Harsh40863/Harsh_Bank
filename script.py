import json

with open('/Users/harshvaishnav/Desktop/Harsh_Bank/public/style.css', 'r') as f:
    content = f.read()

with open('/Users/harshvaishnav/Desktop/Harsh_Bank/public/style.css', 'a') as f:
    if not content.endswith('\n'):
        f.write('\n')
    f.write("""
/* ============================================0 */
/* AI Chat Panel Styles                         */
/* ============================================= */

.chat-panel {
    display: flex;
    flex-direction: column;
    max-height: 600px;
    overflow: hidden;
}

.chat-header {
    padding: 20px 24px 0 24px;
}

.chat-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.chat-bot-icon {
    font-size: 28px;
    filter: drop-shadow(0 2px 6px rgba(124, 77, 255, 0.4));
}

.chat-header-info h4 {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 2px;
}

.chat-status {
    font-size: 11px;
    font-weight: 600;
    color: var(--success);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 200px;
    max-height: 350px;
}

.chat-bubble {
    padding: 12px 16px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    max-width: 95%;
    animation: fadeIn 0.3s ease;
    word-wrap: break-word;
}

.chat-bubble p {
    margin: 0;
}

.bot-bubble {
    background: rgba(124, 77, 255, 0.1);
    border: 1px solid rgba(124, 77, 255, 0.2);
    border-radius: 12px 12px 12px 2px;
    align-self: flex-start;
    color: var(--text-primary);
}

.user-bubble {
    background: rgba(68, 138, 255, 0.15);
    border: 1px solid rgba(68, 138, 255, 0.25);
    border-radius: 12px 12px 2px 12px;
    align-self: flex-end;
    color: var(--text-primary);
}

.chat-bubble .typing-indicator {
    display: inline-flex;
    gap: 4px;
    padding: 4px 0;
}

.chat-bubble .typing-indicator span {
    width: 6px;
    height: 6px;
    background: var(--primary);
    border-radius: 50%;
    animation: bounce 1.4s infinite;
}

.chat-bubble .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
.chat-bubble .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-8px); }
}

/* Chart container inside chat bubble */
.chart-container {
    background: rgba(18, 22, 32, 0.6);
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 16px;
    margin-top: 10px;
    max-width: 280px;
}

.chart-container canvas {
    max-height: 200px;
}

/* Quick Action Buttons */
.chat-quick-actions {
    display: flex;
    gap: 8px;
    padding: 0 20px 12px 20px;
    flex-wrap: wrap;
}

.btn-quick-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    font-family: var(--font-main);
    font-size: 12px;
    font-weight: 600;
    color: var(--primary);
    background: rgba(124, 77, 255, 0.08);
    border: 1px solid rgba(124, 77, 255, 0.25);
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}

.btn-quick-action:hover {
    background: rgba(124, 77, 255, 0.18);
    border-color: rgba(124, 77, 255, 0.45);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(124, 77, 255, 0.15);
}

/* Chat Input Area */
.chat-input-area {
    display: flex;
    gap: 8px;
    padding: 12px 20px 20px 20px;
    border-top: 1px solid var(--border-color);
}

.chat-input-area input {
    flex: 1;
    padding: 10px 14px;
    font-size: 13px;
    border-radius: 20px;
}

.btn-send {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: var(--primary-gradient);
    border: none;
    color: #ffffff;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 3px 12px rgba(124, 77, 255, 0.25);
    flex-shrink: 0;
}

.btn-send:hover {
    filter: brightness(1.15);
    box-shadow: 0 5px 16px rgba(124, 77, 255, 0.35);
}

/* ============================================= */
/* Admin Dashboard Styles                       */
/* ============================================= */

.admin-dashboard {
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
}

.admin-icon {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #ef4444;
}

.admin-stats {
    display: flex;
    gap: 20px;
    padding: 0 30px 20px 30px;
}

.stat-card {
    flex: 1;
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.stat-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stat-value {
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.5px;
    background: var(--primary-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.admin-table-wrap {
    padding: 0 30px 30px 30px;
    overflow-x: auto;
}

.admin-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.admin-table thead th {
    background: rgba(0, 0, 0, 0.3);
    padding: 14px 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
    text-align: left;
    border-bottom: 1px solid var(--border-color);
}

.admin-table tbody td {
    padding: 14px 20px;
    font-size: 13px;
    color: var(--text-primary);
    border-bottom: 1px solid rgba+255, 255, 255, 0.04);
}

.admin-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.03);
}

.admin-table tbody tr:last-child td {
    border-bottom: none;
}

.empty-table {
    text-align: center;
    color: var(--text-secondary);
    padding: 40px 20px !important;
}

.status-badge {
    display: inline-flex;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
}

.status-completed {
    background: rgba(16, 185, 129, 0.15);
    color: var(--success);
    border: 1px solid rgba(16, 185, 129, 0.25);
}

.status-pending {
    background: rgba(245, 158, 11, 0.15);
    color: var(--warning);
    border: 1px solid rgba+245, 158, 11, 0.25);
}

.status-failed {
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.25);
}

/* Admin nav badge */
.badge-admin {
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger);
    border-width: 1px;
    border-style: solid;
    border-color: rgba(239, 68, 68, 0.25);
}
""")

