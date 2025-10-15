// popup.js - Complete popup logic with authentication and WSS support

// Storage keys
const STORAGE_KEYS = {
    SERVER_URL: 'terminalServerUrl',
    SERVER_PASSWORD: 'terminalServerPassword',
    COMMANDS: 'terminalCommands'
};

// Elements
const serverUrlInput = document.getElementById('serverUrl');
const serverPasswordInput = document.getElementById('serverPassword');
const togglePassword = document.getElementById('togglePassword');
const connectPopupBtn = document.getElementById('connectPopup');
const openNewTabBtn = document.getElementById('openNewTab');
const disconnectBtn = document.getElementById('disconnectBtn');
const statusDiv = document.getElementById('status');
const terminalContainer = document.getElementById('terminalContainer');
const commandsSection = document.getElementById('commandsSection');
const commandsList = document.getElementById('commandsList');
const addCommandBtn = document.getElementById('addCommandBtn');
const commandModal = document.getElementById('commandModal');
const modalTitle = document.getElementById('modalTitle');
const commandAlias = document.getElementById('commandAlias');
const commandText = document.getElementById('commandText');
const cancelModal = document.getElementById('cancelModal');
const saveCommand = document.getElementById('saveCommand');

let editingCommandId = null;
let socket = null;
let term = null;
let authPending = false;

// Toggle password visibility
togglePassword.addEventListener('click', () => {
    const type = serverPasswordInput.type === 'password' ? 'text' : 'password';
    serverPasswordInput.type = type;
    togglePassword.textContent = type === 'password' ? '👁️' : '🙈';
});

// Load saved data
chrome.storage.local.get([STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.SERVER_PASSWORD, STORAGE_KEYS.COMMANDS], (result) => {
    if (result[STORAGE_KEYS.SERVER_URL]) {
        serverUrlInput.value = result[STORAGE_KEYS.SERVER_URL];
    }
    if (result[STORAGE_KEYS.SERVER_PASSWORD]) {
        serverPasswordInput.value = result[STORAGE_KEYS.SERVER_PASSWORD];
    }
    if (result[STORAGE_KEYS.COMMANDS]) {
        renderCommands(result[STORAGE_KEYS.COMMANDS]);
    }
});

// Save server URL on change
serverUrlInput.addEventListener('change', () => {
    chrome.storage.local.set({ [STORAGE_KEYS.SERVER_URL]: serverUrlInput.value });
});

// Save password on change
serverPasswordInput.addEventListener('change', () => {
    chrome.storage.local.set({ [STORAGE_KEYS.SERVER_PASSWORD]: serverPasswordInput.value });
});

// ⚡ CONNECT HERE - Embed terminal in popup
// ⚡ CONNECT HERE - Embed terminal in popup
connectPopupBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim();
    if (!url) {
        showStatus('Please enter a server URL', 'error');
        return;
    }
    
    // Expand popup size
    document.body.classList.add('terminal-active');
    
    // Show terminal, hide command list
    terminalContainer.style.display = 'block';
    commandsSection.style.display = 'none';
    connectPopupBtn.style.display = 'none';
    openNewTabBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    
    // Initialize terminal if not already created
    if (!term) {
        term = new Terminal({
            cursorBlink: true,
            rows: 22,
            cols: 75,
            fontSize: 13,
            lineHeight: 1.0,
            letterSpacing: 0,
            fontFamily: '"Courier New", Courier, monospace',
            fontWeight: 'normal',
            fontWeightBold: 'bold',
            allowTransparency: false,
            theme: {
                background: '#000000',
                foreground: '#ffffff',
                cursor: '#ffffff',
                cursorAccent: '#000000',
                selection: 'rgba(255, 255, 255, 0.3)',
                black: '#000000',
                red: '#e06c75',
                green: '#98c379',
                yellow: '#d19a66',
                blue: '#61afef',
                magenta: '#c678dd',
                cyan: '#56b6c2',
                white: '#abb2bf',
                brightBlack: '#5c6370',
                brightRed: '#e06c75',
                brightGreen: '#98c379',
                brightYellow: '#d19a66',
                brightBlue: '#61afef',
                brightMagenta: '#c678dd',
                brightCyan: '#56b6c2',
                brightWhite: '#ffffff'
            },
            scrollback: 10000,
            tabStopWidth: 8,
            convertEol: false,
            screenReaderMode: false
        });
        
        term.open(document.getElementById('terminal'));
        
        // Force terminal to fit container
        setTimeout(() => {
            const termElement = document.getElementById('terminal');
            if (termElement && term) {
                term.resize(75, 22);
            }
        }, 100);
        
        // Handle keyboard input
        term.onData((data) => {
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(data);
            }
        });
    } else {
        // If terminal exists, just clear and reuse it
        term.clear();
        term.resize(75, 22);
    }
    
    // Connect to WebSocket server
    connectWebSocket(url);
    
    // Save URL
    chrome.storage.local.set({ [STORAGE_KEYS.SERVER_URL]: url });
});

