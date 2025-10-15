// terminal.js - Complete terminal tab logic with search and WSS support
// FILENAME: terminal.js

// Storage keys
const STORAGE_KEYS = {
    SERVER_URL: 'terminalServerUrl',
    SERVER_PASSWORD: 'terminalServerPassword',
    COMMANDS: 'terminalCommands'
};

// Elements  
const terminal = document.getElementById('terminal');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const reconnectBtn = document.getElementById('reconnectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const settingsBtn = document.getElementById('settingsBtn');
const searchBtn = document.getElementById('searchBtn');
const settingsModal = document.getElementById('settingsModal');
const searchModal = document.getElementById('searchModal');
const settingsServerUrl = document.getElementById('settingsServerUrl');
const settingsServerPassword = document.getElementById('settingsServerPassword');
const cancelSettings = document.getElementById('cancelSettings');
const saveSettings = document.getElementById('saveSettings');
const commandsSidebar = document.getElementById('commandsSidebar');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const sidebarCommands = document.getElementById('sidebarCommands');
const commandSearch = document.getElementById('commandSearch');

// Search elements
const terminalSearchTab = document.getElementById('terminalSearchTab');
const fileSearchTab = document.getElementById('fileSearchTab');
const terminalSearchPanel = document.getElementById('terminalSearchPanel');
const fileSearchPanel = document.getElementById('fileSearchPanel');
const terminalSearchInput = document.getElementById('terminalSearchInput');
const terminalCaseSensitive = document.getElementById('terminalCaseSensitive');
const terminalRegex = document.getElementById('terminalRegex');
const searchTerminalBtn = document.getElementById('searchTerminalBtn');
const clearTerminalSearchBtn = document.getElementById('clearTerminalSearchBtn');
const terminalSearchResults = document.getElementById('terminalSearchResults');
const fileSearchText = document.getElementById('fileSearchText');
const fileSearchPath = document.getElementById('fileSearchPath');
const fileSearchPattern = document.getElementById('fileSearchPattern');
const fileSearchRecursive = document.getElementById('fileSearchRecursive');
const fileSearchCaseSensitive = document.getElementById('fileSearchCaseSensitive');
const executeFileSearchBtn = document.getElementById('executeFileSearchBtn');
const cancelSearchBtn = document.getElementById('cancelSearchBtn');
const fileSearchResults = document.getElementById('fileSearchResults');

// State
let socket = null;
let term = null;
let serverUrl = '';
let serverPassword = '';
let commands = [];
let isConnected = false;
let authPending = false;
let terminalBuffer = ''; // Store all terminal output for searching

// Initialize terminal
function initTerminal() {
    term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
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
        allowTransparency: false,
        rows: 30,
        cols: 100
    });

    term.open(terminal);
    
    // Handle terminal input
    let inputBuffer = '';
    
    term.onData((data) => {
        if (socket && socket.readyState === WebSocket.OPEN && !authPending) {
            // Normal mode - connected and authenticated
            socket.send(data);
        } else {
            // Not connected or waiting for auth - handle special commands
            const charCode = data.charCodeAt(0);
            
            if (charCode === 13) { // Enter key
                const command = inputBuffer.trim();
                term.write('\r\n');
                
                // Check for /auth command
                if (command.startsWith('/auth ')) {
                    const password = command.substring(6).trim();
                    
                    if (serverUrl && password) {
                        serverPassword = password;
                        chrome.storage.local.set({ [STORAGE_KEYS.SERVER_PASSWORD]: password });
                        term.write('\x1b[33m🔐 Reconnecting with new password...\x1b[0m\r\n');
                        connect(serverUrl, password);
                    } else if (!serverUrl) {
                        term.write('\x1b[31m✗ No server URL configured. Use Settings first.\x1b[0m\r\n');
                    } else {
                        term.write('\x1b[31m✗ Usage: /auth <password>\x1b[0m\r\n');
                    }
                } else if (command.length > 0) {
                    term.write('\x1b[90m(Not connected. Type /auth <password> to authenticate)\x1b[0m\r\n');
                }
                
                inputBuffer = '';
            } else if (charCode === 127 || charCode === 8) { // Backspace
                if (inputBuffer.length > 0) {
                    inputBuffer = inputBuffer.slice(0, -1);
                    term.write('\b \b'); // Erase character from screen
                }
            } else if (charCode >= 32 && charCode < 127) { // Printable characters
                inputBuffer += data;
                term.write(data); // Echo to screen
            }
        }
    });

    // Handle terminal resize
    window.addEventListener('resize', () => {
        fitTerminal();
    });

    fitTerminal();
}

