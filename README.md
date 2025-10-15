# 🔐 SecureShell Pro - Chrome Extension

> **Professional Remote Terminal with Advanced Search, Authentication & Encryption**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](https://github.com/yourusername/secureshell-pro)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)

A powerful, feature-rich Chrome extension that provides secure remote terminal access with professional-grade features tailored for penetration testers, system administrators, and security professionals.

<p align="center">
  <img src="./extension/icons/icon.svg" alt="logo" width="128">
</p>


---

## 🎯 Why SecureShell Pro?

### For Penetration Testers & Security Professionals

**Quick Access During Engagements**
- Access your attack box from anywhere without switching contexts
- Execute commands while documenting findings in browser
- Search through command history instantly during assessments
- Save and replay common pentesting commands with one click

**Operational Security**
- Encrypted connections (TLS/WSS support)
- Strong password enforcement (15+ chars with complexity)
- IP-based rate limiting and automatic banning
- Complete audit logging of all commands and connections
- Session tracking with unique IDs

**Productivity Boosters**
- Terminal search with regex support - find that command you ran 2 hours ago
- Quick commands library - save your favorite exploit commands
- File/folder search - locate configuration files instantly
- Multi-tab support - manage multiple shells simultaneously
- No desktop switching required - everything in browser

### Real-World Use Cases

**🎯 Penetration Testing**
```bash
# Save common commands:
- Nmap scans: nmap -sV -sC -oA scan target.com
- Enum scripts: ./linpeas.sh | tee output.txt
- Quick reverseshells: nc -lvnp 4444

# Search terminal history during post-exploitation
# Find that password you extracted 30 minutes ago
# Quickly reference command outputs without scrolling
```

**🔧 System Administration**
- Monitor production servers from browser
- Quick troubleshooting without SSH client
- Execute maintenance scripts
- Check logs and system status

**🏫 Learning & CTFs**
- Practice on remote labs
- Maintain persistent connection to challenge boxes
- Document and replay solutions
- Search through outputs for flags

**💼 Remote Work**
- Access home lab from anywhere
- Manage cloud instances
- Execute automated tasks
- Monitor services

---

## ✨ Features

### 🔒 Security Features
- **TLS/WSS Encryption** - Secure WebSocket connections with SSL/TLS
- **Strong Authentication** - Password complexity enforcement (15+ chars, mixed case, numbers, special chars)
- **Rate Limiting** - Automatic IP banning after 5 failed attempts (5-minute cooldown)
- **Session Tracking** - Unique session IDs for audit trails
- **Complete Logging** - Every command, keystroke, and connection logged
- **Timeout Protection** - 10-second authentication timeout

### 🔍 Advanced Search
- **Terminal Output Search** - Search through your entire session history
  - Case-sensitive and case-insensitive modes
  - Regular expression support
  - Context highlighting
  - Click to jump to specific lines
  - Keeps original output intact
- **File/Folder Search** - Find files across the filesystem
  - Recursive search
  - File pattern matching (*.log, *.conf, etc.)
  - Path specification
  - Results display in terminal

### 💾 Command Management
- **Quick Commands Library** - Save frequently used commands with aliases
  - Add, edit, delete commands
  - One-click execution
  - Search through saved commands
  - Sync across popup and full tab
  - Perfect for pentesting workflows

### 🎨 User Interface
- **Dual Mode Operation**
  - Popup mode - Quick access from toolbar
  - Full tab mode - Dedicated terminal window
- **Modern Design** - Beautiful gradient UI with smooth animations
- **Command Sidebar** - Quick access to saved commands
- **Status Indicators** - Real-time connection status
- **Dark Theme** - Easy on the eyes during long sessions

### 🔄 Convenience Features
- **In-Terminal Authentication** - `/auth <password>` command for quick re-authentication
- **Password Visibility Toggle** - Show/hide password field
- **Auto-reconnect** - Easy reconnection with saved credentials
- **Multiple Tabs** - Open multiple terminal sessions
- **Persistent Storage** - Saves server URL and credentials locally

---

## 📦 What's Included

### Repository Structure
```
SecureShell-Pro/
├── extension/              # Chrome Extension Files
│   ├── manifest.json       # Extension configuration
│   ├── popup.html          # Popup interface
│   ├── popup.js            # Popup logic
│   ├── terminal.html       # Full tab terminal
│   ├── terminal.js         # Terminal logic with search
│   ├── icons/              # Extension icons
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── lib/                # Third-party libraries
│       ├── xterm.js        # Terminal emulator
│       └── xterm.css       # Terminal styles
│
├── server/                 # WebSocket Server
│   ├── server.js           # Main server file
│   ├── package.json        # Node.js dependencies
│   └── logs/               # Auto-generated logs
│
├── LICENSE                 # MIT License
└── README.md              # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** 14.x or higher
- **Chrome Browser** (or Chromium-based)
- **Basic terminal knowledge**

### Step 1: Clone Repository

```bash
git clone https://github.com/B4l3rI0n/SecureShell-Pro.git
cd secureshell-pro
```

### Step 2: Setup Server

```bash
cd server
npm install

# Generate SSL certificate (for secure WSS connection)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes \
  -subj "/CN=YOUR_IP_OR_DOMAIN" \
  -addext "subjectAltName=IP:YOUR_IP,DNS:localhost"

# Start server with authentication
node server.js --password "YourSecurePass123!@#" --cert cert.pem --key key.pem
```

**Server will output:**
```
🔒 TLS ENABLED - Using cert: cert.pem, key: key.pem
🚀 WSS WebSocket Terminal Server running on wss://0.0.0.0:6060
📡 Waiting for connections...
📝 Logging to: /path/to/logs/terminal-2025-01-15T12-00-00.log
🔒 Authentication ENABLED - Token required
🔑 Token: Your**********************
```

### Step 3: Install Extension

1. **Load in Chrome:**
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode" (top-right toggle)
   - Click "Load unpacked"
   - Select the `extension/` folder
   - Extension icon appears in toolbar

2. **Trust SSL Certificate (for WSS):**
   - Open `https://YOUR_IP:6060` in Chrome
   - Click "Advanced" → "Proceed to YOUR_IP (unsafe)"
   - Now WSS connection will work

### Step 4: Connect

1. Click SecureShell Pro icon in Chrome toolbar
2. Enter server URL: `wss://YOUR_IP:6060`
3. Enter password: `YourSecurePass123!@#`
4. Click "Connect Here" or "Open in Tab"
5. ✅ You're connected!

---

## 📖 Detailed Usage

### Server Configuration

#### Command Line Options
```bash
node server.js [options]

Options:
  -p, --password <token>   Authentication token (min 15 chars with complexity)
  -l, --logfile <file>     Custom log file path
  -n, --no-log             Disable file logging
  --port <port>            Server port (default: 6060)
  -c, --cert <file>        SSL certificate path (for WSS)
  -k, --key <file>         SSL private key path (for WSS)
  -h, --help               Show help
```

#### Example Configurations

**Development (No TLS):**
```bash
node server.js --password "DevPassword123!@#"
```

**Production (With TLS):**
```bash
node server.js \
  --password 'ProductionPass123!@#Secure' \
  --cert /etc/letsencrypt/live/domain.com/fullchain.pem \
  --key /etc/letsencrypt/live/domain.com/privkey.pem \
  --port 443
```

**Custom Logging:**
```bash
node server.js \
  --password "MyPass123!@#" \
  --logfile /var/log/secureshell.log \
  --port 8080
```

### Extension Usage

#### Popup Mode (Quick Access)
1. Click extension icon
2. Terminal opens in 680x550 popup
3. Perfect for quick commands

#### Full Tab Mode (Extended Sessions)
1. Click "Open in Tab"
2. Dedicated terminal window
3. Full screen experience
4. Stays open in background

#### Search Terminal Output
1. Click 🔍 Search button
2. "Terminal Output" tab
3. Enter search query
4. Check options:
   - ☑️ Case Sensitive
   - ☑️ Regular Expression
5. Click results to jump to line

**Example Searches:**
```
Simple: error
Regex: \b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b  (find IPs)
Regex: (ERROR|WARN|FAIL):\s*\d+                (error codes)
```

#### Search Files/Folders
1. Click 🔍 Search → "Files & Folders"
2. Enter search text (required)
3. Enter path: `/var/log` (optional)
4. Enter pattern: `*.log` (optional)
5. Check options:
   - ☑️ Recursive (search subdirectories)
   - ☑️ Case Sensitive
6. Results appear in terminal

**Example Searches:**
```
Find configs:
  Text: "port"
  Path: /etc
  Pattern: *.conf

Find passwords in files:
  Text: "password"
  Path: /home/user
  Pattern: *.txt

Find all shell scripts:
  Text: "#!/bin/bash"
  Path: /opt
  Pattern: *.sh
```

#### Save Commands
1. Click "+ Add" in popup
2. Enter alias: "Port Scan"
3. Enter command: `nmap -sV -p- target.com`
4. Click Save
5. Click command anytime to execute

**Pentesting Command Examples:**
```
Alias: Quick Enum
Command: sudo nmap -sV -sC -oA ./nmap $IP

Alias: Web Enum
Command: gobuster dir -u http://$IP -w /usr/share/wordlists/seclists/Discovery/Web-Content/common.txt

Alias: Reverse Shell
Command: nc -nlvp 4444

Alias: Check Shells
Command: ps aux | grep -E "(sh|bash)"

Alias: LinPEAS
Command: curl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh
```

#### In-Terminal Authentication
If authentication fails or session expires:
```bash
/auth NewPassword123!@#
```
Reconnects with new password without going to settings.

---

## 🔧 Advanced Configuration

### Run Server as System Service (Linux)

Create `/etc/systemd/system/secureshell.service`:
```ini
[Unit]
Description=SecureShell Pro WebSocket Server
After=network.target

[Service]
Type=simple
User=secureshell
WorkingDirectory=/opt/secureshell-pro/server
Environment="WS_TERM_TOKEN=YourSecurePassword123!@#"
ExecStart=/usr/bin/node server.js --cert /path/to/cert.pem --key /path/to/key.pem
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable secureshell
sudo systemctl start secureshell
sudo systemctl status secureshell
```

### Firewall Configuration

```bash
# Allow specific IP range
sudo ufw allow from 192.168.1.0/24 to any port 6060

# Or allow all (not recommended for production)
sudo ufw allow 6060/tcp
```

### Use Let's Encrypt (Production)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d terminal.yourdomain.com

# Start server with Let's Encrypt cert
node server.js \
  --password "SecurePass123!@#" \
  --cert /etc/letsencrypt/live/terminal.yourdomain.com/fullchain.pem \
  --key /etc/letsencrypt/live/terminal.yourdomain.com/privkey.pem \
  --port 443
```

### Reverse Proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name terminal.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/terminal.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/terminal.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:6060;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🛡️ Security Considerations

### ⚠️ Important Warnings

- **NEVER expose to internet without TLS** - Always use WSS (secure WebSocket)
- **Use strong passwords** - Minimum 15 characters with complexity
- **Monitor logs** - Check for unauthorized access attempts
- **Restrict IPs** - Use firewall rules to limit access
- **Regular updates** - Keep Node.js and dependencies updated

### Best Practices

1. **Always use WSS** in production
2. **Strong passwords** - Use password manager to generate
3. **Firewall rules** - Whitelist known IPs only
4. **Monitor logs** - Watch for failed auth attempts
5. **Regular backups** - Backup logs for forensics
6. **Non-root user** - Run server as dedicated user
7. **Rate limiting** - Enabled by default (5 attempts)
8. **Session timeout** - 10-second auth window

### Audit Logs

All actions are logged:
```
2025-01-15T14:30:00.123Z INFO [a3f2] Client connected from 192.168.1.100
2025-01-15T14:30:00.456Z AUTH [a3f2] SUCCESS
2025-01-15T14:30:05.789Z CMD [a3f2] sudo nmap -sV target.com
2025-01-15T14:35:00.012Z INFO [a3f2] Disconnected code=1000
```

---

## 📸 Screenshots

### Popup Mode
<img width="499" height="738" alt="image" src="https://github.com/user-attachments/assets/2cd5abde-c36a-4a32-bed1-90dae2002b1b" />

### Full Tab Terminal
<img width="1920" height="927" alt="image" src="https://github.com/user-attachments/assets/8bca88ff-0e28-4311-a77d-a14703f8be45" />

### Search Feature
<img width="749" height="599" alt="image" src="https://github.com/user-attachments/assets/c0b4e6e8-d30e-4000-96b6-a16f2fc1f743" />

### File Search
<img width="748" height="571" alt="image" src="https://github.com/user-attachments/assets/cb3dfa03-e909-4007-99de-6aed75712274" />

### Command Library

<img width="392" height="523" alt="image" src="https://github.com/user-attachments/assets/b56cf2f0-64a3-4747-8904-a8497ee20cd3" />

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/B4l3rI0n/SecureShell-Pro.git
cd secureshell-pro
cd server && npm install
# Make your changes
# Test thoroughly
# Submit pull request
```

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🙏 Acknowledgments

- **xterm.js** - Terminal emulator library
- **node-pty** - PTY bindings for Node.js
- **ws** - WebSocket library

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/B4l3rI0n/SecureShell-Pro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/B4l3rI0n/SecureShell-Pro/discussions)

---

## 🗺️ Roadmap

- [ ] Multi-user support with role-based access
- [ ] Session recording and playback
- [ ] Command history export
- [ ] Integration with password managers
- [ ] Mobile app version
- [ ] SSH key authentication
- [ ] Two-factor authentication (2FA)
- [ ] Team collaboration features
- [ ] Cloud sync for saved commands

---

## ⭐ Star History

If you find SecureShell Pro useful, please consider giving it a star on GitHub!

---

**Made with ❤️ by B4l3rI0n for the security and sysadmin community**
