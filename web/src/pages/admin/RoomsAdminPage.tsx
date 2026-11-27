import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight, GripVertical, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { EmptyState, Loaded } from '../../admin/components';
import {
  ROOMS_KEY,
  type Room,
  useAdminMutation,
  useRooms,
} from '../../admin/queries';
import { isValidSlug, slugify } from '../../admin/slug';
import { api, unwrap } from '../../api/client';
import { Sheet, useConfirm } from '../../components/sheet';
import { Button, cn, Field, Input, ListGroup } from '../../components/ui';

type Editing = { room: Room | null } | null;

export function RoomsAdminPage() {
  const rooms = useRooms();
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <Loaded
      title="Szobák"
      query={rooms}
      action={
        <Button onClick={() => setEditing({ room: null })}>
          <Plus className="size-4" aria-hidden />
          Új szoba
        </Button>
      }
    >
      {(list) => (
        <>
          {list.length === 0 ? (
            <EmptyState>Még nincs szoba. Hozd létre az elsőt!</EmptyState>
          ) : (
            <>
              <RoomList rooms={list} onEdit={(room) => setEditing({ room })} />
              <p className="px-1 text-sm text-zinc-500">
                A sorrendet a fogantyúval húzva változtathatod meg; így jelennek
                meg az Otthon oldalon is.
              </p>
            </>
          )}
          <RoomSheet
            key={editing?.room?.id ?? 'new'}
            editing={editing}
            nextSortOrder={Math.max(0, ...list.map((r) => r.sortOrder)) + 1}
            onClose={() => setEditing(null)}
          />
        </>
      )}
    </Loaded>
  );
}

function RoomList({
  rooms,
  onEdit,
}: {
  rooms: Room[];
  onEdit: (room: Room) => void;
}) {
  const queryClient = useQueryClient();
  const reorder = useAdminMutation(
    (changes: { slug: string; sortOrder: number }[]) =>
      Promise.all(
        changes.map(({ slug, sortOrder }) =>
          unwrap(
            api.PATCH('/rooms/{ref}', {
              params: { path: { ref: slug } },
              body: { sortOrder },
            }),
          ),
        ),
      ),
  );
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rooms.findIndex((r) => r.id === active.id);
    const to = rooms.findIndex((r) => r.id === over.id);
    const moved = arrayMove(rooms, from, to).map((room, index) => ({
      ...room,
      sortOrder: index + 1,
    }));
    queryClient.setQueryData<Room[]>(ROOMS_KEY, moved);
    reorder.mutate(
      moved
        .filter(
          (room) =>
            rooms.find((r) => r.id === room.id)?.sortOrder !== room.sortOrder,
        )
        .map(({ slug, sortOrder }) => ({ slug, sortOrder })),
    );
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable:
            'Szóközzel felveheted, a nyilakkal mozgathatod, újabb szóközzel leteheted.',
        },
      }}
    >
      <SortableContext items={rooms} strategy={verticalListSortingStrategy}>
        <ListGroup>
          {rooms.map((room) => (
            <RoomRow key={room.id} room={room} onEdit={() => onEdit(room)} />
          ))}
        </ListGroup>
      </SortableContext>
    </DndContext>
  );
}

function RoomRow({ room, onEdit }: { room: Room; onEdit: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: room.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative flex items-center bg-white dark:bg-zinc-900',
        isDragging && 'z-10 shadow-lg',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`${room.name} áthelyezése`}
        className="flex h-14 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-zinc-400 active:cursor-grabbing"
      >
        <GripVertical className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`${room.name} szerkesztése`}
        className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{room.name}</span>
          <span className="block truncate text-sm text-zinc-500">
            {room.bulbs.length === 0
              ? 'Nincs izzó'
              : `${room.bulbs.length} izzó`}{' '}
            · /{room.slug}
          </span>
        </span>
        <ChevronRight className="size-5 text-zinc-400" aria-hidden />
      </button>
    </div>
  );
}

function RoomSheet({
  editing,
  nextSortOrder,
  onClose,
}: {
  editing: Editing;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const room = editing?.room ?? null;
  const [name, setName] = useState(room?.name ?? '');
  const [slug, setSlug] = useState(room?.slug ?? '');
  const [confirmElement, confirm] = useConfirm();

  const derived = slugify(name);
  const effectiveSlug = slug.trim() || (room ? room.slug : derived);
  const slugError =
    effectiveSlug && !isValidSlug(effectiveSlug)
      ? 'Csak kisbetű, szám és kötőjel; legalább egy betűvel.'
      : null;
  const canSave = name.trim() !== '' && effectiveSlug !== '' && !slugError;

  const save = useAdminMutation(
    () => {
      const body = {
        name: name.trim(),
        ...(slug.trim() && slug.trim() !== room?.slug
          ? { slug: slug.trim() }
          : {}),
      };
      return room
        ? unwrap(
            api.PATCH('/rooms/{ref}', {
              params: { path: { ref: String(room.id) } },
              body,
            }),
          )
        : unwrap(
            api.POST('/rooms', {
              body: { ...body, sortOrder: nextSortOrder },
            }),
          );
    },
    {
      done: (saved) => {
        onClose();
        return room ? 'Mentve.' : `„${saved.name}” létrehozva.`;
      },
    },
  );

  const remove = useAdminMutation(
    (target: Room) =>
      unwrap(
        api.DELETE('/rooms/{ref}', {
          params: { path: { ref: String(target.id) } },
        }),
      ),
    {
      done: (_, target) => {
        onClose();
        return `„${target.name}” törölve.`;
      },
    },
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (canSave) save.mutate(undefined);
  };

  const onDelete = async () => {
    if (!room) return;
    const ok = await confirm({
      title: `Törlöd: ${room.name}?`,
      message:
        room.bulbs.length > 0
          ? `Az izzói (${room.bulbs.length}) megmaradnak, szoba nélkül.`
          : 'A szobában nincs izzó.',
      confirmLabel: 'Törlés',
    });
    if (ok) remove.mutate(room);
  };

  return (
    <>
      <Sheet
        open={editing !== null}
        title={room ? room.name : 'Új szoba'}
        onClose={onClose}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Név">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="pl. Nappali"
              autoComplete="off"
              required
            />
          </Field>
          <Field
            label="URL-azonosító"
            hint={
              slugError ??
              (room
                ? 'Parancsok és linkek ezzel hivatkoznak a szobára; ha megváltoztatod, azokat is frissíteni kell.'
                : 'Üresen hagyva a névből készül.')
            }
          >
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={room ? room.slug : derived || 'nappali'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={slugError !== null}
            />
          </Field>
          <div className="mt-1 grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={onClose}>
              Mégse
            </Button>
            <Button type="submit" disabled={!canSave || save.isPending}>
              {room ? 'Mentés' : 'Létrehozás'}
            </Button>
          </div>
          {room && (
            <Button
              variant="ghost"
              className="text-red-600 dark:text-red-400"
              disabled={remove.isPending}
              onClick={() => void onDelete()}
            >
              Szoba törlése
            </Button>
          )}
        </form>
      </Sheet>
      {confirmElement}
    </>
  );
}
