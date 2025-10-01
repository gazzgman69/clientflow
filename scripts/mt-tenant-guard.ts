/**
 * Multi-Tenant Guard Runner
 * 
 * Executes all tenant isolation checks in order and provides unified verdict.
 * Exits with non-zero code if any check fails.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CheckResult {
  name: string;
  exitCode: number;
  output: string;
  verdict: string; // PASS | FAIL | skipped
}

/**
 * Run a script and capture output
 */
async function runScript(scriptPath: string, name: string): Promise<CheckResult> {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${name}`);
    console.log(`${'='.repeat(60)}\n`);
    
    const child = spawn('tsx', [scriptPath], {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    
    child.stdout.on('data', (data) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
    });
    
    child.stderr.on('data', (data) => {
      const text = data.toString();
      process.stderr.write(text);
      output += text;
    });
    
    child.on('close', (code) => {
      const exitCode = code ?? 0;
      
      // Parse verdict from output
      let verdict = 'skipped';
      
      // Check for explicit PASS/FAIL in verdict section
      if (output.includes('PASS')) {
        verdict = 'PASS';
      }
      
      // Check for FAIL indicators
      if (output.includes(': FAIL') || 
          output.includes('Cross-tenant single GET blocked: FAIL') ||
          output.includes('SECURITY ISSUE')) {
        verdict = 'FAIL';
      }
      
      // Check for skipped indicators
      if (output.includes('skipped (no foreign id)') || 
          output.includes('skipped (unavailable)') ||
          output.includes('skipped (auth)') ||
          output.includes('skipped (ci-secrets)')) {
        // Keep as skipped if no explicit PASS/FAIL was found
        if (verdict === 'skipped') {
          verdict = 'skipped';
        }
      }
      
      // Non-zero exit code indicates failure
      if (exitCode !== 0) {
        verdict = 'FAIL';
      }
      
      resolve({ name, exitCode, output, verdict });
    });
  });
}

/**
 * Main execution
 */
async function main() {
  console.log('🔒 Multi-Tenant Guard - Running All Checks\n');
  
  const checks = [
    {
      script: 'scripts/mt-tenant-isolation-check.ts',
      name: 'isolation',
      label: 'Tenant Isolation Check'
    },
    {
      script: 'scripts/mt-override-probes.ts',
      name: 'override',
      label: 'Override Protection Probes'
    },
    {
      script: 'scripts/mt-cross-tenant-proof.ts',
      name: 'cross-tenant',
      label: 'Cross-Tenant Denial Proof'
    }
  ];
  
  const results: CheckResult[] = [];
  let hasFailures = false;
  let hasAnomalies = false;
  
  // Run each check sequentially
  for (const check of checks) {
    const result = await runScript(check.script, check.label);
    results.push({ ...result, name: check.name });
    
    if (result.exitCode !== 0 || result.verdict === 'FAIL') {
      hasFailures = true;
    }
    
    // Check for anomalies in output (be more specific)
    if ((result.output.includes('Anomalies:') && 
         !result.output.includes('Anomalies: none detected')) ||
        (result.output.includes('anomalies:') && 
         !result.output.includes('anomalies: none detected'))) {
      hasAnomalies = true;
    }
  }
  
  // Print final summary
  console.log('\n');
  console.log('=== TENANT GUARD SUMMARY ===');
  
  for (const result of results) {
    const statusStr = result.verdict.padEnd(8);
    console.log(`${result.name}: ${statusStr}`);
  }
  
  console.log(`anomalies: ${hasAnomalies ? 'see logs' : 'none'}`);
  console.log('============================\n');
  
  // Exit with appropriate code
  if (hasFailures) {
    console.error('❌ Tenant guard checks FAILED\n');
    process.exit(1);
  } else {
    console.log('✅ Tenant guard checks PASSED\n');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Fatal error running tenant guard:', error);
  process.exit(1);
});
