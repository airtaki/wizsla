import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef } from 'react';
import { ApiError, api, describeError, unwrap } from '../api/client';
import { useToast } from '../components/toast';
import {
  applyToOverview,
  type CommandResult,
  type LightCommand,
  mergeCommands,
  mergeResults,
  type Overview,
  type Scene,
  type Target,
} from './model';
import { SCENES_KEY, STATE_KEY } from './queries';

interface Queued {
  target: Target;
  command: LightCommand;
}

async function send(
  target: Target,
  body: LightCommand,
): Promise<CommandResult[]> {
  switch (target.kind) {
    case 'all':
      return (await unwrap(api.PATCH('/state', { body }))).results;
    case 'room': {
      const params = { path: { ref: target.ref } };
      return (await unwrap(api.PATCH('/rooms/{ref}/state', { params, body })))
        .results;
    }
    case 'bulb': {
      const params = { path: { ref: target.ref } };
      return [await unwrap(api.PATCH('/bulbs/{ref}/state', { params, body }))];
    }
  }
}

/** One message about the bulbs that did not do what was asked. */
function problemsOf(results: CommandResult[]): string | null {
  const count = (status: CommandResult['status']) =>
    results.filter((r) => r.status === status).length;
  const parts = [
    count('offline') && `${count('offline')} izzó nem válaszolt`,
    count('unsupported') && `${count('unsupported')} izzó ezt nem tudja`,
    count('failed') && `${count('failed')} izzó hibát jelzett`,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(', ')}.` : null;
}

function describeBulbError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 504) return 'Az izzó nem válaszolt.';
    if (error.status === 409) return 'Az izzó le van tiltva.';
    if (error.status === 400) return `Ezt az izzó nem tudja: ${error.message}`;
  }
  return describeError(error);
}

/**
 * Sends light commands to one target. The screen changes at once; the
 * bulbs' answers then replace the guess.
 *
 * At most one command per target is on its way. Commands given meanwhile
 * (a slider being dragged) are folded into one, sent when the previous one
 * is done, so the last position always arrives last and nothing piles up.
 */
export function useLightControl(target: Target) {
  const queryClient = useQueryClient();
  const notify = useToast();
  const queue = useRef<{ busy: boolean; next: Queued | null }>({
    busy: false,
    next: null,
  });
  // Callers build the target inline; its JSON keeps the callbacks stable.
  const targetKey = JSON.stringify(target);
  const stableTarget = useMemo(
    () => JSON.parse(targetKey) as Target,
    [targetKey],
  );

  const run = useCallback(
    async (first: Queued): Promise<void> => {
      const q = queue.current;
      q.busy = true;
      for (let item: Queued | null = first; item; item = q.next) {
        q.next = null;
        try {
          const results = await send(item.target, item.command);
          // A newer command is waiting: its guess is closer than this answer.
          if (!q.next) {
            queryClient.setQueryData<Overview>(STATE_KEY, (overview) =>
              overview ? mergeResults(overview, results) : overview,
            );
          }
          const problems = problemsOf(results);
          if (problems && item.target.kind !== 'bulb') {
            notify(problems, 'error');
          }
        } catch (error) {
          notify(describeBulbError(error), 'error');
        }
      }
      q.busy = false;
      void queryClient.invalidateQueries({ queryKey: STATE_KEY });
    },
    [queryClient, notify],
  );

  return useCallback(
    (command: LightCommand) => {
      void queryClient.cancelQueries({ queryKey: STATE_KEY });
      const scenes = queryClient.getQueryData<Scene[]>(SCENES_KEY);
      queryClient.setQueryData<Overview>(STATE_KEY, (overview) =>
        overview
          ? applyToOverview(overview, stableTarget, command, scenes)
          : overview,
      );

      const q = queue.current;
      const item = { target: stableTarget, command };
      if (!q.busy) {
        void run(item);
      } else if (q.next?.target === stableTarget) {
        q.next = { ...item, command: mergeCommands(q.next.command, command) };
      } else {
        q.next = item;
      }
    },
    [queryClient, run, stableTarget],
  );
}
