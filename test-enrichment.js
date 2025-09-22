// Simple test script to trigger venue enrichment
import fetch from 'node-fetch';

const VENUE_ID = 'e75de3c4-1edd-494a-8398-4015fa6e7a50';

async function enrichVenue() {
  try {
    console.log('🔍 Starting enrichment for The Post Barn...');
    
    // Get a CSRF token first
    const tokenResponse = await fetch('http://localhost:5000/', {
      credentials: 'include'
    });
    
    // Extract CSRF token from cookies or headers
    let csrfToken = '';
    const cookies = tokenResponse.headers.get('set-cookie');
    if (cookies) {
      const csrfMatch = cookies.match(/_csrf=([^;]+)/);
      if (csrfMatch) {
        csrfToken = csrfMatch[1];
      }
    }
    
    console.log('🔐 CSRF Token:', csrfToken);
    
    // Now call the enrichment endpoint
    const response = await fetch(`http://localhost:5000/api/venues/${VENUE_ID}/enrich`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken
      },
      credentials: 'include'
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Enrichment successful!');
      console.log('📍 Venue data:', JSON.stringify(result, null, 2));
    } else {
      const error = await response.text();
      console.log('❌ Enrichment failed:', response.status, error);
    }
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

enrichVenue();