import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Token {
  name: string;
  description: string;
}

interface TokenCategory {
  label: string;
  tokens: Token[];
}

const TOKEN_CATEGORIES: TokenCategory[] = [
  {
    label: 'Contact Information',
    tokens: [
      { name: 'FirstName', description: 'Contact first name' },
      { name: 'LastName', description: 'Contact last name' },
      { name: 'FullName', description: 'Contact full name' },
      { name: 'Email', description: 'Contact email address' },
      { name: 'Phone', description: 'Contact phone number' },
      { name: 'Company', description: 'Contact company name' },
    ],
  },
  {
    label: 'Contact Address',
    tokens: [
      { name: 'Address1', description: 'Street address line 1' },
      { name: 'Address2', description: 'Street address line 2' },
      { name: 'City', description: 'City' },
      { name: 'State', description: 'State (US)' },
      { name: 'Province', description: 'Province (Canada)' },
      { name: 'Zip', description: 'ZIP code (US)' },
      { name: 'PostalCode', description: 'Postal code (Canada)' },
      { name: 'Country', description: 'Country' },
    ],
  },
  {
    label: 'Project Information',
    tokens: [
      { name: 'ProjectName', description: 'Project name' },
      { name: 'ProjectType', description: 'Project type/status' },
      { name: 'ProjectDate', description: 'Project date' },
      { name: 'ProjectLocation', description: 'Project location/venue' },
      { name: 'ProjectAddress', description: 'Project full address' },
      { name: 'ProjectNotes', description: 'Project notes' },
    ],
  },
  {
    label: 'Document Links',
    tokens: [
      { name: 'InvoiceLink', description: 'Latest invoice link' },
      { name: 'QuoteLink', description: 'Latest quote link' },
      { name: 'ContractLink', description: 'Latest contract link' },
      { name: 'ClientPortalLink', description: 'Client portal link' },
    ],
  },
  {
    label: 'Payment Information',
    tokens: [
      { name: 'PaymentSchedule', description: 'Payment schedule details' },
      { name: 'BalanceDue', description: 'Outstanding balance' },
    ],
  },
  {
    label: 'Business Information',
    tokens: [
      { name: 'BusinessName', description: 'Your business name' },
      { name: 'MyFirstName', description: 'Your first name' },
      { name: 'MyLastName', description: 'Your last name' },
      { name: 'MyFullName', description: 'Your full name' },
      { name: 'MyEmail', description: 'Your email address' },
      { name: 'MyPhone', description: 'Your phone number' },
    ],
  },
  {
    label: 'Other',
    tokens: [
      { name: 'CurrentDate', description: 'Today\'s date' },
    ],
  },
];

interface TokenDropdownProps {
  onInsert: (tokenName: string) => void;
}

export default function TokenDropdown({ onInsert }: TokenDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="button-insert-token"
        >
          INSERT TOKEN
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" align="start">
        <DropdownMenuLabel>Insert Dynamic Field</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {TOKEN_CATEGORIES.map((category, idx) => (
          <div key={category.label}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {category.label}
              </DropdownMenuLabel>
              {category.tokens.map((token) => (
                <DropdownMenuItem
                  key={token.name}
                  onClick={() => onInsert(token.name)}
                  className="flex flex-col items-start py-2"
                  data-testid={`token-${token.name.toLowerCase()}`}
                >
                  <div className="font-medium">{`{{${token.name}}}`}</div>
                  <div className="text-xs text-muted-foreground">{token.description}</div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {idx < TOKEN_CATEGORIES.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
