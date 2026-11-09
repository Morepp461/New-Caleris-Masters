import Link from "next/link";\n\nconst stats = [
  { label: "MEMBERS", value: "00", note: "The grid is waiting" },
  { label: "TEAMS", value: "00", note: "No constructors registered" },
  { label: "CIRCULATING ¢P", value: "0", note: "Economy not activated" },
  { label: "SEASON", value: "—", note: "Pre-season foundation" },
];

const divisions = [
  { code: "01", name: "CALERIS PREMIO", tier: "TOP DIVISION", description: "The premier stage of Caleris competition.", status: "REGISTRATION NOT OPEN" },
  { code: "02", name: "CALERIS ZWEI", tier: "DEVELOPMENT DIVISION", description: "The next step for emerging teams and drivers.", status: "REGISTRATION NOT OPEN" },
];

const pillars = [
  { number: "01", title: "BUILD A CAREER", text: "Develop your driver, earn your place, and shape a career across seasons." },
  { number: "02", title: "RUN A TEAM", text: "Build a constructor, manage contracts, develop the car, and balance the books." },
  { number: "03", title: "RACE THE GRID", text: "Compete in server-run races shaped by driver skill, car performance, and strategy." },
  { number: "04", title: "MAKE YOUR MOVE", text: "Negotiate contracts, pursue sponsors, and make decisions that change the paddock." },
];

const authMessages: Record<string, string> = {
  success: "Discord login berhasil. Session Caleris Masters sudah aktif.",
  "account-not-provisioned": "Akun Discord belum ditautkan ke player. Hubungi operator untuk provisioning.",
  "account-unavailable": "Akses player sedang tidak aktif. Hubungi operator.",
  "oauth-denied": "Proses login dibatalkan atau verifikasi OAuth tidak valid.",
  "oauth-failed": "Discord belum dapat memverifikasi login. Silakan coba kembali.",
  "not-configured": "Discord login belum dikonfigurasi oleh pengelola Caleris Masters.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ auth?: string }> }) {
  const params = await searchParams;
  const authMessage = params.auth ? authMessages[params.auth] : undefined;

  return (
    <main>
      {authMessage && <div className="auth-notice" role="status">{authMessage}</div>}
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Caleris Masters home">
          <span className="brand-mark">C</span>
          <span className="brand-name">CALERIS <b>MASTERS</b></span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <a href="#universe">THE UNIVERSE</a>
          <Link href="/teams">TEAMS</Link>\n          <a href="#divisions">DIVISIONS</a>
          <a href="#systems">GAME SYSTEMS</a>
        </nav>
        <a className="login-link" href="/api/v1/auth/discord/start">PLAYER ACCESS <span>↗</span></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-content">
          <div className="eyebrow"><span className="eyebrow-line" /> THE MOTORSPORT ROLEPLAY UNIVERSE</div>
          <h1>MORE THAN<br /><em>A RACE.</em></h1>
          <p className="hero-copy">A living motorsport world. Build your career, lead a team, shape the paddock, and fight for the championship.</p>
          <div className="hero-actions">
            <a className="button-primary" href="#universe">EXPLORE CALERIS <span>↗</span></a>
            <a className="button-quiet" href="#divisions">DISCOVER THE GRID</a>
          </div>
        </div>
        <div className="hero-index"><span>CM</span><i /> 2026 / EST. IN PROGRESS</div>
        <div className="hero-caption">A NEW WORLD IS TAKING SHAPE</div>
      </section>

      <section className="status-strip" aria-label="Game status">
        <div className="status-heading"><span className="live-dot" /> WORLD STATUS</div>
        <div className="status-message">FOUNDATION PHASE <span>/</span> SEASON 00</div>
        <div className="status-right">CALERIS MASTERS <span>•</span> 2026</div>
      </section>

      <section className="overview section-wrap" id="universe">
        <div className="section-kicker">01 / THE WORLD RIGHT NOW</div>
        <div className="section-heading-row">
          <div><h2>THE GRID<br /><em>STARTS HERE.</em></h2></div>
          <p className="section-intro">Every championship has a beginning. Caleris is preparing its foundations before the first driver takes the start.</p>
        </div>
        <div className="stats-grid">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <div className="stat-label">{stat.label}</div>
              <div className="stat-value">{stat.value}</div>
              <div className="stat-note">{stat.note}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="divisions-section" id="divisions">
        <div className="section-wrap">
          <div className="section-kicker">02 / THE CHAMPIONSHIP STRUCTURE</div>
          <div className="section-heading-row">
            <h2>TWO GRIDS.<br /><em>ONE UNIVERSE.</em></h2>
            <p className="section-intro">A configurable competition structure built to grow with its community. More divisions can join as the championship evolves.</p>
          </div>
          <div className="division-grid">
            {divisions.map((division) => (
              <article className="division-card" key={division.code}>
                <div className="division-top"><span>DIVISION {division.code}</span><span>{division.tier}</span></div>
                <div className="division-name">{division.name}</div>
                <p>{division.description}</p>
                <div className="division-bottom"><span className="small-square" /> {division.status}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="systems section-wrap" id="systems">
        <div className="section-kicker">03 / BUILT AROUND YOUR DECISIONS</div>
        <div className="section-heading-row">
          <h2>YOUR ROLE.<br /><em>YOUR LEGACY.</em></h2>
          <p className="section-intro">Caleris connects the people, teams, money, and machinery behind a racing championship.</p>
        </div>
        <div className="pillar-grid">
          {pillars.map((pillar) => (
            <article className="pillar" key={pillar.number}>
              <span className="pillar-number">{pillar.number}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
              <span className="pillar-arrow">↗</span>
            </article>
          ))}
        </div>
      </section>

      <section className="access-section" id="access">
        <div className="section-wrap access-inner">
          <div>
            <div className="section-kicker">04 / PLAYER ACCESS</div>
            <h2>THE PADDOCK<br /><em>IS BEING BUILT.</em></h2>
            <p>Player registration and account access will open when the core game systems are ready.</p>
          </div>
          <div className="access-stamp"><span>CALERIS</span><b>COMING<br />INTO FORM</b><i>FOUNDATION PHASE · 2026</i></div>
        </div>
      </section>

      <footer className="footer">
        <a className="brand" href="#top"><span className="brand-mark">C</span><span className="brand-name">CALERIS <b>MASTERS</b></span></a>
        <span>AN INDEPENDENT MOTORSPORT ROLEPLAY UNIVERSE</span>
        <span>© 2026 CALERIS MASTERS</span>
      </footer>
    </main>
  );
}
