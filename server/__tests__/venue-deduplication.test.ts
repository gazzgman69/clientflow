import { venuesService } from '../src/services/venues';
import { storage } from '../storage';
import type { InsertVenue } from '@shared/schema';

// Mock storage
jest.mock('../storage', () => ({
  storage: {
    getVenues: jest.fn(),
    createVenue: jest.fn(),
    updateVenue: jest.fn(),
  }
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

describe('Venue Deduplication', () => {
  const testTenantId = 'test-tenant-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return existing venue when duplicate detected by place_id', async () => {
    const existingVenue = {
      id: 'venue-123',
      name: 'Test Venue',
      placeId: 'google-place-123',
      useCount: 5,
      tenantId: testTenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newVenueData: InsertVenue = {
      name: 'Test Venue',
      placeId: 'google-place-123',
      tenantId: testTenantId,
    };

    // Mock getVenues to return existing venue
    mockStorage.getVenues.mockResolvedValue([existingVenue as any]);
    // Mock updateVenue to return updated venue
    mockStorage.updateVenue.mockResolvedValue({ ...existingVenue, useCount: 6 } as any);

    const result = await venuesService.findOrCreateVenue(newVenueData, testTenantId);

    expect(result.id).toBe('venue-123');
    expect(mockStorage.createVenue).not.toHaveBeenCalled();
    expect(mockStorage.updateVenue).toHaveBeenCalledWith(
      'venue-123',
      {
        useCount: 6,
        lastUsedAt: expect.any(Date)
      },
      testTenantId
    );
  });

  it('should return existing venue when duplicate detected by exact name+address match', async () => {
    const existingVenue = {
      id: 'venue-456',
      name: 'The Post Barn',
      address: 'The Post Barn, Snelsmore Common, Berkshire, RG14 3AL',
      useCount: 2,
      tenantId: testTenantId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newVenueData: InsertVenue = {
      name: ' The Post Barn ', // Note: extra spaces to test normalization
      address: 'The Post Barn, Snelsmore Common, Berkshire, RG14 3AL',
      tenantId: testTenantId,
    };

    // Mock getVenues for findExactVenueMatch method
    mockStorage.getVenues.mockResolvedValue([existingVenue as any]);
    mockStorage.updateVenue.mockResolvedValue({ ...existingVenue, useCount: 3 } as any);

    const result = await venuesService.findOrCreateVenue(newVenueData, testTenantId);

    expect(result.id).toBe('venue-456');
    expect(mockStorage.createVenue).not.toHaveBeenCalled();
    expect(mockStorage.updateVenue).toHaveBeenCalledWith(
      'venue-456',
      {
        useCount: 3,
        lastUsedAt: expect.any(Date)
      },
      testTenantId
    );
  });

  it('should create new venue when no duplicates found', async () => {
    const newVenueData: InsertVenue = {
      name: 'New Unique Venue',
      address: 'Unique Address',
      tenantId: testTenantId,
    };

    const createdVenue = {
      id: 'venue-789',
      ...newVenueData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock getVenues to return empty array (no existing venues)
    mockStorage.getVenues.mockResolvedValue([]);
    mockStorage.createVenue.mockResolvedValue(createdVenue as any);

    const result = await venuesService.findOrCreateVenue(newVenueData, testTenantId);

    expect(result.id).toBe('venue-789');
    expect(mockStorage.createVenue).toHaveBeenCalledWith(newVenueData, testTenantId);
    expect(mockStorage.updateVenue).not.toHaveBeenCalled();
  });

  it('should respect tenant isolation - different tenants can have identical venues', async () => {
    const tenantAVenue = {
      id: 'venue-tenant-a',
      name: 'Same Venue Name',
      address: 'Same Address',
      tenantId: 'tenant-a',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const newVenueDataTenantB: InsertVenue = {
      name: 'Same Venue Name',
      address: 'Same Address',
      tenantId: 'tenant-b',
    };

    const createdVenueTenantB = {
      id: 'venue-tenant-b',
      ...newVenueDataTenantB,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock getVenues to return tenant-a venue (should not match for tenant-b)
    mockStorage.getVenues.mockResolvedValue([tenantAVenue as any]);
    mockStorage.createVenue.mockResolvedValue(createdVenueTenantB as any);

    const result = await venuesService.findOrCreateVenue(newVenueDataTenantB, 'tenant-b');

    expect(result.id).toBe('venue-tenant-b');
    expect(mockStorage.createVenue).toHaveBeenCalledWith(newVenueDataTenantB, 'tenant-b');
  });
});