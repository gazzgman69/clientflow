#!/bin/bash

# Pre-Deployment Validation Script
# This script runs before any deployment to ensure tenant isolation integrity
# Usage: ./pre-deployment-validation.sh [environment]

set -e  # Exit on any error

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Environment detection
ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BOLD}${BLUE}🚀 PRE-DEPLOYMENT TENANT ISOLATION VALIDATION${NC}"
echo -e "${BLUE}===========================================${NC}"
echo -e "Environment: ${BOLD}$ENVIRONMENT${NC}"
echo -e "Project Root: $PROJECT_ROOT"
echo -e "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""

# Validation flags
SCHEMA_VALIDATION_PASSED=false
RUNTIME_VALIDATION_PASSED=false
OVERALL_SUCCESS=false

# Function to log with colors
log() {
    local level=$1
    local message=$2
    local timestamp=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
    
    case $level in
        "ERROR")
            echo -e "${RED}❌ [$timestamp] ERROR: $message${NC}"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠️  [$timestamp] WARNING: $message${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}✅ [$timestamp] SUCCESS: $message${NC}"
            ;;
        "INFO")
            echo -e "${BLUE}ℹ️  [$timestamp] INFO: $message${NC}"
            ;;
        "CHECK")
            echo -e "${CYAN}🔍 [$timestamp] CHECK: $message${NC}"
            ;;
    esac
}

# Function to check required environment variables
check_environment() {
    log "CHECK" "Validating environment configuration..."
    
    local required_vars=("DATABASE_URL")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log "ERROR" "Missing required environment variables: ${missing_vars[*]}"
        echo -e "${RED}Please set the following environment variables:${NC}"
        for var in "${missing_vars[@]}"; do
            echo -e "  - $var"
        done
        return 1
    fi
    
    log "SUCCESS" "All required environment variables are set"
    return 0
}

# Function to run schema validation
run_schema_validation() {
    log "CHECK" "Running schema validation..."
    
    cd "$PROJECT_ROOT"
    
    if ! node "$SCRIPT_DIR/schema-validation.cjs"; then
        log "ERROR" "Schema validation failed!"
        echo -e "${RED}${BOLD}CRITICAL: Schema validation must pass before deployment${NC}"
        echo -e "${RED}Review the errors above and fix schema issues${NC}"
        return 1
    fi
    
    log "SUCCESS" "Schema validation passed"
    SCHEMA_VALIDATION_PASSED=true
    return 0
}

# Function to run runtime validation
run_runtime_validation() {
    log "CHECK" "Running runtime database validation..."
    
    cd "$PROJECT_ROOT"
    
    if ! node "$SCRIPT_DIR/runtime-validation.cjs"; then
        log "ERROR" "Runtime validation failed!"
        echo -e "${RED}${BOLD}CRITICAL: Database contains tenant isolation violations${NC}"
        echo -e "${RED}Fix all data integrity issues before deployment${NC}"
        return 1
    fi
    
    log "SUCCESS" "Runtime validation passed"
    RUNTIME_VALIDATION_PASSED=true
    return 0
}

# Function to run additional safety checks
run_safety_checks() {
    log "CHECK" "Running additional safety checks..."
    
    # Check if there are any pending database migrations
    if [[ -f "$PROJECT_ROOT/drizzle/meta/_journal.json" ]]; then
        log "INFO" "Drizzle migration journal found"
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    log "INFO" "Node.js version: $NODE_VERSION"
    
    # Check if TypeScript compiles without errors
    if command -v tsc &> /dev/null; then
        log "CHECK" "Checking TypeScript compilation..."
        cd "$PROJECT_ROOT"
        if tsc --noEmit; then
            log "SUCCESS" "TypeScript compilation successful"
        else
            log "WARN" "TypeScript compilation has errors (non-blocking)"
        fi
    fi
    
    log "SUCCESS" "Additional safety checks completed"
    return 0
}

# Function to generate deployment report
generate_deployment_report() {
    local exit_code=$1
    
    echo ""
    echo -e "${BOLD}${PURPLE}📋 DEPLOYMENT VALIDATION REPORT${NC}"
    echo -e "${PURPLE}================================${NC}"
    
    echo -e "Environment: ${BOLD}$ENVIRONMENT${NC}"
    echo -e "Validation Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
    echo ""
    
    echo -e "${BOLD}VALIDATION RESULTS:${NC}"
    
    if [[ "$SCHEMA_VALIDATION_PASSED" == true ]]; then
        echo -e "  ✅ Schema Validation: ${GREEN}PASSED${NC}"
    else
        echo -e "  ❌ Schema Validation: ${RED}FAILED${NC}"
    fi
    
    if [[ "$RUNTIME_VALIDATION_PASSED" == true ]]; then
        echo -e "  ✅ Runtime Validation: ${GREEN}PASSED${NC}"
    else
        echo -e "  ❌ Runtime Validation: ${RED}FAILED${NC}"
    fi
    
    echo ""
    
    if [[ $exit_code -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}🚀 DEPLOYMENT APPROVED${NC}"
        echo -e "${GREEN}All tenant isolation checks passed successfully${NC}"
        echo -e "${GREEN}Safe to proceed with deployment${NC}"
    else
        echo -e "${RED}${BOLD}🚫 DEPLOYMENT BLOCKED${NC}"
        echo -e "${RED}Critical tenant isolation issues detected${NC}"
        echo -e "${RED}Fix all errors before attempting deployment${NC}"
        
        echo ""
        echo -e "${YELLOW}${BOLD}REMEDIATION STEPS:${NC}"
        echo -e "1. Review validation errors above"
        echo -e "2. Fix schema or database issues"
        echo -e "3. Re-run this validation script"
        echo -e "4. Only deploy after all checks pass"
    fi
    
    echo -e "${PURPLE}================================${NC}"
}

# Main execution
main() {
    local exit_code=0
    
    # Environment validation
    if ! check_environment; then
        exit_code=1
    fi
    
    # Schema validation
    if [[ $exit_code -eq 0 ]]; then
        if ! run_schema_validation; then
            exit_code=1
        fi
    fi
    
    # Runtime validation
    if [[ $exit_code -eq 0 ]]; then
        if ! run_runtime_validation; then
            exit_code=1
        fi
    fi
    
    # Additional safety checks (non-blocking)
    run_safety_checks
    
    # Set overall success flag
    if [[ $exit_code -eq 0 ]]; then
        OVERALL_SUCCESS=true
    fi
    
    # Generate report
    generate_deployment_report $exit_code
    
    # Create validation artifacts for CI/CD
    if [[ "$ENVIRONMENT" != "development" ]]; then
        local artifact_dir="$PROJECT_ROOT/deployment-artifacts"
        mkdir -p "$artifact_dir"
        
        local report_file="$artifact_dir/validation-report-$(date +%Y%m%d-%H%M%S).json"
        cat > "$report_file" << EOF
{
  "timestamp": "$(date -u '+%Y-%m-%d %H:%M:%S UTC')",
  "environment": "$ENVIRONMENT",
  "schemaValidation": $SCHEMA_VALIDATION_PASSED,
  "runtimeValidation": $RUNTIME_VALIDATION_PASSED,
  "overallSuccess": $OVERALL_SUCCESS,
  "exitCode": $exit_code,
  "nodeVersion": "$(node --version)",
  "gitCommit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "gitBranch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF
        
        log "INFO" "Validation report saved to: $report_file"
    fi
    
    exit $exit_code
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Validation interrupted${NC}"; exit 130' INT TERM

# Run main function
main "$@"