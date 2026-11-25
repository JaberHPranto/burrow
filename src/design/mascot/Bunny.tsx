/**
 * Burrow's rabbit mascot. Pure SVG so it stays crisp at any size and themes
 * with the palette. Moods are used for empty states, success and errors.
 */

export type BunnyMood = "happy" | "curious" | "sleepy" | "oops";

interface BunnyProps {
  mood?: BunnyMood;
  size?: number;
  /** Peek out of a burrow hole instead of showing the full head. */
  peek?: boolean;
  title?: string;
}

const INK = "var(--ink)";
const FUR = "var(--cream)";
const BLUSH = "var(--coral)";

function Eyes({ mood }: { mood: BunnyMood }) {
  switch (mood) {
    case "sleepy":
      return (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M42 66q5 4 10 0" />
          <path d="M68 66q5 4 10 0" />
        </g>
      );
    case "oops":
      return (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round">
          <path d="M43 62l8 7M51 62l-8 7" />
          <path d="M69 62l8 7M77 62l-8 7" />
        </g>
      );
    case "happy":
      return (
        <g stroke={INK} strokeWidth="3.2" strokeLinecap="round" fill="none">
          <path d="M42 67q5-6 10 0" />
          <path d="M68 67q5-6 10 0" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="47" cy="65" r="4" fill={INK} />
          <circle cx="73" cy="65" r="4" fill={INK} />
          <circle cx="48.3" cy="63.6" r="1.3" fill="#fff" />
          <circle cx="74.3" cy="63.6" r="1.3" fill="#fff" />
        </g>
      );
  }
}

function Mouth({ mood }: { mood: BunnyMood }) {
  if (mood === "oops") {
    return <ellipse cx="60" cy="81" rx="3" ry="2.4" fill={INK} />;
  }
  return (
    <path
      d="M60 78q-3 4-7 2M60 78q3 4 7 2"
      fill="none"
      stroke={INK}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  );
}

export function Bunny({ mood = "curious", size = 96, peek = false, title }: BunnyProps) {
  const sleepyEars = mood === "sleepy";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={title ?? "Burrow bunny"}
    >
      <g stroke={INK} strokeWidth="3" strokeLinejoin="round">
        <ellipse
          cx="44"
          cy="30"
          rx="9.5"
          ry="23"
          fill={FUR}
          transform={sleepyEars ? "rotate(-105 50 50)" : "rotate(-12 44 30)"}
        />
        <ellipse
          cx="76"
          cy="30"
          rx="9.5"
          ry="23"
          fill={FUR}
          transform={sleepyEars ? "rotate(105 70 50)" : "rotate(12 76 30)"}
        />
      </g>
      {!sleepyEars && (
        <g fill="#f6b3aa">
          <ellipse cx="44" cy="32" rx="4" ry="14.5" transform="rotate(-12 44 32)" />
          <ellipse cx="76" cy="32" rx="4" ry="14.5" transform="rotate(12 76 32)" />
        </g>
      )}
      <ellipse cx="60" cy="70" rx="31" ry="27" fill={FUR} stroke={INK} strokeWidth="3" />
      <Eyes mood={mood} />
      <ellipse cx="39" cy="76" rx="5" ry="2.8" fill={BLUSH} opacity=".55" />
      <ellipse cx="81" cy="76" rx="5" ry="2.8" fill={BLUSH} opacity=".55" />
      <path
        d="M57 74h6l-3 3.4z"
        fill={BLUSH}
        stroke={INK}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <Mouth mood={mood} />
      {peek && (
        <g>
          <rect x="0" y="92" width="120" height="28" fill="var(--bg)" />
          <ellipse cx="60" cy="93" rx="52" ry="8" fill={INK} />
        </g>
      )}
    </svg>
  );
}
