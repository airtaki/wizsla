import { Power } from 'lucide-react';
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useRef,
  useState,
} from 'react';
import { cn } from './ui';

export function PowerButton({
  on,
  label,
  disabled,
  onToggle,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
        'disabled:opacity-40',
        on
          ? 'bg-amber-400 text-zinc-900 shadow-[0_0_24px_-4px] shadow-amber-400/70'
          : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
      )}
    >
      <Power className="size-5" strokeWidth={2.5} aria-hidden />
    </button>
  );
}

/** Movement (px) that tells a horizontal drag from a tap or a scroll. */
const DRAG_THRESHOLD = 6;

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  /** Called for every new value while dragging, and on a tap or key. */
  onChange: (value: number) => void;
  /** Text inside the slider, e.g. "64%". */
  format?: (value: number) => string;
  /** `fill`: a filled bar (brightness); `thumb`: a marker on a gradient. */
  variant?: 'fill' | 'thumb';
  trackStyle?: CSSProperties;
  icon?: ReactNode;
}

/**
 * A large slider for fingers. The whole bar responds: a tap jumps there, a
 * sideways drag follows the finger. Vertical swipes scroll the page and
 * change nothing, so scrolling past a slider is safe.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
  format = String,
  variant = 'fill',
  trackStyle,
  icon,
}: SliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ x: number; y: number; dragging: boolean } | null>(
    null,
  );
  const [dragValue, setDragValue] = useState<number | null>(null);
  const shown = Math.min(max, Math.max(min, dragValue ?? value));
  const ratio = max > min ? (shown - min) / (max - min) : 0;

  const valueAt = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round((min + t * (max - min)) / step) * step;
  };

  const update = (next: number) => {
    setDragValue(next);
    if (next !== (dragValue ?? value)) onChange(next);
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    gesture.current = { x: e.clientX, y: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    if (!g) return;
    if (!g.dragging) {
      const dx = Math.abs(e.clientX - g.x);
      if (dx < DRAG_THRESHOLD || dx < Math.abs(e.clientY - g.y)) return;
      g.dragging = true;
    }
    update(valueAt(e.clientX));
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const g = gesture.current;
    gesture.current = null;
    if (g && !g.dragging) update(valueAt(e.clientX));
    setDragValue(null);
  };

  const onPointerCancel = () => {
    gesture.current = null;
    setDragValue(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: step * 10,
      PageDown: -step * 10,
    };
    let next: number | undefined;
    if (e.key in keys) next = shown + keys[e.key];
    if (e.key === 'Home') next = min;
    if (e.key === 'End') next = max;
    if (next === undefined || disabled) return;
    e.preventDefault();
    next = Math.min(max, Math.max(min, next));
    if (next !== value) onChange(next);
  };

  return (
    <div
      ref={track}
      // Not <input type="range">: on iOS that moves only when its knob is
      // dragged; here the whole bar answers to a tap or a drag.
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={shown}
      aria-valuetext={format(shown)}
      aria-disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      style={trackStyle}
      className={cn(
        'relative h-12 touch-pan-y overflow-hidden rounded-2xl select-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500',
        !trackStyle && 'bg-zinc-200 dark:bg-zinc-800',
        disabled ? 'opacity-40' : 'cursor-pointer',
      )}
    >
      {variant === 'fill' ? (
        <div
          className="absolute inset-y-0 left-0 bg-amber-400"
          style={{ width: `${ratio * 100}%` }}
        />
      ) : (
        <div
          className="absolute top-1.5 bottom-1.5 w-2 -translate-x-1/2 rounded-full bg-white shadow ring-1 ring-black/20"
          style={{ left: `clamp(10px, ${ratio * 100}%, calc(100% - 10px))` }}
        />
      )}
      {variant === 'fill' ? (
        <>
          {/* Dark text over the filled part, theme text over the rest. */}
          <SliderText
            className="text-zinc-900"
            style={{ clipPath: `inset(0 ${100 - ratio * 100}% 0 0)` }}
            {...{ icon, label, value: format(shown) }}
          />
          <SliderText
            className="text-zinc-700 dark:text-zinc-200"
            style={{ clipPath: `inset(0 0 0 ${ratio * 100}%)` }}
            {...{ icon, label, value: format(shown) }}
          />
        </>
      ) : (
        <SliderText
          className="text-zinc-900"
          {...{ icon, label, value: format(shown) }}
        />
      )}
    </div>
  );
}

function SliderText({
  icon,
  label,
  value,
  className,
  style,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  className: string;
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center justify-between px-4 text-sm font-medium',
        className,
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** A row of mutually exclusive choices, like iOS's segmented control. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-zinc-200/70 p-1 dark:bg-zinc-800"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-9 rounded-lg text-sm font-medium transition-colors',
            option.value === value
              ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-600 dark:text-white'
              : 'text-zinc-600 dark:text-zinc-400',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Small dots in the colours a room or bulb shows. */
export function LightDots({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return (
      <span className="size-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
    );
  }
  return (
    <span className="flex -space-x-1">
      {colors.map((color) => (
        <span
          key={color}
          className="size-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      ))}
    </span>
  );
}