// Fit terminal to container
function fitTerminal() {
    const container = terminal;
    const rect = container.getBoundingClientRect();
    const cols = Math.floor((rect.width - 20) / 9);
    const rows = Math.floor((rect.height - 20) / 17);
    term.resize(cols, rows);
}

// Update connection status
function updateStatus(status) {
    statusIndicator.className = `status-indicator ${status}`;
    
    switch(status) {
        case 'connected':
            statusText.textContent = 'Connected';
            isConnected = true;
            reconnectBtn.style.display = 'none';
            disconnectBtn.style.display = 'flex';
            break;
        case 'connecting':
            statusText.textContent = 'Connecting...';
            isConnected = false;
            reconnectBtn.style.display = 'none';
            disconnectBtn.style.display = 'none';
            break;
        case 'disconnected':
            statusText.textContent = 'Disconnected';
            isConnected = false;
            reconnectBtn.style.display = 'flex';
            disconnectBtn.style.display = 'none';
            break;
    }
}

// Connect to WebSocket
function connect(url, password = '') {
    if (socket) {
        socket.close();
    }

    updateStatus('connecting');
    authPending = true;
    term.write('\r\n\x1b[33mConnecting to ' + url + '...\x1b[0m\r\n');

    // Check for WSS
    if (url.startsWith('wss://')) {
        term.write('\x1b[36m🔒 Using secure WebSocket (WSS/TLS)\x1b[0m\r\n');
    }

    try {
        socket = new WebSocket(url);

        socket.onopen = () => {
            term.write('\x1b[33m🔌 Connected to server...\x1b[0m\r\n');
            
            // Send authentication
            if (password) {
                socket.send(JSON.stringify({
                    type: 'auth',
                    token: password
                }));
                term.write('\x1b[33m🔐 Authenticating...\x1b[0m\r\n');
            } else {
                // Try empty auth
                socket.send(JSON.stringify({
                    type: 'auth',
                    token: ''
                }));
                term.write('\x1b[90m(No password provided)\x1b[0m\r\n');
            }
        };

        socket.onmessage = (event) => {
            const data = event.data;
            
            // Store in buffer for searching
            terminalBuffer += data;
            
            // Keep buffer size manageable (last 100KB)
            if (terminalBuffer.length > 100000) {
                terminalBuffer = terminalBuffer.slice(-100000);
            }
            
            // Handle authentication response
            if (authPending) {
                try {
                    const msg = JSON.parse(data);
                    
                    if (msg.type === 'auth') {
                        if (msg.status === 'success') {
                            authPending = false;
                            updateStatus('connected');
                            term.write('\r\n\x1b[32m✓ Authenticated successfully!\x1b[0m\r\n');
                            
                            if (msg.noAuth) {
                                term.write('\x1b[90m(Server has no authentication)\x1b[0m\r\n');
                            }
                            
                            term.write('\r\n');
                            
                            // Check for pending command
                            chrome.storage.local.get(['pendingCommand'], (result) => {
                                if (result.pendingCommand) {
                                    setTimeout(() => {
                                        executeCommand(result.pendingCommand);
                                        chrome.storage.local.remove('pendingCommand');
                                    }, 500);
                                }
                            });
                            
                            return;
                        } else if (msg.status === 'failed') {
                            authPending = false;
                            updateStatus('disconnected');
                            term.write('\r\n\x1b[31m✗ Authentication failed: ' + (msg.message || 'Invalid password') + '\x1b[0m\r\n');
                            term.write('\x1b[33m💡 Tip: Enter "/auth <password>" to try again\x1b[0m\r\n');
                            return;
                        } else if (msg.status === 'timeout') {
                            authPending = false;
                            updateStatus('disconnected');
                            term.write('\r\n\x1b[31m✗ Authentication timeout\x1b[0m\r\n');
                            return;
                        }
                    }
                } catch (e) {
                    // Not JSON, treat as normal output
                }
            }
            
            term.write(data);
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            term.write('\r\n\x1b[31m✗ Connection failed. Check server and try again.\x1b[0m\r\n');
            updateStatus('disconnected');
            authPending = false;
        };

        socket.onclose = (event) => {
            authPending = false;
            const reason = event.reason || 'Unknown reason';
            
            if (event.code === 4001) {
                term.write('\r\n\x1b[31m✗ Authentication timeout\x1b[0m\r\n');
            } else if (event.code === 4003) {
                term.write('\r\n\x1b[31m✗ Authentication failed\x1b[0m\r\n');
            } else if (event.code === 4005) {
                term.write('\r\n\x1b[31m✗ IP temporarily banned (too many failed attempts)\x1b[0m\r\n');
            } else {
                term.write('\r\n\x1b[33mConnection closed: ' + reason + '\x1b[0m\r\n');
            }
            
            term.write('\x1b[33m💡 Tip: Use Settings to reconnect with password\x1b[0m\r\n');
            updateStatus('disconnected');
        };
    } catch (error) {
        term.write('\r\n\x1b[31m✗ Error: ' + error.message + '\x1b[0m\r\n');
        updateStatus('disconnected');
        authPending = false;
    }
}

