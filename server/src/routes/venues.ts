import { Router } from 'express';
import { venuesService } from '../services/venues';
import { geocodingService } from '../services/geocoding';
import { insertVenueSchema } from '@shared/schema';
import { z } from 'zod';

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
  types: z.array(z.string()).optional()
});

// POST /api/venues/from-google - Create venue from Google Place
router.post('/from-google', async (req, res) => {
  try {
    const validatedData = createFromGoogleSchema.parse(req.body);
    
    const venue = await venuesService.createFromGoogle(validatedData);
    
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
    
    const venue = await venuesService.createMinimal(validatedData);
    
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
    
    const mapUrl = await venuesService.getStaticMapUrl(id, options);
    
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
    
    const mapsLink = await venuesService.getMapsLink(id);
    
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

// GET /api/venues - Get all venues
router.get('/', async (req, res) => {
  try {
    const venues = await venuesService.getVenues();
    res.json(venues);
  } catch (error) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ 
      message: 'Failed to fetch venues' 
    });
  }
});

// GET /api/venues/:id - Get venue by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await venuesService.getVenue(id);
    
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

// PUT /api/venues/:id - Update venue
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertVenueSchema.partial().parse(req.body);
    
    const venue = await venuesService.updateVenue(id, validatedData);
    
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

// DELETE /api/venues/:id - Delete venue
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await venuesService.deleteVenue(id);
    
    if (!deleted) {
      return res.status(404).json({ 
        message: 'Venue not found' 
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