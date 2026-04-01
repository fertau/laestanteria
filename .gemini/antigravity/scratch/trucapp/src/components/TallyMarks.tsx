/**
 * TallyMarks — Square scoring (Argentine truco style)
 * 1: top, 2: right, 3: bottom, 4: left, 5: diagonal cross
 * All marks use --color-tally regardless of team.
 */

interface TallyMarksProps {
  points: number;
}

const TallySquare = ({ count }: { count: number }) => {
  const size = 48;
  const pad = 6;
  const sw = 3;
  const color = 'var(--color-tally)';

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="score-square">
      {/* 1: Top line */}
      {count >= 1 && (
        <line x1={pad} y1={pad} x2={size - pad} y2={pad}
          stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* 2: Right line */}
      {count >= 2 && (
        <line x1={size - pad} y1={pad} x2={size - pad} y2={size - pad}
          stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* 3: Bottom line */}
      {count >= 3 && (
        <line x1={size - pad} y1={size - pad} x2={pad} y2={size - pad}
          stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* 4: Left line */}
      {count >= 4 && (
        <line x1={pad} y1={size - pad} x2={pad} y2={pad}
          stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* 5: Diagonal cross */}
      {count >= 5 && (
        <line x1={size - pad} y1={pad} x2={pad} y2={size - pad}
          stroke={color} strokeWidth={sw} strokeLinecap="round" />
      )}
    </svg>
  );
};

export const TallyMarks = ({ points }: TallyMarksProps) => {
  if (points <= 0) return null;

  const fullGroups = Math.floor(points / 5);
  const remainder = points % 5;

  return (
    <div className="flex flex-wrap justify-center gap-2 min-h-[48px] items-center">
      {Array.from({ length: fullGroups }).map((_, i) => (
        <TallySquare key={`full-${i}`} count={5} />
      ))}
      {remainder > 0 && <TallySquare key="partial" count={remainder} />}
    </div>
  );
};
