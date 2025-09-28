#!/bin/bash
# CI Guard: Fail if any Gmail integration/email insert is missing tenant_id
# Usage: ./scripts/guard-tenant-gmail.sh

echo "🔍 Checking Gmail integrations and emails for tenant_id compliance..."

# Check for INSERT INTO calendar_integrations without tenant_id
echo "Checking calendar_integrations INSERTs..."
CALENDAR_VIOLATIONS=$(grep -rn "INSERT INTO.*calendar_integrations" server/src --include="*.ts" --include="*.js" | grep -v "tenant_id" || true)

if [ -n "$CALENDAR_VIOLATIONS" ]; then
  echo "❌ VIOLATION: calendar_integrations INSERT without tenant_id found:"
  echo "$CALENDAR_VIOLATIONS"
  exit 1
fi

# Check for INSERT INTO emails without tenant_id
echo "Checking emails table INSERTs..."
EMAIL_VIOLATIONS=$(grep -rn "INSERT INTO.*emails" server/src --include="*.ts" --include="*.js" | grep -v "tenant_id" || true)

if [ -n "$EMAIL_VIOLATIONS" ]; then
  echo "❌ VIOLATION: emails INSERT without tenant_id found:"
  echo "$EMAIL_VIOLATIONS"
  exit 1
fi

# Check for .insert(calendar_integrations) without tenant_id in values
echo "Checking Drizzle calendar_integrations inserts..."
DRIZZLE_CAL_VIOLATIONS=$(grep -rn "\.insert(.*calendar.*tegrations.*)" server/src --include="*.ts" -A 5 | grep -B 5 -A 5 "\.values" | grep -L "tenantId" || true)

# Check for .insert(emails) without tenant_id in values  
echo "Checking Drizzle emails inserts..."
DRIZZLE_EMAIL_VIOLATIONS=$(grep -rn "\.insert(.*emails.*)" server/src --include="*.ts" -A 5 | grep -B 5 -A 5 "\.values" | grep -L "tenantId" || true)

echo "✅ No tenant_id violations found in Gmail integration/email inserts"
echo "🛡️  Gmail tenant isolation CI guard passed"
exit 0