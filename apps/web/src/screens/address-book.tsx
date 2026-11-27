// Address book screen (UX-major Lane 5): save, label and manage the
// addresses you send to often, one entry per chain, and pick a saved
// label in Send instead of pasting the address again.
//
// Storage is local only (./address-book.ts, key bawa:address-book:v1):
// labels and public addresses, never secrets, never sent anywhere.
// Entries are only added here, by the user typing or pasting them —
// nothing is ever added from history or from a payment without being
// asked. Every saved address is validated for its chain before it is
// stored (the same validator Send uses), so a saved entry is a
// sendable entry; Send still re-validates when it is picked.
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/components/card';
import { CopyButton } from '../ui/components/copy-button';
import { AddressIdenticon } from '../ui/components/address-identicon';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { ChainSearchSelect, readLastUsedChain } from './chain-search-select';
import { ChainLogo } from './token-logo';
import { chainConfig, SUPPORTED_CHAINS, type ChainId } from '../wallet/chains';
import { validateRecipient } from '../wallet/send';
import {
  MAX_ADDRESS_BOOK_ENTRIES,
  newAddressBookId,
  readAddressBook,
  writeAddressBook,
  type AddressBookEntry,
} from '../wallet/address-book';

const RECENT_KEY = 'bawa:address-book-recent-chains';

export function AddressBookScreen() {
  const [entries, setEntries] = useState<AddressBookEntry[]>(() => readAddressBook());
  const [label, setLabel] = useState('');
  // P1 (Lane S1): the chain starts at the last-used chain.
  const [chain, setChain] = useState<ChainId>(() => readLastUsedChain(SUPPORTED_CHAINS) ?? 'eth');
  const [address, setAddress] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function resetForm() {
    setLabel('');
    setChain('eth');
    setAddress('');
    setEditingId(null);
  }

  function persist(next: AddressBookEntry[]) {
    setEntries(next);
    writeAddressBook(next);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    const cleanLabel = label.trim();
    const cleanAddress = address.trim();
    if (cleanLabel.length === 0) {
      setError('Give this address a label, so you can recognise it in Send.');
      setNote(null);
      return;
    }
    if (cleanAddress.length === 0) {
      setError('Enter an address to save.');
      setNote(null);
      return;
    }
    if (editingId === null && entries.length >= MAX_ADDRESS_BOOK_ENTRIES) {
      setError('The address book holds ' + MAX_ADDRESS_BOOK_ENTRIES + ' entries. Remove one before adding another.');
      setNote(null);
      return;
    }
    setError(null);
    setNote(null);
    setIsSaving(true);
    try {
      const result = await validateRecipient(chain, cleanAddress);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      if (editingId !== null) {
        const next = entries.map((entry) =>
          entry.id === editingId
            ? { id: entry.id, label: cleanLabel, address: cleanAddress, chain }
            : entry,
        );
        persist(next);
        setNote('Saved changes to ' + cleanLabel + '.');
      } else {
        const entry: AddressBookEntry = {
          id: newAddressBookId(),
          label: cleanLabel,
          address: cleanAddress,
          chain,
        };
        persist([...entries, entry]);
        setNote(cleanLabel + ' saved to your address book.');
      }
      resetForm();
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(entry: AddressBookEntry) {
    setLabel(entry.label);
    setChain(entry.chain);
    setAddress(entry.address);
    setEditingId(entry.id);
    setError(null);
    setNote(null);
    setConfirmDeleteId(null);
  }

  function handleDelete(entry: AddressBookEntry) {
    if (confirmDeleteId !== entry.id) {
      setConfirmDeleteId(entry.id);
      return;
    }
    persist(entries.filter((candidate) => candidate.id !== entry.id));
    setConfirmDeleteId(null);
    setNote(entry.label + ' removed from your address book.');
    if (editingId === entry.id) resetForm();
  }

  return (
    <section className="space-y-6" aria-labelledby="address-book-heading">
      <header className="space-y-2">
        <h1 id="address-book-heading" className="font-bold">
          Address book
        </h1>
        <p className="text-sm text-muted-foreground">
          Save frequent addresses with a label. Pick one in Send.
        </p>
        <p className="text-sm text-muted-foreground">
          Saved on this device only.
        </p>
      </header>

      <Card radius="xl">
        <CardHeader>
          <CardTitle>{editingId === null ? 'Add an address' : 'Edit saved address'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={(event) => void handleSave(event)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address-book-label">Label</Label>
              <Input
                id="address-book-label"
                type="text"
                placeholder="For example: Maya, Exchange, Savings"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                autoComplete="off"
              />
            </div>
            <ChainSearchSelect
              chains={SUPPORTED_CHAINS}
              value={chain}
              onChange={setChain}
              id="address-book-chain"
              recentKey={RECENT_KEY}
            />
            <div className="space-y-2">
              <Label htmlFor="address-book-address">Address</Label>
              <Input
                id="address-book-address"
                type="text"
                placeholder={
                  'Enter ' +
                  (/^[AEIOU]/i.test(chainConfig(chain).displayName) ? 'an ' : 'a ') +
                  chainConfig(chain).displayName +
                  ' address'
                }
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                autoComplete="off"
                aria-invalid={error !== null}
                aria-describedby={error !== null ? 'address-book-error' : undefined}
              />
              <p className="text-sm text-muted-foreground">
                Checked before saving.
              </p>
            </div>
            {error !== null && (
              <p id="address-book-error" role="alert" className="text-base text-destructive">
                {error}
              </p>
            )}
            {note !== null && (
              <p role="status" className="text-sm text-muted-foreground">
                {note}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="md" disabled={isSaving}>
                {isSaving ? 'Checking…' : editingId === null ? 'Save address' : 'Save changes'}
              </Button>
              {editingId !== null && (
                <Button type="button" variant="secondary" size="md" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">
          Saved addresses {entries.length > 0 ? '(' + entries.length + ')' : ''}
        </h2>
        {entries.length === 0 ? (
          <Card radius="xl">
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No addresses yet.
              </p>
              <Link
                to="/send"
                className="inline-block text-base font-medium text-primary underline underline-offset-4"
              >
                Go to Send
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card radius="xl">
                  <CardContent className="space-y-2">
                    <span className="flex flex-wrap items-center gap-2">
                      <ChainLogo chain={entry.chain} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{entry.label}</span>
                        <span className="block text-sm text-muted-foreground">
                          {chainConfig(entry.chain).displayName}
                        </span>
                      </span>
                      <CopyButton value={entry.address} label={'Copy ' + entry.label + ' address'} />
                    </span>
                    <span className="flex items-center gap-2 rounded-md bg-muted p-3">
                      {/* Lane P2-C (M6): the identicon pairs the saved
                          address — the entry is recognisable at a
                          glance, not just by reading hex. */}
                      <AddressIdenticon address={entry.address} size={24} />
                      <code className="min-w-0 flex-1 break-all text-sm">
                        {entry.address}
                      </code>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => handleEdit(entry)}>
                        Edit
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => handleDelete(entry)}>
                        {confirmDeleteId === entry.id ? 'Tap again to remove' : 'Remove'}
                      </Button>
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
