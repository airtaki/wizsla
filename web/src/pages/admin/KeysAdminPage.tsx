import { Check, Copy, Plus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { type FormEvent, useState } from 'react';
import { LEVEL_HINTS } from '../../admin/describe';
import { EmptyState, Loaded } from '../../admin/components';
import { type ApiKey, useAdminMutation, useApiKeys } from '../../admin/queries';
import { type AccessLevel, api, unwrap } from '../../api/client';
import { Segmented } from '../../components/controls';
import { Sheet, useConfirm } from '../../components/sheet';
import { Button, Field, Input, ListGroup } from '../../components/ui';
import { formatAgo, formatDateTime } from '../../format';
import { LEVEL_LABELS } from '../../session/levels';
import { useSignedIn } from '../../session/session';

const LEVELS: { value: AccessLevel; label: string }[] = [
  { value: 'read', label: 'Olvasás' },
  { value: 'control', label: 'Vezérlés' },
  { value: 'admin', label: 'Admin' },
];

/** The link a QR code carries; the key stays after `#`, off the server. */
export function signInLink(key: string): string {
  return `${window.location.origin}/app/#key=${encodeURIComponent(key)}`;
}

export function KeysAdminPage() {
  const keys = useApiKeys();
  const [creating, setCreating] = useState(false);

  return (
    <Loaded
      title="API-kulcsok"
      query={keys}
      action={
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden />
          Új kulcs
        </Button>
      }
    >
      {(list) => {
        const active = list.filter((k) => !k.revokedAt);
        const revoked = list.filter((k) => k.revokedAt);
        return (
          <>
            {active.length === 0 ? (
              <EmptyState>Nincs érvényes kulcs.</EmptyState>
            ) : (
              <ListGroup>
                {active.map((key) => (
                  <KeyRow key={key.id} apiKey={key} />
                ))}
              </ListGroup>
            )}
            <p className="px-1 text-sm text-zinc-500">
              Minden eszköz és családtag kapjon saját kulcsot: így egyenként
              visszavonható, és a naplóban is látszik, ki mit kapcsolt.
            </p>
            {revoked.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer px-1 text-sm font-medium text-zinc-500">
                  Visszavont kulcsok ({revoked.length})
                </summary>
                <ListGroup className="mt-2 opacity-70">
                  {revoked.map((key) => (
                    <div key={key.id} className="px-4 py-3">
                      <p className="font-medium line-through">{key.name}</p>
                      <p className="text-sm text-zinc-500">
                        {LEVEL_LABELS[key.level]} · visszavonva{' '}
                        {formatDateTime(key.revokedAt!)}
                      </p>
                    </div>
                  ))}
                </ListGroup>
              </details>
            )}
            <NewKeySheet open={creating} onClose={() => setCreating(false)} />
          </>
        );
      }}
    </Loaded>
  );
}

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const session = useSignedIn();
  const [confirmElement, confirm] = useConfirm();
  const own = apiKey.id === session.id;
  const revoke = useAdminMutation(
    () =>
      unwrap(
        api.DELETE('/api-keys/{id}', {
          params: { path: { id: apiKey.id } },
        }),
      ),
    { done: () => `„${apiKey.name}” visszavonva.` },
  );

  const onRevoke = async () => {
    const ok = await confirm({
      title: `Visszavonod: ${apiKey.name}?`,
      message: own
        ? 'Ezzel a kulccsal vagy belépve: ez az eszköz is kijelentkezik.'
        : 'Az ezzel a kulccsal belépett eszközök kijelentkeznek. Nem vonható vissza.',
      confirmLabel: 'Visszavonás',
    });
    if (ok) revoke.mutate(undefined);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-medium">
          <span className="truncate">{apiKey.name}</span>
          {own && (
            <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              Ez az eszköz
            </span>
          )}
        </p>
        <p className="truncate text-sm text-zinc-500">
          {LEVEL_LABELS[apiKey.level]} · {apiKey.prefix}… ·{' '}
          {apiKey.lastUsedAt
            ? `használva ${formatAgo(apiKey.lastUsedAt)}`
            : 'még nem használták'}
        </p>
      </div>
      <Button
        variant="ghost"
        className="h-10 shrink-0 px-3 text-red-600 dark:text-red-400"
        disabled={revoke.isPending}
        onClick={() => void onRevoke()}
        aria-label={`${apiKey.name} visszavonása`}
      >
        Visszavonás
      </Button>
      {confirmElement}
    </div>
  );
}

function NewKeySheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [level, setLevel] = useState<AccessLevel>('control');
  const [created, setCreated] = useState<{ name: string; key: string } | null>(
    null,
  );

  const create = useAdminMutation(
    () => unwrap(api.POST('/api-keys', { body: { name: name.trim(), level } })),
    {
      done: (result) => {
        setCreated({ name: result.apiKey.name, key: result.key });
      },
    },
  );

  // The key is shown once; closing forgets it.
  const close = () => {
    setCreated(null);
    setName('');
    setLevel('control');
    onClose();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate(undefined);
  };

  return (
    <Sheet
      open={open}
      title={created ? `Kész: ${created.name}` : 'Új kulcs'}
      onClose={close}
    >
      {created ? (
        <CreatedKey apiKey={created.key} onDone={close} />
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Kinek vagy minek?">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Anna iPhone-ja"
              autoComplete="off"
              required
            />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Jogosultság
            </span>
            <Segmented
              label="Jogosultság"
              options={LEVELS}
              value={level}
              onChange={setLevel}
            />
            <span className="text-sm text-zinc-500">{LEVEL_HINTS[level]}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={close}>
              Mégse
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              Létrehozás
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function CreatedKey({
  apiKey,
  onDone,
}: {
  apiKey: string;
  onDone: () => void;
}) {
  const link = signInLink(apiKey);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[15px] text-zinc-600 dark:text-zinc-300">
        Olvasd be az iPhone kamerájával: a link megnyitja a Wizslát, és
        belépteti. A kulcs csak most látható, később nem.
      </p>
      <div className="mx-auto rounded-2xl bg-white p-4">
        <QRCodeSVG
          value={link}
          size={208}
          marginSize={0}
          title="Belépő QR-kód"
        />
      </div>
      <CopyRow label="Belépő link" value={link} />
      <CopyRow label="Kulcs" value={apiKey} />
      <Button onClick={onDone}>Kész</Button>
    </div>
  );
}

/**
 * Copies `value`. The Clipboard API needs HTTPS, which the LAN address may
 * not have yet, so the old way is the fallback.
 */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Field label={label}>
      <span className="flex gap-2">
        <Input
          readOnly
          value={value}
          onFocus={(e) => e.target.select()}
          className="font-mono text-sm"
        />
        <Button
          variant="secondary"
          className="shrink-0 px-3"
          aria-label={`${label} másolása`}
          onClick={() =>
            void copyText(value).then((ok) => {
              setCopied(ok);
              if (ok) setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          {copied ? (
            <Check className="size-4" aria-hidden />
          ) : (
            <Copy className="size-4" aria-hidden />
          )}
        </Button>
      </span>
    </Field>
  );
}
