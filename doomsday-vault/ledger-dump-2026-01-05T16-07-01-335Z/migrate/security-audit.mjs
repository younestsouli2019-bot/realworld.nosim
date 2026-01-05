import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../src');

class SecurityAuditor {
  constructor(rootPath) {
    this.rootPath = rootPath;
    this.findings = [];
    this.idPatterns = {
      userId: /(user|usr|account|acct)[_\-]?id[\s]*[=:][\s]*["']?([a-zA-Z0-9_\-]+)["']?/i,
      appId: /(app|application)[_\-]?id[\s]*[=:][\s]*["']?([a-zA-Z0-9_\-]+)["']?/i,
      jwtInUrl: /[&\?](token|jwt|access[_\-]?token)=([a-zA-Z0-9_\-\.]+)/i,
      redirectParam: /redirect[_\-]?(to|uri|url)=([^&\s"']+)/i
    };
  }

  async runAudit() {
    console.log(`🔍 Starting security audit of ${this.rootPath}`);
    await this.scanDirectory(this.rootPath);
    this.reportFindings();
  }

  async scanDirectory(dir) {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.promises.stat(fullPath);
      
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && !file.startsWith('.')) {
          await this.scanDirectory(fullPath);
        }
      } else if (/\.(mjs|js|ts|json)$/.test(file)) {
        await this.auditFile(fullPath);
      }
    }
  }

  async auditFile(filePath) {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const relativePath = path.relative(this.rootPath, filePath);

      // Check for IDOR patterns
      if (this.checkIdorPatterns(content)) {
        this.findings.push({
          file: relativePath,
          issue: 'IDOR_PATTERN',
          severity: 'HIGH',
          description: 'Found pattern suggesting Insecure Direct Object Reference (URL ID usage without obvious auth check nearby)'
        });
      }

      // Check for JWT in URLs
      if (this.idPatterns.jwtInUrl.test(content)) {
        this.findings.push({
          file: relativePath,
          issue: 'JWT_IN_URL',
          severity: 'CRITICAL',
          description: 'Potential JWT/Token passed in URL parameters'
        });
      }

      // Check for unvalidated redirects
      const redirectMatch = content.match(this.idPatterns.redirectParam);
      if (redirectMatch) {
        const url = redirectMatch[2];
        if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
          this.findings.push({
            file: relativePath,
            issue: 'UNVALIDATED_REDIRECT',
            severity: 'HIGH',
            description: `Potential unvalidated redirect parameter: ${url.substring(0, 50)}...`
          });
        }
      }

      // Check for client-side enforcement
      if (content.toLowerCase().includes('premium') && 
          content.toLowerCase().includes('client') && 
          !content.toLowerCase().includes('server')) {
        this.findings.push({
          file: relativePath,
          issue: 'CLIENT_SIDE_ENFORCEMENT',
          severity: 'MEDIUM',
          description: 'Possible client-side only enforcement of premium features'
        });
      }

    } catch (err) {
      console.error(`Error auditing ${filePath}:`, err);
    }
  }

  checkIdorPatterns(content) {
    const urlPatterns = [
      /\/user\/([^/\s"']+)\//,
      /\/app\/([^/\s"']+)\//,
      /\/api\/(users|apps)\/([^/\s"']+)/,
      /id=([^&\s"']+)/
    ];

    const hasUrlPattern = urlPatterns.some(p => p.test(content));
    if (!hasUrlPattern) return false;

    const authKeywords = ['authenticate', 'authorize', 'checkPermission', 'verifyUser', 'token', 'secret'];
    const lowerContent = content.toLowerCase();
    // If we find ID patterns but NO auth keywords, it's suspicious
    return !authKeywords.some(k => lowerContent.includes(k.toLowerCase()));
  }

  reportFindings() {
    if (this.findings.length === 0) {
      console.log("\n✅ No obvious security issues found in the audit!");
      return;
    }

    console.log(`\n❌ Found ${this.findings.length} potential security issues:`);
    
    const bySeverity = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
    this.findings.forEach(f => {
      if (bySeverity[f.severity]) bySeverity[f.severity].push(f);
    });

    for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']) {
      if (bySeverity[severity].length > 0) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`${severity} ISSUES (${bySeverity[severity].length})`);
        console.log(`${'='.repeat(60)}`);
        bySeverity[severity].forEach(f => {
          console.log(`📄 ${f.file}`);
          console.log(`   ${f.description}`);
          console.log('');
        });
      }
    }
  }
}

// Run the audit
const auditor = new SecurityAuditor(ROOT_DIR);
auditor.runAudit().catch(console.error);
