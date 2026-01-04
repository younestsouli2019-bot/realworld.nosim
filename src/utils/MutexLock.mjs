
import fs from 'fs';
import path from 'path';

/**
 * Simple File-Based Mutex Lock for Distributed Consistency
 * Ensures only one process/agent can write to a resource at a time.
 */
export class MutexLock {
    constructor(resourceId) {
        this.resourceId = resourceId;
        this.lockDir = path.join(process.cwd(), 'data', 'locks');
        this.lockFile = path.join(this.lockDir, `${resourceId}.lock`);
        this.ensureLockDir();
    }

    ensureLockDir() {
        if (!fs.existsSync(this.lockDir)) {
            fs.mkdirSync(this.lockDir, { recursive: true });
        }
    }

    /**
     * Acquire lock. Retries until timeout.
     * @param {number} timeoutMs - Max wait time (default 5000ms)
     * @returns {Promise<boolean>} - True if acquired, False if timeout
     */
    async acquire(timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                // 'wx' flag fails if file exists (atomic creation)
                fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: 'wx' });
                return true;
            } catch (e) {
                if (e.code === 'EEXIST') {
                    // Lock exists, wait and retry
                    await new Promise(resolve => setTimeout(resolve, 50));
                } else {
                    throw e;
                }
            }
        }
        console.warn(`[MutexLock] Failed to acquire lock for ${this.resourceId} after ${timeoutMs}ms`);
        return false;
    }

    /**
     * Release the lock.
     */
    release() {
        try {
            if (fs.existsSync(this.lockFile)) {
                fs.unlinkSync(this.lockFile);
            }
        } catch (e) {
            console.error(`[MutexLock] Error releasing lock for ${this.resourceId}:`, e);
        }
    }

    /**
     * Run a function within the lock.
     */
    async runExclusive(callback) {
        if (await this.acquire()) {
            try {
                return await callback();
            } finally {
                this.release();
            }
        } else {
            throw new Error(`Could not acquire lock for ${this.resourceId}`);
        }
    }
}
