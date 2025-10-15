// server.js - Enhanced WebSocket Terminal Server with Authentication and TLS
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
const url = require('url');

let PORT = process.env.PORT || 6060;

// --- CLI Arguments ---
const argv = process.argv.slice(2);
function getArg(name) {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] || null;
}

const helpRequested = argv.includes('-h') || argv.includes('--help');
const NO_LOG = argv.includes('--no-log') || argv.includes('-n');
let logfile = getArg('--logfile') || getArg('-l') || null;
const authTokenArg = getArg('--password') || getArg('-p') || null;
const portArg = getArg('--port') || null;
const certPath = getArg('--cert') || getArg('-c') || null;
const keyPath = getArg('--key') || getArg('-k') || null;

// Handle help
if (helpRequested) {
  console.log('Usage: node server.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  -p, --password <token>   Set authentication token (min 15 chars, with uppercase, lowercase, digit, special)');
  console.log('  -l, --logfile <file>     Set log file path');
  console.log('  -n, --no-log             Disable file logging (default: enabled)');
  console.log('  --port <port>            Set port (default: 6060)');
  console.log('  -c, --cert <file>        Path to SSL certificate (PEM)');
  console.log('  -k, --key <file>         Path to SSL private key (PEM)');
  console.log('  -h, --help               Show this help');
  console.log('');
  process.exit(0);
}

// Override PORT if --port provided
if (portArg) {
  const portNum = parseInt(portArg, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    console.error('❌ Invalid port number');
    process.exit(1);
  }
  PORT = portNum;
}

// Prefer environment variable for token
let AUTH_TOKEN = process.env.WS_TERM_TOKEN || authTokenArg || null;

// Validate token complexity (if provided)
function isStrongPassword(token) {
  if (!token || token.length < 15) return false;
  const hasUpper = /[A-Z]/.test(token);
  const hasLower = /[a-z]/.test(token);
  const hasDigit = /\d/.test(token);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(token);
  return hasUpper && hasLower && hasDigit && hasSpecial;
}

if (AUTH_TOKEN && !isStrongPassword(AUTH_TOKEN)) {
  console.error('❌ Authentication token is too weak. Must be at least 15 characters with uppercase, lowercase, digit, and special char.');
  process.exit(1);
}

if (!AUTH_TOKEN) {
  console.warn('⚠️  No authentication token provided. Running without auth (insecure!)');
}

const AUTH_TIMEOUT_MS = 10000; // 10 seconds to authenticate

// Enhanced rate limiting: fail counts and bans (IP -> {fails: number, bannedUntil: timestamp | null})
const ipSecurity = new Map(); // In-memory; resets on restart

function getSecurityRecord(ip) {
  let record = ipSecurity.get(ip) || { fails: 0, bannedUntil: null };
  const now = Date.now();
  // Reset fails if ban expired
  if (record.bannedUntil && now > record.bannedUntil) {
    record = { fails: 0, bannedUntil: null };
  }
  ipSecurity.set(ip, record);
  return record;
}

function incrementFail(ip) {
  const record = getSecurityRecord(ip);
  record.fails++;
  ipSecurity.set(ip, record);
  return record.fails;
}

function banIP(ip, durationMs = 300000) { // Default 5 min
  const record = getSecurityRecord(ip);
  record.bannedUntil = Date.now() + durationMs;
  ipSecurity.set(ip, record);
}

// --- Logging Setup ---
let logFd = null;
let logStream = null;

if (!NO_LOG) {
  if (!logfile) {
    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-');
    const logsDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    logfile = path.join(logsDir, `terminal-${ts}.log`);
  }

  try {
    logFd = fs.openSync(logfile, 'a', 0o600);
    logStream = fs.createWriteStream(null, { fd: logFd, flags: 'a' });
  } catch (err) {
    console.error('❌ Unable to open/create log file:', err.message);
    process.exit(1);
  }
}

function writeLog(entry) {
  if (NO_LOG || !logStream) return;
  const line = `${new Date().toISOString()} ${entry}\n`;
  try { 
    logStream.write(line); 
  } catch (err) { 
    console.error('❌ Error writing to log file:', err.message); 
  }
}

// --- HTTPS Server Setup ---
let server;
if (certPath && keyPath && fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const options = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath)
  };
  server = https.createServer(options);
  console.log(`🔒 TLS ENABLED - Using cert: ${certPath}, key: ${keyPath}`);
} else {
  console.warn('⚠️  No valid cert/key provided. Running on HTTP (insecure for production!)');
  server = require('http').createServer();
}

// --- WebSocket Server ---
const wss = new WebSocket.Server({ server });

