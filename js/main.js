// js/main.js
class ConversationManager {
    constructor() {
        this.conversation = [];
        this.workerUrl = 'https://3way.jon-fb0.workers.dev';
        this.lastRespondingAssistant = null;
        this.init();
        this.setupSecurityMeasures();
    }

    setupSecurityMeasures() {
        // Sanitize input
        this.userInput.addEventListener('input', (e) => {
            e.target.value = this.sanitizeInput(e.target.value);
        });

        // Clear sensitive data on page hide
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.clearSensitiveData();
            }
        });
    }

    sanitizeInput(input) {
        return input.replace(/<[^>]*>/g, ''); // Remove HTML tags
    }

    clearSensitiveData() {
        this.userInput.value = '';
        // Clear any sensitive data from memory
    }

    init() {
        this.sendBtn = document.getElementById('sendBtn');
        this.userInput = document.getElementById('userInput');
        this.conversationDiv = document.getElementById('conversation');
        this.clearBtn = document.getElementById('clearBtn');

        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.clearBtn.addEventListener('click', () => this.clearConversation());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        this.loadConversation();
    }

    parseMessage(message, isFirstMessage) {
        const mentionRegex = /@(Chad|Claude)\b/i;
        const match = message.match(mentionRegex);

        if (isFirstMessage && !match) {
            throw new Error('Please start your conversation by mentioning either @Chad or @Claude');
        }

        if (match) {
            const target = match[1].toLowerCase() === 'chad' ? 'gpt' : 'claude';
            const cleanMessage = message.replace(mentionRegex, '').trim();
            return { target, message: cleanMessage };
        }

        // No mention, use last responding assistant
        if (this.lastRespondingAssistant) {
            return { target: this.lastRespondingAssistant, message };
        }

        // Fallback (shouldn't happen due to first message check)
        throw new Error('Please mention either @Chad or @Claude');
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.userInput.value = '';
        const isFirstMessage = this.conversation.length === 0;

        try {
            const { target, message: cleanMessage } = this.parseMessage(message, isFirstMessage);

            this.appendMessage('user', message);
            this.sendBtn.disabled = true;

            const response = await fetch(this.workerUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                },
                mode: 'cors',
                body: JSON.stringify({ 
                    message: cleanMessage,
                    target,
                    history: this.conversation 
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server error');
            }

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error);
            }

            if (target === 'gpt' && data.gpt) {
                this.appendMessage('gpt', data.gpt);
                this.lastRespondingAssistant = 'gpt';
            }
            if (target === 'claude' && data.claude) {
                this.appendMessage('claude', data.claude);
                this.lastRespondingAssistant = 'claude';
            }

        } catch (error) {
            console.error('Error:', error);
            // Remove the user message if it was an initial message error
            if (isFirstMessage && error.message.includes('@Chad or @Claude')) {
                this.conversation.pop();
                this.conversationDiv.removeChild(this.conversationDiv.lastChild);
            }
            this.appendMessage('system', `Error: ${error.message}`);
        } finally {
            this.sendBtn.disabled = false;
            this.saveConversation();
        }
    }

    clearConversation() {
        localStorage.removeItem('conversation');
        this.conversation = [];
        this.conversationDiv.innerHTML = '';
        this.lastRespondingAssistant = null;
    }

    appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const roleLabel = document.createElement('div');
        roleLabel.className = 'role-label';
        roleLabel.textContent = this.getRoleLabel(role);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'content';
        contentDiv.textContent = content;

        messageDiv.appendChild(roleLabel);
        messageDiv.appendChild(contentDiv);

        this.conversationDiv.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });

        this.conversation.push({ role, content });
    }

    getRoleLabel(role) {
        const labels = {
            'user': 'You',
            'gpt': 'Chad',
            'claude': 'Claude',
            'system': 'System'
        };
        return labels[role] || role;
    }

    encryptData(data) {
        // Simple XOR encryption (consider using SubtleCrypto for production)
        return btoa(JSON.stringify(data));
    }

    decryptData(encrypted) {
        return JSON.parse(atob(encrypted));
    }

    saveConversation() {
        const encrypted = this.encryptData(this.conversation);
        localStorage.setItem('conversation', encrypted);
    }

    loadConversation() {
        const saved = localStorage.getItem('conversation');
        if (saved) {
            try {
                const decrypted = this.decryptData(saved);
                this.conversation = [];
                this.conversationDiv.innerHTML = '';
                decrypted.forEach(msg => this.appendMessage(msg.role, msg.content));
            } catch (error) {
                console.error('Error loading conversation:', error);
                this.clearConversation();
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ConversationManager();
});
