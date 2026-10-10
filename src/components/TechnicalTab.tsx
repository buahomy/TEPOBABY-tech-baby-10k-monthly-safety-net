import { companyTiers } from "../data/mock";
import { Profile } from "../utils/storage";
import QuestionFeed from "./QuestionFeed";

export default function TechnicalTab({ profile }: { profile: Profile }) {
  return (
    <div className="grid">
      <QuestionFeed type="technical" />

      <section className="card">
        <h3>Company tiers & DS&A difficulty</h3>
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Tier</th>
              <th>DS&A level</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {companyTiers.map((c) => (
              <tr key={c.company}>
                <td>{c.company}</td>
                <td>{c.tier}</td>
                <td>{c.dsaLevel}</td>
                <td className="muted">{c.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Mock interviews</h3>
        <p>Practice with a real interviewer before the real thing.</p>
        <a className="button" href="https://www.tryexponent.com/practice" target="_blank" rel="noreferrer">
          Schedule on Exponent ↗
        </a>
        <p className="muted small">Direct scheduling inside TEPOBABY is planned once an Exponent integration is available.</p>
      </section>

      <section className="card placeholder">
        <h3>Pattern templates (NeetCode-style)</h3>
        <p className="muted">
          On hold. Template code for each concept (two pointers, sliding window, BFS/DFS, DP…) and the kinds of input each
          one usually handles.
        </p>
      </section>
    </div>
  );
}
