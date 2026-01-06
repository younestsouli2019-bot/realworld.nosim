import net from 'node:net';

export async function ipcCall({ path, body, token, pipe }) {
  const target = pipe || '\\\\.\\pipe\\SwarmExternalPayment';
  return new Promise((resolve, reject) => {
    const socket = net.connect(target);
    let buf = '';
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const idx = buf.indexOf('\n');
      if (idx >= 0) {
        const line = buf.slice(0, idx).trim();
        try { resolve(JSON.parse(line)); } catch { resolve({ error: 'bad_json' }); }
        socket.end();
      }
    });
    socket.on('error', reject);
    const payload = JSON.stringify({ path, body, token }) + '\n';
    socket.write(payload);
  });
}

