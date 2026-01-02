
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class LiveDashboardServer {
    constructor(port = 8080) {
        this.port = port;
        this.server = createServer((req, res) => {
            // Serve the dashboard HTML file
            if (req.url === '/' || req.url === '/index.html') {
                try {
                    const html = readFileSync(join(__dirname, '../../rewards_dashboard.html'), 'utf8');
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(html);
                } catch (e) {
                    res.writeHead(404);
                    res.end('Dashboard file not found');
                }
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });
        
        this.wss = new WebSocketServer({ server: this.server });
        this.clients = new Set();
        
        this.wss.on('connection', (ws) => {
            console.log('🔌 Dashboard connected');
            this.clients.add(ws);
            
            // Send initial state
            ws.send(JSON.stringify({
                type: 'new_reward',
                reward: {
                    level: 1,
                    title: 'SYSTEM CONNECTED',
                    description: 'Live Reward Dashboard Active',
                    rewards: ['Real-time monitoring'],
                    message: 'Waiting for revenue events...',
                    forwardPull: 'Next: Generate Revenue'
                },
                intensity: 1
            }));
            
            ws.on('close', () => {
                this.clients.delete(ws);
            });
        });
        
        this.start();
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`⚡ Live Dashboard Server running on http://localhost:${this.port}`);
        });
    }
    
    broadcast(data) {
        const msg = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.readyState === 1) {
                client.send(msg);
            }
        }
    }
}

// Singleton instance
let dashboardServer = null;

export function getDashboardServer() {
    if (!dashboardServer) {
        dashboardServer = new LiveDashboardServer();
    }
    return dashboardServer;
}
