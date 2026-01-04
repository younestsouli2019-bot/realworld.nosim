
import fs from 'fs';
import path from 'path';

const DLQ_PATH = path.join(process.cwd(), 'data', 'autonomous', 'dead_letter_queue.json');

export class FailureHandler {
  constructor() {
    this.ensureDlqExists();
  }

  ensureDlqExists() {
    const dir = path.dirname(DLQ_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(DLQ_PATH)) {
      fs.writeFileSync(DLQ_PATH, JSON.stringify([], null, 2));
    }
  }

  /**
   * Handle a task failure
   * @param {object} task 
   * @param {Error} error 
   * @returns {object} Action to take: { type: 'RETRY' | 'ABORT' | 'DLQ', delay: number }
   */
  handleFailure(task, error) {
    const isTransient = this.isTransient(error);
    const attempt = (task.attempts || 0) + 1;
    task.attempts = attempt;

    console.log(`[FailureHandler] Handling failure for task ${task.id || 'unknown'} (Attempt ${attempt})`);

    if (isTransient && attempt <= 5) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s, 16s, 32s
      return { type: 'RETRY', delay, task };
    }

    if (!isTransient || attempt > 5) {
      this.moveToDLQ(task, error);
      return { type: 'DLQ', task };
    }
    
    return { type: 'ABORT', task };
  }

  isTransient(error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('econnreset') ||
      msg.includes('429') ||
      msg.includes('503') ||
      msg.includes('rate limit')
    );
  }

  moveToDLQ(task, error) {
    console.error(`[FailureHandler] Moving task ${task.id} to Dead Letter Queue. Reason: ${error.message}`);
    
    const dlq = JSON.parse(fs.readFileSync(DLQ_PATH, 'utf8'));
    dlq.push({
      task,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    fs.writeFileSync(DLQ_PATH, JSON.stringify(dlq, null, 2));
  }
}
