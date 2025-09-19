# Form Field Mapping Audit Report

## Executive Summary

This comprehensive audit of the BusinessCRM form field mapping system revealed several critical issues affecting data integrity and form functionality. While the system has a robust foundation, there are significant gaps between UI form configurations and database schema that require immediate attention.

## Critical Issues Found

### 1. **CRITICAL: Missing Database Column** ❌ RESOLVED
- **Issue**: The `lead_capture_forms` table was missing a `questions` column, but the application code attempts to read and write to `form.questions`
- **Impact**: Form configurations could not be saved or retrieved, causing form builder failures
- **Location**: 
  - Code: `server/src/routes/lead-forms.ts` lines 110, 186, 229
  - Database: `lead_capture_forms` table schema
- **Status**: ✅ **FIXED** - Added `questions text` column and `tenant_id` column to database

### 2. **CRITICAL: Invalid Field Mappings** ❌ NEEDS FIX
- **Issue**: Form fields map to non-existent database columns
- **Impact**: Data submitted through forms is lost or incorrectly processed
- **Specific Problems**:
  
  | Form mapTo Value | Expected Database Field | Actual Status |
  |------------------|-------------------------|---------------|
  | `whatKindOfEventIsIt` | leads.event_type | ❌ **MISSING** |
  | `eventLocation` | leads.event_location | ❌ **MISSING** |
  | `leadName` | leads.full_name | ✅ **EXISTS** |
  | `leadEmail` | leads.email | ✅ **EXISTS** |
  | `leadPhoneNumber` | leads.phone | ✅ **EXISTS** |
  | `projectDate` | leads.project_date | ✅ **EXISTS** |
  | `nothing` | leads.notes | ✅ **EXISTS** |

### 3. **MODERATE: Venue Address Handling** ⚠️ PARTIALLY WORKING
- **Issue**: Venue autocomplete stores address components separately but mapping logic is complex
- **Impact**: Address data may be inconsistently stored
- **Details**: 
  - Form stores: `eventLocationCity`, `eventLocationState`, `eventLocationZipCode`, `eventLocationCountry`
  - Database has: `contacts.venue_address`, `venue_city`, `venue_state`, `venue_zip_code`, `venue_country`
  - Current workaround: `eventLocation` maps to `contacts.company` field (line 275 in lead-forms.ts)

## Current Field Mapping Analysis

### Working Mappings ✅
```javascript
const WORKING_MAPPINGS = {
  'leadName': 'leads.full_name',           // ✅ Maps correctly
  'leadEmail': 'leads.email',              // ✅ Maps correctly  
  'leadPhoneNumber': 'leads.phone',        // ✅ Maps correctly
  'projectDate': 'leads.project_date',     // ✅ Maps correctly
  'nothing': 'leads.notes'                 // ✅ Maps correctly (message field)
}
```

### Broken Mappings ❌
```javascript
const BROKEN_MAPPINGS = {
  'whatKindOfEventIsIt': 'MISSING_FIELD',  // ❌ No corresponding database field
  'eventLocation': 'MISSING_FIELD'        // ❌ No corresponding database field
}
```

### Workaround Mappings ⚠️
```javascript
const WORKAROUND_MAPPINGS = {
  'eventLocation': 'contacts.company',     // ⚠️ Incorrect mapping as workaround
  'whatKindOfEventIsIt': 'leads.lead_source' // ⚠️ Concatenated with " Event"
}
```

## Data Flow Analysis

### Form Submission Process
1. **Frontend** (`LeadFormHosted.tsx`): Collects form data using `mapTo` keys
2. **Validation**: Checks required fields against `question.mapTo` values (line 118)
3. **Submission**: Maps form values to backend expected format (lines 130-135)
4. **Backend Processing** (`lead-forms.ts`): Creates lead, contact, and project records
5. **Database Storage**: Stores data in respective tables

### Current Processing Logic Issues
```javascript
// PROBLEMATIC: Hard-coded field mapping in form submission handler
const leadData = {
  fullName: nameParts.fullName,
  firstName: nameParts.firstName,
  // ... other fields
  company: formData.eventLocation,     // ❌ Event location stored as company
  leadSource: formData.whatKindOfEventIsIt ? 
    `${formData.whatKindOfEventIsIt} Event` : 'Website Form', // ⚠️ Workaround
  notes: formData.nothing,             // ✅ Correct
  projectDate: formData.projectDate    // ✅ Correct
};
```

## Database Schema Completeness

### Missing Required Fields
The following fields are referenced in forms but missing from database:

