module.exports = {
  rules: {
    // Enforce camelCase naming convention for variables and properties
    'camelcase': ['error', { 
      'properties': 'always', 
      'ignoreDestructuring': false,
      'ignoreImports': false,
      // Allow snake_case for database column mappings in schema files
      'allow': ['^[a-z]+_[a-z_]+$']
    }],
    'no-hardcoded-test-user': {
      create(context) {
        return {
          Literal(node) {
            if (typeof node.value === 'string' && node.value.includes('test-user')) {
              // Allow in test files and docs
              const filename = context.getFilename();
              if (filename.includes('__tests__') || 
                  filename.includes('.test.') || 
                  filename.includes('.spec.') ||
                  filename.includes('attached_assets/')) {
                return;
              }
              
              context.report({
                node,
                message: 'Hardcoded "test-user" not allowed in production code. Use session-based authentication instead.',
              });
            }
          },
          TemplateElement(node) {
            if (node.value.raw.includes('test-user')) {
              const filename = context.getFilename();
              if (filename.includes('__tests__') || 
                  filename.includes('.test.') || 
                  filename.includes('.spec.') ||
                  filename.includes('attached_assets/')) {
                return;
              }
              
              context.report({
                node,
                message: 'Hardcoded "test-user" not allowed in production code. Use session-based authentication instead.',
              });
            }
          },
        };
      },
    },
  },
};