server.listen(PORT, () => {
  const protocol = certPath && keyPath ? 'wss' : 'ws';
  console.log(`🚀 ${protocol.toUpperCase()} WebSocket Terminal Server running on ${protocol}://0.0.0.0:${PORT}`);
  console.log(`📡 Waiting for connections...`);
  if (NO_LOG) {
    console.log('📝 Logging DISABLED');
  } else {
    console.log(`📝 Logging to: ${logfile}`);
  }
  if (AUTH_TOKEN) {
    console.log('🔒 Authentication ENABLED - Token required');
    console.log(`🔑 Token: ${AUTH_TOKEN.substring(0, 4)}${'*'.repeat(Math.max(0, AUTH_TOKEN.length - 4))}`);
  } else {
    console.log('⚠️  WARNING: No authentication configured!');
    console.log('   Set WS_TERM_TOKEN env var or use --password <token>');
  }
});

wss.on('connection', (ws, req) => {
  const clientIP = req.socket.remoteAddress || 'unknown';
  const sessionId = crypto.randomBytes(4).toString('hex');
  
  // Check ban on connect
  const record = getSecurityRecord(clientIP);
  if (record.bannedUntil && Date.now() < record.bannedUntil) {
    console.log(`🚫 Banned IP ${clientIP} attempted connection [${sessionId}]`);
    writeLog(`SECURITY [${sessionId}] Banned IP ${clientIP} rejected`);
    ws.close(4005, 'IP temporarily banned');
    return;
  }
  
  console.log(`✅ Client connected from ${clientIP} [${sessionId}]`);
  writeLog(`INFO [${sessionId}] Client connected from ${clientIP}`);

  ws.isAuthenticated = false;
  ws.sessionId = sessionId;
  ws.clientIP = clientIP;

  // Authentication timeout
  const authTimer = setTimeout(() => {
    if (!ws.isAuthenticated) {
      console.log(`⏰ Authentication timeout for ${clientIP} [${sessionId}]`);
      writeLog(`WARN [${sessionId}] Authentication timeout`);
      try {
        ws.send(JSON.stringify({ 
          type: 'auth', 
          status: 'timeout',
          message: 'Authentication timeout'
        }));
        ws.close(4001, 'Authentication timeout');
      } catch (e) {}
    }
  }, AUTH_TIMEOUT_MS);

  // Spawn shell (will only receive input after auth)
  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  let ptyProcess = null;

  function spawnShell() {
    ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: process.env.HOME || process.env.USERPROFILE || process.cwd(),
      env: process.env
    });

    console.log(`🐚 Spawned ${shell} (PID: ${ptyProcess.pid}) for [${sessionId}]`);
    writeLog(`INFO [${sessionId}] Spawned shell ${shell} PID=${ptyProcess.pid}`);

    // Forward shell output to client
    ptyProcess.onData((data) => {
      if (ws.readyState === WebSocket.OPEN && ws.isAuthenticated) {
        try { 
          ws.send(data); 
        } catch (err) {
          writeLog(`ERROR [${sessionId}] Send failed: ${err.message}`);
        }
      }
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      console.log(`🛑 Shell exited [${sessionId}] (code: ${exitCode}, signal: ${signal})`);
      writeLog(`INFO [${sessionId}] Shell exited code=${exitCode} signal=${signal}`);
      try { 
        ws.send(JSON.stringify({ 
          type: 'shell_exit', 
          exitCode: exitCode, 
          signal: signal 
        }));
        ws.close(); 
      } catch (e) {}
    });
  }

  // Buffer for command logging
  let commandBuffer = "";
  let lastCommandTime = Date.now();

  ws.on('message', (data) => {
    try {
      const payload = data.toString();
      const now = Date.now();

      // Handle authentication
      if (!ws.isAuthenticated) {
        let authData = null;
        
        // Try to parse as JSON first
        try {
          authData = JSON.parse(payload);
        } catch (e) {
          // Not JSON, treat as raw token
          authData = { token: payload.trim() };
        }

        writeLog(`AUTH [${sessionId}] Attempt from ${clientIP}`);

        // Check if auth token is required
        if (AUTH_TOKEN) {
          const clientToken = authData.token || authData.password || payload.trim();
          
          if (clientToken === AUTH_TOKEN) {
            ws.isAuthenticated = true;
            clearTimeout(authTimer);
            
            console.log(`🔓 Client authenticated [${sessionId}]`);
            writeLog(`AUTH [${sessionId}] SUCCESS`);
            
            ws.send(JSON.stringify({ 
              type: 'auth', 
              status: 'success',
              message: 'Authentication successful',
              sessionId: sessionId
            }));

            // Spawn shell after successful auth
            spawnShell();
            
            return;
          } else {
            // Increment fail and check for ban
            const fails = incrementFail(clientIP);
            console.log(`🔒 Authentication failed for [${sessionId}] - Invalid token (attempt ${fails}/5)`);
            writeLog(`AUTH [${sessionId}] FAILED - Invalid token (received: ${clientToken.substring(0, 4)}****) attempt=${fails}`);
            
            ws.send(JSON.stringify({ 
              type: 'auth', 
              status: 'failed',
              message: 'Invalid authentication token'
            }));

            if (fails >= 5) {
              banIP(clientIP, 300000); // 5 min ban
              console.log(`🚫 Banning IP ${clientIP} for 5 minutes [${sessionId}]`);
              writeLog(`SECURITY [${sessionId}] IP ${clientIP} banned for 5m (5 fails)`);
              try { ws.close(4004, 'Too many failed attempts - IP banned'); } catch (e) {}
              return;
            }
            
            setTimeout(() => {
              try { ws.close(4003, 'Authentication failed'); } catch (e) {}
            }, 500);
            
            return;
          }
        } else {
          // No auth required
          ws.isAuthenticated = true;
          clearTimeout(authTimer);
          
          console.log(`✅ Client accepted (no auth required) [${sessionId}]`);
          writeLog(`AUTH [${sessionId}] ACCEPTED (no-auth-configured)`);
          
          ws.send(JSON.stringify({ 
            type: 'auth', 
            status: 'success',
            message: 'Connected (no authentication required)',
            sessionId: sessionId,
            noAuth: true
          }));

          // Spawn shell
          spawnShell();
          
          return;
        }
      }

      // Handle regular input (after authentication)
      if (ws.isAuthenticated && ptyProcess) {
        // Log every character for debugging (optional, can be verbose)
        const charCode = payload.charCodeAt(0);
        
        // Special characters logging
        if (charCode === 3) {
          writeLog(`INPUT [${sessionId}] CTRL+C (interrupt)`);
          commandBuffer = "";
        } else if (charCode === 4) {
          writeLog(`INPUT [${sessionId}] CTRL+D (EOF)`);
        } else if (charCode === 26) {
          writeLog(`INPUT [${sessionId}] CTRL+Z (suspend)`);
        }

        // Log commands (when Enter is pressed)
        if (payload.includes('\r') || payload.includes('\n')) {
          const combined = commandBuffer + payload;
          const parts = combined.split(/[\r\n]+/);

          for (let i = 0; i < parts.length - 1; i++) {
            const cmd = parts[i].trim();
            const timeSinceLastCmd = now - lastCommandTime;

            if (cmd.length > 0) {
              const logEntry = `${new Date().toISOString()} [${sessionId}] ${clientIP} CMD: ${cmd}`;
              console.log(`📥 [${sessionId}] Command: ${cmd}`);
              writeLog(logEntry);
            } else {
              writeLog(`${new Date().toISOString()} [${sessionId}] ${clientIP} CMD: <EMPTY_LINE>`);
            }

            lastCommandTime = now;
          }
          commandBuffer = parts[parts.length - 1];
        } else if (payload.charCodeAt(0) === 127 || payload === '\b') {
          // Backspace
          commandBuffer = commandBuffer.slice(0, -1);
        } else if (charCode >= 32 && charCode < 127) {
          // Printable character
          commandBuffer += payload;
        }
        // Forward to shell
        ptyProcess.write(payload);
      }

    } catch (err) {
      console.error(`❌ Error handling message [${sessionId}]:`, err.message);
      writeLog(`ERROR [${sessionId}] ${err.message} ${err.stack || ''}`);
    }
  });

  ws.on('close', (code, reason) => {
    clearTimeout(authTimer);
    const closeReason = reason ? reason.toString() : '';
    console.log(`❌ Client disconnected [${sessionId}] (code=${code}, reason=${closeReason})`);
    writeLog(`INFO [${sessionId}] Disconnected code=${code} reason=${closeReason} authenticated=${ws.isAuthenticated}`);
    
    if (ptyProcess) {
      try { 
        ptyProcess.kill(); 
        writeLog(`INFO [${sessionId}] Shell process killed`);
      } catch (e) {
        writeLog(`ERROR [${sessionId}] Failed to kill shell: ${e.message}`);
      }
    }
  });

  ws.on('error', (err) => {
    clearTimeout(authTimer);
    console.error(`❌ WebSocket error [${sessionId}]:`, err.message);
    writeLog(`ERROR [${sessionId}] WebSocket error: ${err.message} ${err.stack || ''}`);
    
    if (ptyProcess) {
      try { ptyProcess.kill(); } catch (e) {}
    }
  });
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  writeLog(`ERROR Server ${err.message}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  writeLog('INFO Server shutting down (SIGINT)');
  
  wss.close(() => {
    if (logStream) {
      try { logStream.end(); } catch (e) {}
    }
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  writeLog('INFO Server shutting down (SIGTERM)');
  
  wss.close(() => {
    if (logStream) {
      try { logStream.end(); } catch (e) {}
    }
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
});
