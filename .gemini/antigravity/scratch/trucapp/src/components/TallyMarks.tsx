/**
 * TallyMarks — 5-stick counting system (4 vertical + 1 diagonal = 5)
 * All marks are the same color (--color-tally) regardless of team.
 */

interface TallyMarksProps {
  points: number;
}

const TallyGroup = ({ count }: { count: number }) => {
  // A complete group has 4 verticals + 1 diagonal (= 5 points)
  // A partial group has 1-4 verticals
  const sticks = Math.min(count, 4);
  const hasDiagonal = count >= 5;

  return (
    <div className="relative" style={{ width: 48, height: 56 }}>
      {/* Vertical sticks */}
      {Array.from({ length: sticks }).map((_, i) => (
        <div
          key={i}
          className="absolute bottom-0 rounded-sm tally-stick-animate"
          style={{
            left: 4 + i * 10,
            width: 3,
            height: 48,
            backgroundColor: 'var(--color-tally)',
          }}
        />
      ))}
      {/* Diagonal (5th point) */}
      {hasDiagonal && (
        <div
          className="absolute rounded-sm tally-diagonal-animate"
          style={{
            width: 52,
            height: 3,
            backgroundColor: 'var(--color-tally)',
            bottom: 24,
            left: -2,
            transform: 'rotate(-30deg)',
            transformOrigin: 'center',
          }}
        />
      )}
    </div>
  );
};

export const TallyMarks = ({ points }: TallyMarksProps) => {
  if (points <= 0) return null;

  const fullGroups = Math.floor(points / 5);
  const remainder = points % 5;

  return (
    <div className="flex flex-wrap justify-center gap-4 min-h-[56px] items-end">
      {Array.from({ length: fullGroups }).map((_, i) => (
        <TallyGroup key={`full-${i}`} count={5} />
      ))}
      {remainder > 0 && <TallyGroup key="partial" count={remainder} />}
    </div>
  );
};
