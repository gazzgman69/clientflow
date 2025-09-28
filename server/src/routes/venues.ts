import { Router } from 'express';
import { venuesService } from '../services/venues';
import { geocodingService } from '../services/geocoding';
import { insertVenueSchema } from '@shared/schema';
import { z } from 'zod';
import { cleanupAllVenueAddresses, findVenuesWithAddressIssues } from '../scripts/cleanupVenueAddresses';

const router = Router();

// POST /api/venues/autocomplete - Get place predictions
router.post('/autocomplete', async (req, res) => {
  try {
    const validatedData = autocompleteSchema.parse(req.body);
    
    const predictions = await geocodingService.getPlacePredictions(
      validatedData.input,
      {
        sessionToken: validatedData.sessionToken,
        types: validatedData.types
      }
    );
    
    res.json({ predictions });
  } catch (error) {
    console.error('Error getting place predictions:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get place predictions'
      });
    }
  }
});

// POST /api/venues/suggest - Get venue suggestions from cache first, then Google Places API
router.post('/suggest', async (req, res) => {
  try {
    const validatedData = autocompleteSchema.parse(req.body);
    
    const suggestions = await venuesService.getSuggestions(
      validatedData.input,
      {
        sessionToken: validatedData.sessionToken,
        types: validatedData.types,
        cacheOnly: validatedData.cacheOnly
      }
    );
    
    res.json({ predictions: suggestions });
  } catch (error) {
    console.error('Error getting venue suggestions:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to get venue suggestions'
      });
    }
  }
});

// Schema for Google Places venue creation
const createFromGoogleSchema = z.object({
  placeId: z.string().min(1, 'Place ID is required'),
  sessionToken: z.string().optional()
});

// Schema for minimal venue creation
const createMinimalSchema = z.object({
  name: z.string().min(1, 'Venue name is required'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional()
});

// Schema for autocomplete request
const autocompleteSchema = z.object({
  input: z.string().min(1, 'Search input is required'),
  sessionToken: z.string().optional(),
  types: z.array(z.string()).optional(),
  cacheOnly: z.boolean().optional()
});

// POST /api/venues/from-google - Create venue from Google Place
router.post('/from-google', async (req, res) => {
  try {
    const validatedData = createFromGoogleSchema.parse(req.body);
    
    const venue = await venuesService.createFromGoogle(validatedData, (req as any).tenantId);
    
    // Track usage for caching
    await venuesService.trackVenueUsage(venue.id, (req as any).tenantId);
    
    res.status(201).json(venue);
  } catch (error) {
    console.error('Error creating venue from Google:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Failed to create venue from Google Place'
      });
    }
  }
});