// ⏹ DISCONNECT
disconnectBtn.addEventListener('click', () => {
    disconnect();
});

function disconnect() {
    if (socket) {
        socket.close();
        socket = null;
    }
    
    authPending = false;
    
    // Shrink popup back
    document.body.classList.remove('terminal-active');
    
    // Reset UI
    terminalContainer.style.display = 'none';
    commandsSection.style.display = 'block';
    connectPopupBtn.style.display = 'block';
    openNewTabBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
    
    showStatus('Disconnected', 'success');
}

// WebSocket Connection with Authentication
function connectWebSocket(url) {
    showStatus('Connecting...', 'success');
    authPending = true;
    
    // Check for WSS
    if (url.startsWith('wss://')) {
        term.write('\r\n\x1b[36m🔒 Using secure WebSocket (WSS/TLS)...\x1b[0m\r\n');
    }
    
    try {
        socket = new WebSocket(url);
        
        socket.onopen = () => {
            showStatus('Authenticating...', 'success');
            term.write('\x1b[33m🔌 Connected to server...\x1b[0m\r\n');
            
            // Send authentication token
            const password = serverPasswordInput.value.trim();
            if (password) {
                // Send as JSON
                socket.send(JSON.stringify({
                    type: 'auth',
                    token: password
                }));
                term.write('\x1b[33m🔐 Authenticating...\x1b[0m\r\n');
            } else {
                // Send empty auth (for servers without auth)
                socket.send(JSON.stringify({
                    type: 'auth',
                    token: ''
                }));
            }
        };
        
        socket.onmessage = (event) => {
            const data = event.data;
            
            // Try to parse as JSON (for auth responses)
            if (authPending) {
                try {
                    const msg = JSON.parse(data);
                    
                    if (msg.type === 'auth') {
                        if (msg.status === 'success') {
                            authPending = false;
                            showStatus('Connected!', 'success');
                            term.write('\x1b[32m✓ Authenticated successfully!\x1b[0m\r\n');
                            
                            if (msg.noAuth) {
                                term.write('\x1b[90m(Server has no authentication)\x1b[0m\r\n');
                            }
                            
                            term.write('\r\n');
                            
                            // Save credentials
                            chrome.storage.local.set({
                                [STORAGE_KEYS.SERVER_URL]: serverUrlInput.value,
                                [STORAGE_KEYS.SERVER_PASSWORD]: serverPasswordInput.value
                            });
                            
                            return;
                        } else if (msg.status === 'failed') {
                            authPending = false;
                            showStatus('Authentication failed!', 'error');
                            term.write('\r\n\x1b[31m✗ Authentication failed: ' + (msg.message || 'Invalid password') + '\x1b[0m\r\n');
                            
                            setTimeout(() => {
                                disconnect();
                            }, 2000);
                            return;
                        } else if (msg.status === 'timeout') {
                            authPending = false;
                            showStatus('Authentication timeout!', 'error');
                            term.write('\r\n\x1b[31m✗ Authentication timeout\x1b[0m\r\n');
                            return;
                        }
                    }
                } catch (e) {
                    // Not JSON, treat as normal output
                }
            }
            
            // Display server output
            term.write(data);
        };
        
        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            term.write('\r\n\x1b[31m✗ Connection error!\x1b[0m\r\n');
            showStatus('Connection failed', 'error');
            authPending = false;
        };
        
        socket.onclose = (event) => {
            authPending = false;
            const reason = event.reason || 'Unknown reason';
            
            if (event.code === 4001) {
                term.write('\r\n\x1b[31m✗ Authentication timeout\x1b[0m\r\n');
                showStatus('Authentication timeout', 'error');
            } else if (event.code === 4003) {
                term.write('\r\n\x1b[31m✗ Authentication failed\x1b[0m\r\n');
                showStatus('Authentication failed', 'error');
            } else if (event.code === 4005) {
                term.write('\r\n\x1b[31m✗ IP temporarily banned (too many failed attempts)\x1b[0m\r\n');
                showStatus('IP banned', 'error');
            } else {
                term.write('\r\n\x1b[33mConnection closed: ' + reason + '\x1b[0m\r\n');
                showStatus('Disconnected', 'error');
            }
        };
    } catch (error) {
        showStatus('Error: ' + error.message, 'error');
        authPending = false;
    }
}

// 🗗 Open in new tab
openNewTabBtn.addEventListener('click', () => {
    const url = serverUrlInput.value.trim();
    if (!url) {
        showStatus('Please enter a server URL', 'error');
        return;
    }
    
    chrome.storage.local.set({ 
        [STORAGE_KEYS.SERVER_URL]: url,
        [STORAGE_KEYS.SERVER_PASSWORD]: serverPasswordInput.value 
    }, () => {
        chrome.tabs.create({ url: 'terminal.html' });
    });
});

// Show add command modal
addCommandBtn.addEventListener('click', () => {
    editingCommandId = null;
    modalTitle.textContent = 'Add Command';
    commandAlias.value = '';
    commandText.value = '';
    commandModal.classList.add('active');
    commandAlias.focus();
});

