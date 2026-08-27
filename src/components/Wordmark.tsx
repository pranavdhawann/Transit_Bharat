/**
 * BharaTransit lockup. The shared T is the join between the two words and the
 * one place saffron appears in the shell (spec section 3.1) — drawn tall, like
 * a platform pole.
 */
export default function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`type-display text-[17px] tracking-tight ${className}`}>
      <span className="text-ink">Bhara</span>
      <span className="text-saffron">T</span>
      <span className="text-ink">ransit</span>
    </span>
  );
}
