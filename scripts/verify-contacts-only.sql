-- CONTACTS-ONLY EMAIL INGESTION VERIFICATION SCRIPT
-- This script verifies the contacts-only implementation is working correctly

-- Test 1: Verify no emails exist without contact_id
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ PASS: No orphaned emails found'
        ELSE '❌ FAIL: ' || COUNT(*) || ' emails without contact_id found'
    END as test_result
FROM emails 
WHERE contact_id IS NULL;

-- Test 2: Verify quarantine table exists and has expected orphaned emails
SELECT 
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS: ' || COUNT(*) || ' emails in quarantine'
        ELSE '❌ FAIL: No emails in quarantine (expected some)'
    END as test_result
FROM emails_quarantine;

-- Test 3: Verify all active emails have contact linkage
SELECT 
    'ACTIVE EMAILS VERIFICATION:' as category,
    COUNT(*) as total_active_emails,
    COUNT(*) FILTER (WHERE contact_id IS NOT NULL) as emails_with_contacts,
    CASE 
        WHEN COUNT(*) = COUNT(*) FILTER (WHERE contact_id IS NOT NULL) 
        THEN '✅ ALL ACTIVE EMAILS HAVE CONTACTS'
        ELSE '❌ MISSING CONTACT LINKAGE'
    END as verification_status
FROM emails;

-- Test 4: Verify contacts-only compliance
SELECT 
    'CONTACTS-ONLY COMPLIANCE:' as test_name,
    CASE 
        WHEN (SELECT COUNT(*) FROM emails WHERE contact_id IS NULL) = 0 
        THEN '✅ FULLY COMPLIANT: All emails have contact_id'
        ELSE '❌ NOT COMPLIANT: ' || (SELECT COUNT(*) FROM emails WHERE contact_id IS NULL) || ' emails lack contact_id'
    END as compliance_status;

-- Test 5: Sample of emails with proper contact/project linking
SELECT 
    'SAMPLE PROPERLY LINKED EMAILS:' as category,
    e.id,
    e.subject,
    CASE WHEN e.contact_id IS NOT NULL THEN '✅ HAS CONTACT' ELSE '❌ NO CONTACT' END as contact_status,
    CASE WHEN e.project_id IS NOT NULL THEN '✅ HAS PROJECT' ELSE '○ NO PROJECT' END as project_status
FROM emails e
WHERE e.contact_id IS NOT NULL
ORDER BY e.created_at DESC
LIMIT 5;