// Cancel modal
cancelModal.addEventListener('click', () => {
    commandModal.classList.remove('active');
});

// Close modal on background click
commandModal.addEventListener('click', (e) => {
    if (e.target === commandModal) {
        commandModal.classList.remove('active');
    }
});

// Save command
saveCommand.addEventListener('click', () => {
    const alias = commandAlias.value.trim();
    const cmd = commandText.value.trim();
    
    if (!alias || !cmd) {
        alert('Please fill in both fields');
        return;
    }
    
    chrome.storage.local.get([STORAGE_KEYS.COMMANDS], (result) => {
        let commands = result[STORAGE_KEYS.COMMANDS] || [];
        
        if (editingCommandId !== null) {
            // Edit existing
            commands[editingCommandId] = { alias, command: cmd };
        } else {
            // Add new
            commands.push({ alias, command: cmd, id: Date.now() });
        }
        
        chrome.storage.local.set({ [STORAGE_KEYS.COMMANDS]: commands }, () => {
            renderCommands(commands);
            commandModal.classList.remove('active');
            showStatus(editingCommandId !== null ? 'Command updated' : 'Command added', 'success');
        });
    });
});

// Render commands list
function renderCommands(commands) {
    if (!commands || commands.length === 0) {
        commandsList.innerHTML = `
            <div class="empty-state">
                No commands saved yet.<br>Click "+ Add" to create one.
            </div>
        `;
        return;
    }
    
    commandsList.innerHTML = commands.map((cmd, index) => `
        <div class="command-item">
            <div class="command-info" data-index="${index}">
                <div class="command-alias">${escapeHtml(cmd.alias)}</div>
                <div class="command-text">${escapeHtml(cmd.command)}</div>
            </div>
            <div class="command-actions">
                <button class="icon-btn edit-btn" data-index="${index}">✏️</button>
                <button class="icon-btn delete-btn" data-index="${index}">🗑️</button>
            </div>
        </div>
    `).join('');
    
    // Add event listeners
    commandsList.querySelectorAll('.command-info').forEach(el => {
        el.addEventListener('click', executeCommand);
    });
    
    commandsList.querySelectorAll('.edit-btn').forEach(el => {
        el.addEventListener('click', editCommand);
    });
    
    commandsList.querySelectorAll('.delete-btn').forEach(el => {
        el.addEventListener('click', deleteCommand);
    });
}

// Execute command
function executeCommand(e) {
    const index = e.currentTarget.dataset.index;
    chrome.storage.local.get([STORAGE_KEYS.COMMANDS, STORAGE_KEYS.SERVER_URL], (result) => {
        const command = result[STORAGE_KEYS.COMMANDS][index];
        const serverUrl = result[STORAGE_KEYS.SERVER_URL];
        
        if (!serverUrl) {
            showStatus('Please set server URL first', 'error');
            return;
        }
        
        // If terminal is connected in popup, execute here
        if (socket && socket.readyState === WebSocket.OPEN && term) {
            term.write('\r\n\x1b[36m$ ' + command.command + '\x1b[0m\r\n');
            socket.send(command.command + '\r');
            showStatus('Command executed!', 'success');
            return;
        }
        
        // Otherwise check if terminal tab exists
        chrome.tabs.query({ url: chrome.runtime.getURL('terminal.html') }, (tabs) => {
            if (tabs.length > 0) {
                // Send to existing terminal
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'executeCommand',
                    command: command.command
                });
                chrome.tabs.update(tabs[0].id, { active: true });
                showStatus('Command sent to tab!', 'success');
            } else {
                // Open new tab with pending command
                chrome.storage.local.set({ pendingCommand: command.command }, () => {
                    chrome.tabs.create({ url: 'terminal.html' });
                });
            }
        });
    });
}

// Edit command
function editCommand(e) {
    e.stopPropagation();
    const index = parseInt(e.currentTarget.dataset.index);
    
    chrome.storage.local.get([STORAGE_KEYS.COMMANDS], (result) => {
        const command = result[STORAGE_KEYS.COMMANDS][index];
        editingCommandId = index;
        modalTitle.textContent = 'Edit Command';
        commandAlias.value = command.alias;
        commandText.value = command.command;
        commandModal.classList.add('active');
        commandAlias.focus();
    });
}

// Delete command
function deleteCommand(e) {
    e.stopPropagation();
    const index = parseInt(e.currentTarget.dataset.index);
    
    if (!confirm('Delete this command?')) return;
    
    chrome.storage.local.get([STORAGE_KEYS.COMMANDS], (result) => {
        const commands = result[STORAGE_KEYS.COMMANDS];
        commands.splice(index, 1);
        
        chrome.storage.local.set({ [STORAGE_KEYS.COMMANDS]: commands }, () => {
            renderCommands(commands);
            showStatus('Command deleted', 'success');
        });
    });
}

// Show status message
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type} show`;
    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 3000);
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Clean up on popup close
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
});