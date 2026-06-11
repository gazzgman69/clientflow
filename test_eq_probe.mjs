import { eq, and } from 'drizzle-orm';
import { quoteSignatures } from './shared/schema.ts';

console.log('quoteSignatures.tenantId is:', quoteSignatures.tenantId);
console.log('quoteSignatures.quoteId is:', typeof quoteSignatures.quoteId, quoteSignatures.quoteId?.name);

// Replicate the exact storage query WHERE clause with tenantId=undefined
try {
  const cond = and(
    eq(quoteSignatures.quoteId, 'some-quote-id'),
    eq(quoteSignatures.tenantId, undefined)
  );
  // Try to inspect the generated SQL
  console.log('and(...) built OK. Keys:', Object.keys(cond || {}));
  console.log('cond.queryChunks count:', cond?.queryChunks?.length);
} catch (e) {
  console.log('Building WHERE THREW:', e.message.slice(0,300));
}