// Disconnect
function disconnect() {
    if (socket) {
        socket.close();
        socket = null;
    }
    updateStatus('disconnected');
}

// Execute command
function executeCommand(cmd) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        term.write('\r\n\x1b[31m✗ Not connected!\x1b[0m\r\n');
        return;
    }

    term.write('\r\n\x1b[36m$ ' + cmd + '\x1b[0m\r\n');
    socket.send(cmd + '\r');
}

// Load commands from storage
function loadCommands() {
    chrome.storage.local.get([STORAGE_KEYS.COMMANDS], (result) => {
        commands = result[STORAGE_KEYS.COMMANDS] || [];
        renderSidebarCommands(commands);
    });
}

// Render sidebar commands
function renderSidebarCommands(commandList) {
    if (!commandList || commandList.length === 0) {
        sidebarCommands.innerHTML = `
            <div style="color: #aaa; text-align: center; padding: 40px 20px;">
                No commands available.<br>Add some from the extension popup!
            </div>
        `;
        return;
    }

    sidebarCommands.innerHTML = commandList.map((cmd, index) => `
        <div class="sidebar-command-item" data-index="${index}">
            <div class="sidebar-command-alias">${escapeHtml(cmd.alias)}</div>
            <div class="sidebar-command-text">${escapeHtml(cmd.command)}</div>
        </div>
    `).join('');

    // Add click handlers
    sidebarCommands.querySelectorAll('.sidebar-command-item').forEach(el => {
        el.addEventListener('click', () => {
            const index = el.dataset.index;
            const cmd = commands[index];
            executeCommand(cmd.command);
        });
    });
}

// Search commands
commandSearch.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        renderSidebarCommands(commands);
        return;
    }

    const filtered = commands.filter(cmd => 
        cmd.alias.toLowerCase().includes(query) || 
        cmd.command.toLowerCase().includes(query)
    );
    
    renderSidebarCommands(filtered);
});

// Toggle sidebar
toggleSidebarBtn.addEventListener('click', () => {
    commandsSidebar.classList.toggle('open');
});

// Close sidebar when clicking outside
document.addEventListener('click', (e) => {
    if (!commandsSidebar.contains(e.target) && 
        e.target !== toggleSidebarBtn && 
        commandsSidebar.classList.contains('open')) {
        commandsSidebar.classList.remove('open');
    }
});

// Settings button
settingsBtn.addEventListener('click', () => {
    settingsServerUrl.value = serverUrl;
    settingsServerPassword.value = serverPassword;
    settingsModal.classList.add('active');
    settingsServerUrl.focus();
});

// Cancel settings
cancelSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

// Save settings
saveSettings.addEventListener('click', () => {
    const url = settingsServerUrl.value.trim();
    const password = settingsServerPassword.value.trim();
    
    if (!url) {
        alert('Please enter a server URL');
        return;
    }

    if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
        alert('URL must start with ws:// or wss://');
        return;
    }

    serverUrl = url;
    serverPassword = password;
    
    chrome.storage.local.set({ 
        [STORAGE_KEYS.SERVER_URL]: url,
        [STORAGE_KEYS.SERVER_PASSWORD]: password
    }, () => {
        settingsModal.classList.remove('active');
        disconnect();
        setTimeout(() => connect(url, password), 300);
    });
});

// Close modal on background click
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
        searchModal.classList.remove('active');
    }
});

