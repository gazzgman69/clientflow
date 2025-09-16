import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, User, Users } from "lucide-react";
import type { Contact, Client } from "@shared/schema";

interface ContactPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onContactSelect: (contactId: string, contactName: string, contactType?: 'contact' | 'client') => void;
}

export default function ContactPicker({ isOpen, onClose, onContactSelect }: ContactPickerProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch contacts and clients
  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Combine and filter contacts/clients based on search
  const allContacts = [
    ...(contacts || []).map(contact => ({
      id: contact.id,
      originalId: contact.id, // Keep original ID for API calls
      name: `${contact.firstName} ${contact.lastName}`,
      email: contact.email,
      company: contact.company,
      type: 'contact' as const
    })),
    ...(clients || []).map(client => ({
      id: client.id,
      originalId: client.id, // Keep original ID for API calls  
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      company: client.company,
      type: 'client' as const
    }))
  ];

  const filteredContacts = allContacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleContactSelect = (contact: typeof allContacts[0]) => {
    // Pass the original ID and type to prevent conflicts
    onContactSelect(contact.originalId, contact.name, contact.type);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Contact for Quote
          </DialogTitle>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-contact-search"
          />
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-auto">
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchTerm ? "No contacts found matching your search" : "No contacts found"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={`${contact.type}-${contact.id}`}>
                    <TableCell className="font-medium" data-testid={`contact-name-${contact.type}-${contact.id}`}>
                      {contact.name}
                    </TableCell>
                    <TableCell data-testid={`contact-email-${contact.type}-${contact.id}`}>
                      {contact.email || '-'}
                    </TableCell>
                    <TableCell data-testid={`contact-company-${contact.type}-${contact.id}`}>
                      {contact.company || '-'}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                        contact.type === 'contact' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {contact.type}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleContactSelect(contact)}
                        data-testid={`button-select-contact-${contact.type}-${contact.id}`}
                      >
                        Select
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-contact-picker">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}