// POST /api/venues/place-details - Get place details without creating venue
router.post('/place-details', async (req, res) => {
  try {
    const { placeId, sessionToken } = req.body;
    
    if (!placeId) {
      return res.status(400).json({ message: 'placeId is required' });
    }
    
    const placeDetails = await geocodingService.getPlaceDetails(placeId, sessionToken);
    res.json(placeDetails);
  } catch (error) {
    console.error('Error getting place details:', error);
    res.status(500).json({ 
      message: 'Failed to get place details',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/venues/minimal - Create minimal venue manually
router.post('/minimal', async (req, res) => {
  try {
    const validatedData = createMinimalSchema.parse(req.body);
    
    const venue = await venuesService.createMinimal(validatedData, (req as any).tenantId);
    
    res.status(201).json(venue);
  } catch (error) {
    console.error('Error creating minimal venue:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to create venue'
      });
    }
  }
});

// GET /api/venues/:id/map - Get static map URL for venue
router.get('/:id/map', async (req, res) => {
  try {
    const { id } = req.params;
    const { width, height, zoom } = req.query;
    
    const options = {
      width: width ? parseInt(width as string) : undefined,
      height: height ? parseInt(height as string) : undefined,
      zoom: zoom ? parseInt(zoom as string) : undefined
    };
    
    const mapUrl = await venuesService.getStaticMapUrl(id, (req as any).tenantId, options);
    
    if (!mapUrl) {
      return res.status(404).json({ 
        message: 'Venue not found or no location data available' 
      });
    }
    
    res.json({ mapUrl });
  } catch (error) {
    console.error('Error getting venue map:', error);
    res.status(500).json({ 
      message: 'Failed to generate map URL' 
    });
  }
});

// GET /api/venues/:id/maps-link - Get Google Maps link for venue
router.get('/:id/maps-link', async (req, res) => {
  try {
    const { id } = req.params;
    
    const mapsLink = await venuesService.getMapsLink(id, (req as any).tenantId);
    
    if (!mapsLink) {
      return res.status(404).json({ 
        message: 'Venue not found or no location data available' 
      });
    }
    
    res.json({ mapsLink });
  } catch (error) {
    console.error('Error getting venue maps link:', error);
    res.status(500).json({ 
      message: 'Failed to generate maps link' 
    });
  }
});

// POST /api/venues/:id/track-usage - Track venue usage for caching
router.post('/:id/track-usage', async (req, res) => {
  try {
    const { id } = req.params;
    
    await venuesService.trackVenueUsage(id, (req as any).tenantId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking venue usage:', error);
    res.status(500).json({ 
      message: 'Failed to track venue usage' 
    });
  }
});

// POST /api/venues/:id/enrich - Try to enrich a venue with Google Places data
router.post('/:id/enrich', async (req, res) => {
  try {
    const { id } = req.params;
    
    const enrichedVenue = await venuesService.tryAutoEnrichVenue(id, (req as any).tenantId);
    
    if (!enrichedVenue) {
      return res.status(404).json({ 
        message: 'Venue not found or already enriched' 
      });
    }
    
    // Apply same field mapping as venues list endpoint for frontend compatibility
    const mappedVenue = {
      ...enrichedVenue,
      zipCode: enrichedVenue.zip_code // Map zip_code to zipCode for frontend compatibility
    };
    
    res.json(mappedVenue);
  } catch (error) {
    console.error('Error enriching venue:', error);
    res.status(500).json({ 
      message: 'Failed to enrich venue'
    });
  }
});

// POST /api/venues - Create new venue with full field validation and deduplication
router.post('/', async (req, res) => {
  try {
    const validatedData = insertVenueSchema.parse(req.body);
    
    // Use findOrCreateVenue to ensure deduplication logic is applied
    const venue = await venuesService.findOrCreateVenue(validatedData, (req as any).tenantId);
    res.status(201).json(venue);
  } catch (error) {
    console.error('Error creating venue:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to create venue'
      });
    }
  }
});

// GET /api/venues - Get all venues with pagination
router.get('/', async (req, res) => {
  try {
    // Parse pagination parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
    const offset = (page - 1) * limit;
    
    // For lead capture forms and similar use cases, provide a simple limit-only option
    if (req.query.simple === '1') {
      const simpleLimit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const venues = await venuesService.getVenues((req as any).tenantId, simpleLimit);
      // Map database field names to frontend expected names
      const mappedVenues = venues.map(venue => ({
        ...venue,
        zipCode: venue.zipCode || venue.zip_code, // Handle both camelCase and snake_case
        contactPhone: venue.contactPhone || venue.contact_phone // FIXED: Map contact_phone to contactPhone
      }));
      return res.json(mappedVenues);
    }

    const venues = await venuesService.getVenues((req as any).tenantId, limit, offset);
    
    // Map database field names to frontend expected names
    const mappedVenues = venues.map(venue => ({
      ...venue,
      zipCode: venue.zipCode || venue.zip_code, // Handle both camelCase and snake_case
      contactPhone: venue.contactPhone || venue.contact_phone // FIXED: Map contact_phone to contactPhone
    }));
    
    // Get total count for pagination info
    const totalCount = await venuesService.getVenuesCount((req as any).tenantId);
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({
      venues: mappedVenues,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ 
      message: 'Failed to fetch venues' 
    });
  }
});

// GET /api/venues/address-issues - Find venues with potential address duplication issues
router.get('/address-issues', async (req, res) => {
  try {
    const issues = await findVenuesWithAddressIssues();
    res.json({
      success: true,
      count: issues.length,
      venues: issues
    });
  } catch (error) {
    console.error('Error finding venue address issues:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to find venue address issues'
    });
  }
});

// POST /api/venues/cleanup-addresses - Clean up all venue addresses with duplication issues
router.post('/cleanup-addresses', async (req, res) => {
  try {
    const results = await cleanupAllVenueAddresses();
    res.json({
      success: true,
      message: `Cleaned up ${results.length} venues with address issues`,
      results
    });
  } catch (error) {
    console.error('Error cleaning up venue addresses:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clean up venue addresses'
    });
  }
});

