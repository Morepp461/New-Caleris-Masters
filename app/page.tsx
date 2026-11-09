export default function Home() {
  return (
    <main className="shell">
      <div className="eyebrow">THE MOTORSPORT ROLEPLAY UNIVERSE</div>
      <h1>CALERIS<br /><span>MASTERS</span></h1>
      <p className="intro">A new season begins with a new world.</p>
      <div className="status"><span className="dot" /> FOUNDATION RESET COMPLETE <span className="divider">/</span> GAME DEVELOPMENT STARTING</div>
      <style jsx>{`
        .shell { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: clamp(28px, 8vw, 112px); background: radial-gradient(ellipse at 78% 48%, rgba(133,24,24,.16), transparent 42%), linear-gradient(135deg,#090909 0%,#101010 60%,#0b0b0b 100%); }
        .eyebrow { color: var(--gold); font-size: 11px; font-weight: 700; letter-spacing: .24em; }
        h1 { margin: 26px 0 14px; font-family: Anton, Impact, sans-serif; font-size: clamp(64px, 13vw, 164px); font-weight: 400; line-height: .88; letter-spacing: -.025em; }
        h1 span { color: var(--red); }
        .intro { margin: 18px 0 0; color: #c5c0ba; font-size: clamp(14px, 2vw, 18px); }
        .status { display: flex; align-items: center; gap: 10px; margin-top: 64px; color: var(--muted); font-size: 10px; font-weight: 700; letter-spacing: .12em; }
        .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 0 4px rgba(201,166,107,.12); }
        .divider { color: var(--red); }
        @media (max-width: 560px) { .status { flex-wrap: wrap; line-height: 1.8; margin-top: 48px; } }
      `}</style>
    </main>
  );
}
