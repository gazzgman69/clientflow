#!/bin/bash

# Install git hooks for tenant isolation safety

echo "🔧 Installing git hooks for tenant isolation safety..."

# Make scripts executable
chmod +x scripts/pre-commit-tenant-check.sh
chmod +x scripts/validate-schema-tenant-coverage.js

# Install pre-commit hook
if [ ! -f .git/hooks/pre-commit ]; then
    cp scripts/pre-commit-tenant-check.sh .git/hooks/pre-commit
    chmod +x .git/hooks/pre-commit
    echo "✅ Pre-commit hook installed"
else
    echo "⚠️  Pre-commit hook already exists. Manual merge may be required."
    echo "   Existing hook: .git/hooks/pre-commit"
    echo "   New hook: scripts/pre-commit-tenant-check.sh"
fi

# Add package.json script for schema validation
if command -v jq >/dev/null 2>&1; then
    jq '.scripts["validate:tenant-schema"] = "node scripts/validate-schema-tenant-coverage.js"' package.json > package.json.tmp
    mv package.json.tmp package.json
    echo "✅ Added npm script: validate:tenant-schema"
else
    echo "⚠️  jq not found. Manually add to package.json:"
    echo '   "validate:tenant-schema": "node scripts/validate-schema-tenant-coverage.js"'
fi

echo ""
echo "🎯 Git hooks installed! Available commands:"
echo "   npm run validate:tenant-schema  - Check tenant coverage"
echo "   git commit                      - Triggers automatic tenant checks"
echo ""
echo "💡 To test the schema validator now:"
echo "   npm run validate:tenant-schema"