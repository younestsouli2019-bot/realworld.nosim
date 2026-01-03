// src/real/evidence-integrity.mjs
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CHAIN_PATH = path.join(process.cwd(), 'data', 'evidence-chain.json');

export class EvidenceIntegrityChain {
    
    static async assertEventBound(eventId) {
        const block = await this.fetchBlockForEvent(eventId);

        if (!block) {
            // Auto-create block for legacy/migration if missing?
            // "Hard-Binding" implies NO. 
            // But for the purpose of the "upgrade", we might need to initialize it.
            // For now, fail as per spec.
            throw new Error(
                `INVARIANT_FAIL: evidence_block_missing (${eventId})`
            );
        }

        const recomputedHash = this.calculateBlockHash(block);

        if (recomputedHash !== block.hash) {
            throw new Error(
                `INVARIANT_FAIL: evidence_chain_tampered (${eventId})`
            );
        }

        return true;
    }

    static async fetchBlockForEvent(eventId) {
        const chain = await this.#loadChain();
        return chain.find(b => b.eventId === eventId);
    }

    static calculateBlockHash(block) {
        // Simple hash of content + prevHash
        const content = {
            eventId: block.eventId,
            proof: block.proof,
            prevHash: block.prevHash,
            timestamp: block.timestamp
        };
        return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
    }

    // Helper to add blocks (needed for the system to work)
    static async addBlock(eventId, proof) {
        const chain = await this.#loadChain();
        const lastBlock = chain[chain.length - 1];
        const prevHash = lastBlock ? lastBlock.hash : 'GENESIS';

        const newBlock = {
            eventId,
            proof,
            prevHash,
            timestamp: new Date().toISOString()
        };
        
        newBlock.hash = this.calculateBlockHash(newBlock);
        
        chain.push(newBlock);
        await this.#saveChain(chain);
        return newBlock;
    }

    static async #loadChain() {
        if (!fs.existsSync(CHAIN_PATH)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(CHAIN_PATH, 'utf8'));
    }

    static async #saveChain(chain) {
        fs.writeFileSync(CHAIN_PATH, JSON.stringify(chain, null, 2));
    }
}
