// Seed script to create the 16 standard questions for Extra Info system
// These questions will be available globally for all tenants

import { storage } from './storage.js';
import type { InsertQuoteExtraInfoField } from '@shared/schema.js';

const STANDARD_QUESTIONS: Omit<InsertQuoteExtraInfoField, 'id' | 'createdAt' | 'updatedAt'>[] = [
  // Contact & Business Information
  {
    key: 'company_name',
    label: 'Company/Business Name',
    type: 'text',
    description: 'Full legal name of the company or business',
    validationRules: JSON.stringify({
      required: true,
      minLength: 2,
      maxLength: 200
    }),
    displayOrder: 1,
    isStandard: true,
    userId: null, // Global standard field
  },
  {
    key: 'primary_contact',
    label: 'Primary Contact Person',
    type: 'text',
    description: 'Full name of the main contact person',
    validationRules: JSON.stringify({
      required: true,
      minLength: 2,
      maxLength: 100
    }),
    displayOrder: 2,
    isStandard: true,
    userId: null,
  },
  {
    key: 'job_title',
    label: 'Job Title/Position',
    type: 'text',
    description: 'Professional title or position within the company',
    validationRules: JSON.stringify({
      required: false,
      maxLength: 100
    }),
    displayOrder: 3,
    isStandard: true,
    userId: null,
  },
  {
    key: 'business_address',
    label: 'Business Address',
    type: 'address',
    description: 'Full business address including street, city, postal code',
    validationRules: JSON.stringify({
      required: true,
      fields: {
        street: { required: true, maxLength: 200 },
        city: { required: true, maxLength: 100 },
        state: { required: false, maxLength: 100 },
        postcode: { required: true, maxLength: 20 },
        country: { required: true, maxLength: 100 }
      }
    }),
    displayOrder: 4,
    isStandard: true,
    userId: null,
  },
  {
    key: 'phone_number',
    label: 'Phone Number',
    type: 'phone',
    description: 'Primary business phone number',
    validationRules: JSON.stringify({
      required: true,
      pattern: '^[+]?[0-9\\s\\-\\(\\)]{10,20}$'
    }),
    displayOrder: 5,
    isStandard: true,
    userId: null,
  },
  {
    key: 'email_address',
    label: 'Email Address',
    type: 'email',
    description: 'Primary business email address',
    validationRules: JSON.stringify({
      required: true,
      pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
    }),
    displayOrder: 6,
    isStandard: true,
    userId: null,
  },

  // Project Specifics
  {
    key: 'project_start_date',
    label: 'Project Start Date',
    type: 'date',
    description: 'Expected project start date (dd/mm/yyyy format)',
    validationRules: JSON.stringify({
      required: true,
      format: 'dd/mm/yyyy',
      futureOnly: true
    }),
    displayOrder: 7,
    isStandard: true,
    userId: null,
  },
  {
    key: 'project_completion_date',
    label: 'Project Completion Date',
    type: 'date',
    description: 'Expected project completion date (dd/mm/yyyy format)',
    validationRules: JSON.stringify({
      required: true,
      format: 'dd/mm/yyyy',
      futureOnly: true,
      afterField: 'project_start_date'
    }),
    displayOrder: 8,
    isStandard: true,
    userId: null,
  },
  {
    key: 'budget_range',
    label: 'Budget Range',
    type: 'select',
    description: 'Approximate budget range for the project',
    validationRules: JSON.stringify({
      required: true,
      options: [
        { value: 'under_5k', label: 'Under £5,000' },
        { value: '5k_10k', label: '£5,000 - £10,000' },
        { value: '10k_25k', label: '£10,000 - £25,000' },
        { value: '25k_50k', label: '£25,000 - £50,000' },
        { value: 'over_50k', label: 'Over £50,000' }
      ]
    }),
    displayOrder: 9,
    isStandard: true,
    userId: null,
  },
  {
    key: 'project_requirements',
    label: 'Project Requirements/Scope',
    type: 'textarea',
    description: 'Detailed description of project requirements and scope',
    validationRules: JSON.stringify({
      required: true,
      minLength: 50,
      maxLength: 2000
    }),
    displayOrder: 10,
    isStandard: true,
    userId: null,
  },

  // Legal & Compliance
  {
    key: 'terms_conditions',
    label: 'Terms and Conditions Acceptance',
    type: 'checkbox',
    description: 'I agree to the terms and conditions',
    validationRules: JSON.stringify({
      required: true,
      mustBeTrue: true
    }),
    displayOrder: 11,
    isStandard: true,
    userId: null,
  },
  {
    key: 'privacy_policy',
    label: 'Privacy Policy Agreement',
    type: 'checkbox',
    description: 'I agree to the privacy policy',
    validationRules: JSON.stringify({
      required: true,
      mustBeTrue: true
    }),
    displayOrder: 12,
    isStandard: true,
    userId: null,
  },
  {
    key: 'data_protection_consent',
    label: 'Data Protection Consent',
    type: 'checkbox',
    description: 'I consent to the processing of my personal data as described in the privacy policy',
    validationRules: JSON.stringify({
      required: true,
      mustBeTrue: true
    }),
    displayOrder: 13,
    isStandard: true,
    userId: null,
  },

  // Additional Requirements
  {
    key: 'special_instructions',
    label: 'Special Instructions',
    type: 'textarea',
    description: 'Any special instructions or requirements',
    validationRules: JSON.stringify({
      required: false,
      maxLength: 1000
    }),
    displayOrder: 14,
    isStandard: true,
    userId: null,
  },
  {
    key: 'preferred_communication',
    label: 'Preferred Communication Method',
    type: 'select',
    description: 'How you prefer to be contacted',
    validationRules: JSON.stringify({
      required: true,
      options: [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone Call' },
        { value: 'sms', label: 'SMS/Text Message' },
        { value: 'whatsapp', label: 'WhatsApp' },
        { value: 'teams', label: 'Microsoft Teams' }
      ]
    }),
    displayOrder: 15,
    isStandard: true,
    userId: null,
  },
  {
    key: 'emergency_contact',
    label: 'Emergency Contact Details',
    type: 'text',
    description: 'Emergency contact name and phone number',
    validationRules: JSON.stringify({
      required: false,
      maxLength: 200,
      pattern: '^[a-zA-Z\\s]+ - [+]?[0-9\\s\\-\\(\\)]{10,20}$',
      placeholder: 'John Smith - +44 7700 900123'
    }),
    displayOrder: 16,
    isStandard: true,
    userId: null,
  }
];

