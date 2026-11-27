import { Zap } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { KIND_LABELS } from '../../admin/describe';
import { Loaded } from '../../admin/components';
import {
  type Bulb,
  type Room,
  useAdminMutation,
  useBulbs,
  useRooms,
} from '../../admin/queries';
import { isValidSlug } from '../../admin/slug';
import { api, unwrap } from '../../api/client';
import { useConfirm } from '../../components/sheet';
import {
  Button,
  Card,
  Field,
  Input,
  Select,
  Switch,
} from '../../components/ui';
import { formatDateTime } from '../../format';
import { useIdentify } from './BulbsAdminPage';

const BULBS = { to: '/settings/bulbs', label: 'Izzók' };

export function BulbAdminPage() {
  const { slug = '' } = useParams();
  const bulbs = useBulbs();
  const rooms = useRooms();
  const bulb = bulbs.data?.find((b) => b.slug === slug);

  return (
    <Loaded title={bulb?.name ?? 'Izzó'} back={BULBS} query={bulbs}>
      {() =>
        bulb ? (
          <BulbForm key={bulb.id} bulb={bulb} rooms={rooms.data ?? []} />
        ) : (
          <Card role="alert">Nincs ilyen izzó.</Card>
        )
      }
    </Loaded>
  );
}

function BulbForm({ bulb, rooms }: { bulb: Bulb; rooms: Room[] }) {
  const navigate = useNavigate();
  const identify = useIdentify();
  const [confirmElement, confirm] = useConfirm();
  const [name, setName] = useState(bulb.name);
  const [slug, setSlug] = useState(bulb.slug);
  const [roomId, setRoomId] = useState(bulb.room?.id ?? 0);
  const [enabled, setEnabled] = useState(bulb.enabled);

  const slugError = isValidSlug(slug.trim())
    ? null
    : 'Csak kisbetű, szám és kötőjel; legalább egy betűvel.';
  const changed =
    name.trim() !== bulb.name ||
    slug.trim() !== bulb.slug ||
    roomId !== (bulb.room?.id ?? 0) ||
    enabled !== bulb.enabled;

  const save = useAdminMutation(
    () =>
      unwrap(
        api.PATCH('/bulbs/{ref}', {
          params: { path: { ref: String(bulb.id) } },
          body: {
            name: name.trim(),
            slug: slug.trim(),
            // The select's 0 is "no room", which the API takes as null.
            roomId: roomId === 0 ? null : roomId,
            enabled,
          },
        }),
      ),
    {
      done: (saved) => {
        if (saved.slug !== bulb.slug) {
          void navigate(`/settings/bulbs/${saved.slug}`, { replace: true });
        }
        return 'Mentve.';
      },
    },
  );

  const remove = useAdminMutation(
    () =>
      unwrap(
        api.DELETE('/bulbs/{ref}', {
          params: { path: { ref: String(bulb.id) } },
        }),
      ),
    {
      done: () => {
        void navigate(BULBS.to, { replace: true });
        return `„${bulb.name}” eltávolítva.`;
      },
    },
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (changed && name.trim() && !slugError) save.mutate(undefined);
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Eltávolítod: ${bulb.name}?`,
      message:
        'A Wizsla elfelejti az izzót. Ha a hálózaton marad, a következő felderítés újra felveszi, szoba nélkül.',
      confirmLabel: 'Eltávolítás',
    });
    if (ok) remove.mutate(undefined);
  };

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <Field label="Név">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              required
            />
          </Field>
          <Field label="Szoba">
            <Select
              value={roomId}
              onChange={(e) => setRoomId(Number(e.target.value))}
            >
              <option value={0}>Szoba nélkül</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="URL-azonosító"
            hint={
              slugError ?? 'Parancsok és linkek ezzel hivatkoznak az izzóra.'
            }
          >
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={slugError !== null}
            />
          </Field>
          <div className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium">Engedélyezve</span>
              <span className="block text-sm text-zinc-500">
                Letiltva nem vezérelhető, és a lekérdezés is kihagyja.
              </span>
            </span>
            <Switch
              checked={enabled}
              label="Engedélyezve"
              onChange={setEnabled}
            />
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            disabled={!bulb.enabled || identify.isPending}
            onClick={() => identify.mutate(bulb)}
          >
            <Zap className="size-4" aria-hidden />
            Azonosít
          </Button>
          <Button
            type="submit"
            disabled={!changed || !name.trim() || !!slugError || save.isPending}
          >
            Mentés
          </Button>
        </div>
      </form>

      <BulbFacts bulb={bulb} />

      <Button
        variant="ghost"
        className="text-red-600 dark:text-red-400"
        disabled={remove.isPending}
        onClick={() => void onDelete()}
      >
        Izzó eltávolítása
      </Button>
      {confirmElement}
    </>
  );
}

function BulbFacts({ bulb }: { bulb: Bulb }) {
  const facts: [string, string][] = [
    ['Típus', KIND_LABELS[bulb.kind] ?? bulb.kind],
    ...(bulb.kelvinMin && bulb.kelvinMax
      ? [['Fehér', `${bulb.kelvinMin}–${bulb.kelvinMax} K`] as [string, string]]
      : []),
    ['Modell', bulb.moduleName ?? '–'],
    ['Firmware', bulb.fwVersion ?? '–'],
    ['MAC-cím', bulb.mac.replace(/(..)(?!$)/g, '$1:')],
    ['IP-cím', `${bulb.ip}:${bulb.port}`],
    ['Utoljára látva', bulb.lastSeenAt ? formatDateTime(bulb.lastSeenAt) : '–'],
    ['Felvéve', formatDateTime(bulb.createdAt)],
  ];
  return (
    <Card>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
        {facts.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-zinc-500">{term}</dt>
            <dd className="min-w-0 truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
