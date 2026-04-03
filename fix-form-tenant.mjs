import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const FORM_ID = 'ba390264-b286-4aa9-9756-3a2488e5c581';
const CORRECT_TENANT_ID = '575405a6-b4ac-4fe3-b1d1-0e42abafdf06';

// Check current state
const before = await sql`SELECT id, tenant_id FROM lead_capture_forms WHERE id = ${FORM_ID}`;
console.log('BEFORE:', JSON.stringify(before));

// Update
const result = await sql`
  UPDATE lead_capture_forms
  SET tenant_id = ${CORRECT_TENANT_ID}
  WHERE id = ${FORM_ID}
  RETURNING id, tenant_id
`;
console.log('AFTER UPDATE:', JSON.stringify(result));
