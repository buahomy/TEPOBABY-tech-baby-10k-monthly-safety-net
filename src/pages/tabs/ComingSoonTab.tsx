// Placeholder for tabs that aren't built yet (Interview, Connect).

type Props = { title: string; points: string[] };

export default function ComingSoonTab({ title, points }: Props) {
  return (
    <div className="tab-page">
      <header className="tab-header">
        <div>
          <p className="tab-kicker">Coming soon</p>
          <h1 className="tab-title">{title}</h1>
        </div>
      </header>
      <section className="block">
        <ul className="soon-list">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