// GET /api/venues/:id - Get venue by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await venuesService.getVenue(id, (req as any).tenantId);
    
    if (!venue) {
      return res.status(404).json({ 
        message: 'Venue not found' 
      });
    }
    
    res.json(venue);
  } catch (error) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ 
      message: 'Failed to fetch venue' 
    });
  }
});

// PATCH /api/venues/:id - Update venue (partial)
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertVenueSchema.partial().parse(req.body);
    
    const venue = await venuesService.updateVenue(id, validatedData, (req as any).tenantId);
    
    if (!venue) {
      return res.status(404).json({ 
        message: 'Venue not found' 
      });
    }
    
    res.json(venue);
  } catch (error) {
    console.error('Error updating venue:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to update venue'
      });
    }
  }
});

// PUT /api/venues/:id - Update venue (full replace)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertVenueSchema.parse(req.body);
    
    const venue = await venuesService.updateVenue(id, validatedData, (req as any).tenantId);
    
    if (!venue) {
      return res.status(404).json({ 
        message: 'Venue not found' 
      });
    }
    
    res.json(venue);
  } catch (error) {
    console.error('Error updating venue:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation error', 
        errors: error.errors 
      });
    } else {
      res.status(500).json({ 
        message: 'Failed to update venue'
      });
    }
  }
});

// GET /api/venues/:id/deletion-preview - Get venue deletion preview
router.get('/:id/deletion-preview', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    // Check if venue exists
    const venue = await venuesService.getVenue(id, tenantId);
    if (!venue) {
      return res.status(404).json({ 
        message: 'Venue not found' 
      });
    }

    // Count associated projects and contacts
    const { default: storage } = await import('../../storage');
    const neon = await import('@neondatabase/serverless');
    const neonClient = neon.neon(process.env.DATABASE_URL!);
    
    // Count projects using this venue
    const projectCountResult = await neonClient(`
      SELECT COUNT(*) as count 
      FROM projects 
      WHERE venue_id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    const projectCount = parseInt((projectCountResult[0] as any).count);
    
    // Count contacts using this venue  
    const contactCountResult = await neonClient(`
      SELECT COUNT(*) as count 
      FROM contacts 
      WHERE venue_id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    const contactCount = parseInt((contactCountResult[0] as any).count);
    
    res.json({
      venue: {
        id: venue.id,
        name: venue.name,
        address: venue.address
      },
      associations: {
        projectCount,
        contactCount,
        totalCount: projectCount + contactCount
      },
      canDelete: true, // Always allow deletion but show warning
      message: projectCount + contactCount > 0 
        ? `This venue is linked to ${contactCount} contact(s) and ${projectCount} project(s). These references will be cleared if you proceed.`
        : 'This venue can be safely deleted.'
    });
  } catch (error) {
    console.error('Error getting venue deletion preview:', error);
    res.status(500).json({ 
      message: 'Failed to get deletion preview' 
    });
  }
});

// DELETE /api/venues/:id - Delete venue  
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = (req as any).tenantId;
    
    // Check if venue exists
    const venue = await venuesService.getVenue(id, tenantId);
    if (!venue) {
      return res.status(404).json({ 
        message: 'Venue not found' 
      });
    }

    // Clear venue references from contacts and projects to avoid foreign key constraint errors
    const neon = await import('@neondatabase/serverless');
    const neonClient = neon.neon(process.env.DATABASE_URL!);
    
    // Clear venue_id from contacts
    await neonClient(`
      UPDATE contacts 
      SET venue_id = NULL 
      WHERE venue_id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    // Clear venue_id from projects
    await neonClient(`
      UPDATE projects 
      SET venue_id = NULL 
      WHERE venue_id = $1 AND tenant_id = $2
    `, [id, tenantId]);
    
    // Now delete the venue
    const deleted = await venuesService.deleteVenue(id, tenantId);
    
    if (!deleted) {
      return res.status(500).json({ 
        message: 'Failed to delete venue after clearing references' 
      });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting venue:', error);
    res.status(500).json({ 
      message: 'Failed to delete venue' 
    });
  }
});

export default router;