// Search button
searchBtn.addEventListener('click', () => {
    searchModal.classList.add('active');
    terminalSearchInput.focus();
});

// Search tabs
terminalSearchTab.addEventListener('click', () => {
    terminalSearchTab.classList.add('active');
    fileSearchTab.classList.remove('active');
    terminalSearchPanel.style.display = 'block';
    fileSearchPanel.style.display = 'none';
});

fileSearchTab.addEventListener('click', () => {
    fileSearchTab.classList.add('active');
    terminalSearchTab.classList.remove('active');
    fileSearchPanel.style.display = 'block';
    terminalSearchPanel.style.display = 'none';
});

// Terminal search - COMPLETE FIXED VERSION
searchTerminalBtn.addEventListener('click', () => {
    const query = terminalSearchInput.value;
    if (!query) {
        alert('Please enter search text');
        return;
    }

    const caseSensitive = terminalCaseSensitive.checked;
    const useRegex = terminalRegex.checked;

    try {
        let results = [];
        let searchText = terminalBuffer;
        
        // Split into lines for line numbers
        const lines = searchText.split(/\r?\n/);

        if (useRegex) {
            const flags = caseSensitive ? 'g' : 'gi';
            const regex = new RegExp(query, flags);
            
            lines.forEach((line, lineNum) => {
                if (regex.test(line)) {
                    const highlightedLine = line.replace(regex, (match) => {
                        return `<span class="search-highlight">${match}</span>`;
                    });
                    results.push({
                        lineNum: lineNum + 1,
                        content: highlightedLine,
                        originalLine: line
                    });
                }
            });
        } else {
            const searchFor = caseSensitive ? query : query.toLowerCase();
            
            lines.forEach((line, lineNum) => {
                const searchIn = caseSensitive ? line : line.toLowerCase();
                if (searchIn.includes(searchFor)) {
                    let highlightedLine = line;
                    if (!caseSensitive) {
                        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                        highlightedLine = line.replace(regex, (match) => {
                            return `<span class="search-highlight">${match}</span>`;
                        });
                    } else {
                        highlightedLine = line.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), (match) => {
                            return `<span class="search-highlight">${match}</span>`;
                        });
                    }
                    
                    results.push({
                        lineNum: lineNum + 1,
                        content: highlightedLine,
                        originalLine: line
                    });
                }
                
                if (results.length >= 100) return;
            });
        }

        terminalSearchResults.style.display = 'block';
        const resultsDiv = terminalSearchResults.querySelector('div');
        
        if (results.length > 0) {
            let html = `<strong>Found ${results.length} match(es):</strong><br><br>`;
            
            results.forEach((result, idx) => {
                html += `
                    <div class="search-result-item" data-line="${result.lineNum}" style="margin-bottom: 10px; padding: 8px; background: #2d2d2d; border-radius: 4px; cursor: pointer; transition: all 0.3s;">
                        <div style="color: #667eea; font-size: 11px; margin-bottom: 4px;">
                            📍 Line ${result.lineNum} - <span style="color: #98c379;">Click to jump</span>
                        </div>
                        <div style="font-family: 'Courier New', monospace; font-size: 11px; color: #fff;">
                            ${result.content}
                        </div>
                    </div>
                `;
            });
            
            resultsDiv.innerHTML = html;
            
            // Add click listeners to all result items
            resultsDiv.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('mouseenter', function() {
                    this.style.background = '#3d3d3d';
                });
                item.addEventListener('mouseleave', function() {
                    this.style.background = '#2d2d2d';
                });
                item.addEventListener('click', function() {
                    const lineNum = parseInt(this.dataset.line);
                    jumpToSearchResult(lineNum);
                });
            });
        } else {
            resultsDiv.innerHTML = '<em>No matches found</em>';
        }
    } catch (error) {
        alert('Search error: ' + error.message);
    }
});

clearTerminalSearchBtn.addEventListener('click', () => {
    terminalSearchInput.value = '';
    terminalSearchResults.style.display = 'none';
});

