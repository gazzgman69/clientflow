#!/bin/bash

# Pre-commit hook to prevent tenant isolation violations
# Add this to .git/hooks/pre-commit

echo "🔍 Checking for tenant isolation violations..."

# Check for hardcoded tenant IDs or user IDs in runtime code
if git diff --cached | grep -E "^\+.*(tenantId\s*=\s*['\"][^'\"]*['\"]|test-user|default-tenant.*=)" | grep -v "scripts/" | grep -v "test"; then
    echo "❌ BLOCKED: Hardcoded tenant/user IDs detected in runtime code!"
    echo "   Remove hardcoded values and use dynamic tenant resolution."
    echo "   Found violations:"
    git diff --cached | grep -E "^\+.*(tenantId\s*=\s*['\"][^'\"]*['\"]|test-user|default-tenant.*=)" | grep -v "scripts/" | grep -v "test" | head -5
    exit 1
fi

# Check for database queries without tenant filtering 
if git diff --cached | grep -E "^\+.*\.(select|update|delete|insert).*FROM\s+\w+" | grep -v "withTenant\|tenant_id\|tenantId" | grep -v "scripts/" | grep -v "test"; then
    echo "⚠️  WARNING: Database queries found without explicit tenant filtering"
    echo "   Ensure these queries use withTenant() or include tenant_id filtering"
    git diff --cached | grep -E "^\+.*\.(select|update|delete|insert).*FROM\s+\w+" | grep -v "withTenant\|tenant_id\|tenantId" | grep -v "scripts/" | grep -v "test" | head -3
    echo "   Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for session access without tenant context
if git diff --cached | grep -E "^\+.*req\.session\.(userId|user)" | grep -v "tenantId\|tenant_id" | grep -v "scripts/" | grep -v "test"; then
    echo "⚠️  WARNING: Session access without tenant context detected"
    echo "   Ensure session access includes tenant validation"
    echo "   Continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Tenant isolation checks passed"