#### Leads Table - Missing Fields
```sql
-- RECOMMENDED ADDITIONS:
ALTER TABLE leads ADD COLUMN event_type text;
ALTER TABLE leads ADD COLUMN event_location text;
```

#### Alternative: Use Existing Fields Better
```sql
-- OPTION: Repurpose existing fields
-- leads.lead_source can store event type
-- leads.notes can store combined location info
-- contacts.venue_address stores location details
```

## Form Builder Configuration

### Question Editor Options
The `QuestionEditor.tsx` provides these mapping options:

```javascript
const MAP_TO_OPTIONS = [
  { value: 'leadName', label: 'Lead name' },           // ✅ VALID
  { value: 'leadEmail', label: 'Lead email' },         // ✅ VALID
  { value: 'leadPhoneNumber', label: 'Lead phone' },   // ✅ VALID
  { value: 'whatKindOfEventIsIt', label: 'Event Type' }, // ❌ INVALID
  { value: 'eventLocation', label: 'Event Location' },  // ❌ INVALID
  { value: 'projectDate', label: 'Project date' },      // ✅ VALID
  { value: 'nothing', label: 'Nothing' },               // ✅ VALID
  { value: 'custom', label: 'Custom Field' }            // ⚠️ UNDEFINED
];
```

## Tenant Isolation Status

### Fixed Issues ✅
- **RESOLVED**: Added `tenant_id` column to `lead_capture_forms` table
- **RESOLVED**: Added `questions` column to `lead_capture_forms` table

### Remaining Tenant Issues
- ⚠️ Form submission uses hard-coded user ID: `'00000000-0000-0000-0000-000000000001'`
- ⚠️ No tenant validation in public form submission endpoint

## Recommendations

### Immediate Fixes Required (Priority 1)

1. **Add Missing Database Fields**
   ```sql
   ALTER TABLE leads ADD COLUMN event_type text;
   ALTER TABLE leads ADD COLUMN event_location text;
   ```

2. **Update Field Mapping Options**
   ```javascript
   // Update MAP_TO_OPTIONS in QuestionEditor.tsx
   { value: 'eventType', label: 'Event Type' },      // NEW: maps to leads.event_type
   { value: 'eventLocation', label: 'Event Location' } // NEW: maps to leads.event_location
   ```

3. **Fix Form Submission Handler**
   ```javascript
   // Update server/src/routes/lead-forms.ts
   const leadData = {
     // ... existing fields
     eventType: formData.eventType || formData.whatKindOfEventIsIt,
     eventLocation: formData.eventLocation,
     leadSource: formData.eventType ? `${formData.eventType} Lead` : 'Website Form'
   };
   ```

### Medium Priority Fixes (Priority 2)

1. **Improve Venue Address Handling**
   - Create dedicated venue address mapping logic
   - Ensure venue components are properly stored in contacts table

2. **Add Form Validation**
   - Validate mapTo values against allowed database fields
   - Prevent invalid mappings in form builder

### Long-term Improvements (Priority 3)

1. **Dynamic Field Mapping System**
   - Create configurable field mapping interface
   - Allow custom field definitions with database column management

2. **Enhanced Tenant Isolation**
   - Fix hard-coded user IDs in form submissions
   - Add tenant validation to all form endpoints

## Testing Recommendations

### Critical Path Testing
1. **Form Submission Flow**
   - Test all mapTo field combinations
   - Verify data reaches correct database fields
   - Check tenant isolation works correctly

2. **Form Builder Interface**
   - Test question creation with all field types
   - Verify form preview matches actual submission
   - Test form editing and persistence

### Edge Case Testing
1. **Invalid Mapping Handling**
   - Test forms with non-existent mapTo values
   - Verify graceful error handling
   - Test data recovery scenarios

## Implementation Status

- ✅ **COMPLETED**: Database schema fixes (questions + tenant_id columns)
- ❌ **PENDING**: Missing database field additions (event_type, event_location)
- ❌ **PENDING**: Form submission handler updates
- ❌ **PENDING**: Question editor mapping options updates

## Security Considerations

- ✅ Form submissions now support tenant isolation
- ⚠️ Public form endpoints need tenant validation
- ⚠️ Hard-coded user IDs should be replaced with proper tenant resolution

---

**Report Generated**: September 19, 2025  
**Audit Scope**: Form field mappings, database schema alignment, data integrity  
**Status**: Critical issues identified and partially resolved  
**Next Steps**: Implement Priority 1 recommendations immediately