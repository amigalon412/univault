/**
 * A faint neon grid behind the terminal. Graph-paper lines in the brand lime,
 * barely there, breathing on a slow ease so the whole field pulses softly. A
 * soft lime bloom drifts across and, screened over the lines, brightens the
 * grid where it passes -- the grid reading "under the neon". A vignette keeps
 * the edges dark so the content column stays legible.
 */
export function BackgroundGrid() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-black"
    >
      <div className="absolute inset-0 bg-neon-grid animate-grid-breathe" />
      <div className="absolute bg-neon-bloom animate-neon-drift mix-blend-screen" />
      <div className="absolute inset-0 bg-neon-vignette" />
    </div>
  );
}
