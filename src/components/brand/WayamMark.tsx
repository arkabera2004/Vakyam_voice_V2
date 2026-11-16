/** Official Vakyam app tile (white V holding a sound wave on saffron). Source: public/brand/vakyam-tile.png, 246 px. */
export function WayamMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <img
      src="/brand/vakyam-tile.png"
      alt="Vakyam"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
    />
  );
}