// Jump to search result function
// Jump to search result function - KEEP OLD OUTPUT
function jumpToSearchResult(lineNum) {
    // Don't clear! Keep the old output
    // term.clear(); // REMOVED
    
    // Instead, write a separator and show the context
    const lines = terminalBuffer.split(/\r?\n/);
    const startLine = Math.max(0, lineNum - 10);
    const endLine = Math.min(lines.length, lineNum + 10);
    
    // Add visual separator
    term.write('\r\n\r\n');
    term.write('\x1b[36m╔════════════════════════════════════════════╗\x1b[0m\r\n');
    term.write('\x1b[36m║     SEARCH RESULT - Jump to Line ' + lineNum + '         ║\x1b[0m\r\n');
    term.write('\x1b[36m╚════════════════════════════════════════════╝\x1b[0m\r\n\r\n');
    
    // Show context around the match
    for (let i = startLine; i < endLine; i++) {
        if (i === lineNum - 1) {
            // Highlight the matching line with yellow background
            term.write('\x1b[43m\x1b[30m>>> ' + lines[i] + '\x1b[0m\r\n');
        } else {
            // Show line numbers for context
            term.write('\x1b[90m' + (i + 1).toString().padStart(4, ' ') + ':\x1b[0m ' + lines[i] + '\r\n');
        }
    }
    
    term.write('\r\n\x1b[36m═══════════════════════════════════════════\x1b[0m\r\n');
    term.write('\x1b[33m💡 Showing 10 lines before and after match\x1b[0m\r\n');
    term.write('\x1b[90mPress Ctrl+L to clear and return to prompt\x1b[0m\r\n');
    
    // Close search modal
    searchModal.classList.remove('active');
}

clearTerminalSearchBtn.addEventListener('click', () => {
    terminalSearchInput.value = '';
    terminalSearchResults.style.display = 'none';
});

// File search
executeFileSearchBtn.addEventListener('click', () => {
    const searchText = fileSearchText.value.trim();
    if (!searchText) {
        alert('Please enter text to search');
        return;
    }

    if (!socket || socket.readyState !== WebSocket.OPEN || !isConnected) {
        alert('Not connected to server');
        return;
    }

    const searchPath = fileSearchPath.value.trim() || '.';
    const pattern = fileSearchPattern.value.trim() || '*';
    const recursive = fileSearchRecursive.checked;
    const caseSensitive = fileSearchCaseSensitive.checked;

    // Build grep command
    let grepFlags = 'n'; // Line numbers
    if (recursive) grepFlags += 'r';
    if (!caseSensitive) grepFlags += 'i';

    let command;
    if (pattern === '*') {
        // Search all files
        command = `grep -${grepFlags} "${searchText}" ${searchPath} 2>/dev/null | head -100`;
    } else {
        // Search specific pattern
        command = `find ${searchPath} -name "${pattern}" -type f -exec grep -${grepFlags} "${searchText}" {} + 2>/dev/null | head -100`;
    }

    // Execute search
    fileSearchResults.style.display = 'block';
    const resultsDiv = fileSearchResults.querySelector('div');
    resultsDiv.innerHTML = '<em>Searching...</em>';

    // Send command
    term.write('\r\n\x1b[36m$ ' + command + '\x1b[0m\r\n');
    socket.send(command + '\r');

    // Note: Results will appear in terminal
    setTimeout(() => {
        resultsDiv.innerHTML = '<em>✓ Search command executed. Check terminal output below.</em>';
    }, 500);
});

cancelSearchBtn.addEventListener('click', () => {
    searchModal.classList.remove('active');
});

// Reconnect button
reconnectBtn.addEventListener('click', () => {
    if (serverUrl) {
        connect(serverUrl, serverPassword);
    } else {
        settingsBtn.click();
    }
});

// Disconnect button
disconnectBtn.addEventListener('click', () => {
    disconnect();
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'executeCommand') {
        executeCommand(request.command);
        sendResponse({ success: true });
    }
    return true;
});

// Listen for storage changes (when commands are updated)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes[STORAGE_KEYS.COMMANDS]) {
        loadCommands();
    }
});

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    initTerminal();
    
    // Load saved settings
    chrome.storage.local.get([STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.SERVER_PASSWORD], (result) => {
        serverUrl = result[STORAGE_KEYS.SERVER_URL] || '';
        serverPassword = result[STORAGE_KEYS.SERVER_PASSWORD] || '';
        
        if (serverUrl) {
            connect(serverUrl, serverPassword);
        } else {
            term.write('\x1b[33mWelcome to Remote Terminal!\x1b[0m\r\n');
            term.write('\x1b[90mClick the Settings button to configure your connection.\x1b[0m\r\n\r\n');
            updateStatus('disconnected');
        }
    });

    // Load commands
    loadCommands();
});

// Clean up on unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.close();
    }
});