export async function seedStandardQuestions(): Promise<void> {
  // Only seed if SEED_DEMO environment variable is explicitly set to true
  if (process.env.SEED_DEMO !== 'true') {
    console.log('🚫 SEED_DEMO not set to true - skipping standard questions seeding for clean tenant');
    return;
  }
  
  console.log('🌱 DEMO DATA: Starting to seed standard questions (SEED_DEMO=true)...');
  
  try {
    // Check if standard questions already exist
    const existingStandardQuestions = await storage.getQuoteExtraInfoFields();
    const standardQuestions = existingStandardQuestions.filter(q => q.isStandard);
    
    if (standardQuestions.length > 0) {
      console.log(`📋 DEMO DATA: Found ${standardQuestions.length} existing standard questions. Skipping seed.`);
      return;
    }
    
    // Create all standard questions
    console.log(`🌱 Creating ${STANDARD_QUESTIONS.length} standard questions...`);
    
    for (const question of STANDARD_QUESTIONS) {
      try {
        const created = await storage.createQuoteExtraInfoField(question);
        console.log(`✅ Created: ${question.key} - ${question.label}`);
      } catch (error) {
        console.error(`❌ Failed to create ${question.key}:`, error);
        throw error;
      }
    }
    
    console.log('🎉 Successfully seeded all standard questions!');
    
    // Verify the questions were created
    const finalCount = await storage.getQuoteExtraInfoFields();
    const finalStandardCount = finalCount.filter(q => q.isStandard).length;
    console.log(`✅ Verification: ${finalStandardCount} standard questions now exist in database`);
    
  } catch (error) {
    console.error('💥 Error seeding standard questions:', error);
    throw error;
  }
}

// If this file is run directly, execute the seeding
if (import.meta.url === `file://${process.argv[1]}`) {
  seedStandardQuestions()
    .then(() => {
      console.log('🌱 Seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}