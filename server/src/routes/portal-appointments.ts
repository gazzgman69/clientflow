import express from 'express';
import { storage } from '../../storage';
import { googleCalendarService } from '../../services/google-calendar';
import { insertEventSchema, type Event } from '@shared/schema';

const router = express.Router();

// Get available appointment slots
router.get("/availability", async (req, res) => {
  try {
    const contactId = req.headers.contactid as string;
    const { startDate, endDate, duration = '60' } = req.query as {
      startDate?: string;
      endDate?: string;
      duration?: string;
    };

    if (!contactId) {
      return res.status(401).json({ error: 'Contact authentication required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    // Get existing appointments to check availability
    const start = new Date(startDate);
    const end = new Date(endDate);
    const existingEvents: Event[] = await storage.getEventsByDateRange(start, end);

    // Generate available slots (9 AM to 5 PM, Monday to Friday)
    const availableSlots = [];
    const slotDuration = parseInt(duration as string);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      // Skip weekends
      if (date.getDay() === 0 || date.getDay() === 6) continue;

      // Generate hourly slots from 9 AM to 5 PM
      for (let hour = 9; hour < 17; hour += (slotDuration / 60)) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);
        
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + slotDuration);

        // Check if slot conflicts with existing appointments
        const hasConflict = existingEvents.some(event => {
          if (!event.startDate || !event.endDate) return false;
          const eventStart = new Date(event.startDate);
          const eventEnd = new Date(event.endDate);
          return (slotStart < eventEnd && slotEnd > eventStart);
        });

        if (!hasConflict) {
          availableSlots.push({
            startTime: slotStart.toISOString(),
            endTime: slotEnd.toISOString(),
            // Format for display (dd/MM/yyyy HH:mm)
            displayStart: `${slotStart.toLocaleDateString('en-GB')} ${slotStart.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
            displayEnd: `${slotEnd.toLocaleDateString('en-GB')} ${slotEnd.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
          });
        }
      }
    }

    res.json(availableSlots);
  } catch (error: any) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Get appointments for a contact
router.get("/appointments", async (req, res) => {
  try {
    const contactId = req.headers.contactid as string;
    
    if (!contactId) {
      return res.status(401).json({ error: 'Contact authentication required' });
    }

    const contact = await storage.getContactById(contactId);
    if (!contact || !contact.email) {
      return res.status(400).json({ error: 'Contact not found or missing email' });
    }

    // Get appointments where contact is involved
    const events: Event[] = await storage.getEventsByContactEmail(contact.email);
    
    const formatted = events.map(event => ({
      ...event,
      // Format dates for dd/MM/yyyy HH:mm display
      startDate: event.startDate ? new Date(event.startDate).toLocaleDateString('en-GB') + ' ' + 
                 new Date(event.startDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      endDate: event.endDate ? new Date(event.endDate).toLocaleDateString('en-GB') + ' ' + 
               new Date(event.endDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
      createdAt: event.createdAt?.toLocaleDateString('en-GB'),
    }));

    res.json(formatted);
  } catch (error: any) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Book new appointment
router.post("/appointments", async (req, res) => {
  try {
    const contactId = req.headers.contactid as string;
    const { title, description, startDate, endDate, location } = req.body;

    if (!contactId) {
      return res.status(401).json({ error: 'Contact authentication required' });
    }
    if (!title || !startDate || !endDate) {
      return res.status(400).json({ error: 'Title, start date, and end date required' });
    }

    const contact = await storage.getContactById(contactId);
    if (!contact) {
      return res.status(400).json({ error: 'Contact not found' });
    }

    // Check availability
    const start = new Date(startDate);
    const end = new Date(endDate);
    const existingEvents: Event[] = await storage.getEventsByDateRange(start, end);
    
    const hasConflict = existingEvents.some(event => {
      if (!event.startDate || !event.endDate) return false;
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      return (start < eventEnd && end > eventStart);
    });

    if (hasConflict) {
      return res.status(400).json({ error: 'Time slot is not available' });
    }

    // Create event
    const event = insertEventSchema.parse({
      title,
      description,
      startDate: start,
      endDate: end,
      location,
      attendees: contact.email ? [contact.email] : [],
      status: 'confirmed',
      source: 'portal',
      reminders: [15], // 15 minute reminder
    });

    const newEvent = await storage.createEvent(event);

    // Note: Google Calendar sync functionality would be implemented here
    // when proper individual event sync is available

    res.json({
      ...newEvent,
      startDate: start.toLocaleDateString('en-GB') + ' ' + 
                 start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
      endDate: end.toLocaleDateString('en-GB') + ' ' + 
               end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
  } catch (error: any) {
    console.error('Error booking appointment:', error);
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Reschedule appointment
router.put("/appointments/:eventId/reschedule", async (req, res) => {
  try {
    const { eventId } = req.params;
    const contactId = req.headers.contactid as string;
    const { startDate, endDate } = req.body;

    if (!contactId) {
      return res.status(401).json({ error: 'Contact authentication required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    const event = await storage.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const contact = await storage.getContactById(contactId);
    if (!contact) {
      return res.status(400).json({ error: 'Contact not found' });
    }

    // Verify contact has permission to reschedule this appointment
    if (!event.attendees?.includes(contact.email || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check new time slot availability
    const start = new Date(startDate);
    const end = new Date(endDate);
    const existingEvents: Event[] = await storage.getEventsByDateRange(start, end);
    
    const hasConflict = existingEvents.some(otherEvent => {
      if (otherEvent.id === eventId) return false; // Exclude current event
      if (!otherEvent.startDate || !otherEvent.endDate) return false;
      const eventStart = new Date(otherEvent.startDate);
      const eventEnd = new Date(otherEvent.endDate);
      return (start < eventEnd && end > eventStart);
    });

    if (hasConflict) {
      return res.status(400).json({ error: 'New time slot is not available' });
    }

    // Update appointment
    const updatedEvent = await storage.updateEvent(eventId, {
      startDate: start,
      endDate: end,
    });

    // Note: Google Calendar sync functionality would be implemented here
    // when proper individual event sync is available

    res.json({
      ...updatedEvent,
      startDate: start.toLocaleDateString('en-GB') + ' ' + 
                 start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
      endDate: end.toLocaleDateString('en-GB') + ' ' + 
               end.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    });
  } catch (error: any) {
    console.error('Error rescheduling appointment:', error);
    res.status(500).json({ error: 'Failed to reschedule appointment' });
  }
});

// Cancel appointment
router.delete("/appointments/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const contactId = req.headers.contactid as string;

    if (!contactId) {
      return res.status(401).json({ error: 'Contact authentication required' });
    }

    const event = await storage.getEventById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const contact = await storage.getContactById(contactId);
    if (!contact) {
      return res.status(400).json({ error: 'Contact not found' });
    }

    // Verify contact has permission to cancel this appointment
    if (!event.attendees?.includes(contact.email || '')) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mark as cancelled instead of deleting
    await storage.updateEvent(eventId, {
      status: 'cancelled',
    });

    // Note: Google Calendar sync functionality would be implemented here
    // when proper individual event sync is available

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling appointment:', error);
    res.status(500).json({ error: 'Failed to cancel appointment' });
  }
});

export default router;