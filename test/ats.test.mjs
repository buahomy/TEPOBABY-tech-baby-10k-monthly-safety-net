// Unit tests for how the ATS reads a job description's requirements (npm run test:unit).
import assert from "node:assert/strict";
import { test } from "node:test";
import { requirements } from "../server/ginny/ats.js";

test("Salesforce-style headings: every requirement section is read", () => {
  const jd = `About Salesforce
Salesforce is the #1 AI CRM.
What You'll Actually Be Doing
- Architect, design, implement, test and deliver highly scalable products
- Develop test strategies, design automation frameworks, write unit/functional tests
You're Our Person If...
- Fluency in object-oriented programming/design
- Academic, professional or internship experience in one of Java, Python, Javascript, HTML, SQL or C++
Even Better If...
- Experience using Copilot, Cursor, Claude Code, Gemini or other agent-based frameworks
- Strong analytical and problem-solving skills
- Experience using telemetry and metrics to drive operational excellence`;
  const reqs = requirements(jd);
  assert.ok(reqs.some((r) => r.startsWith("Architect, design")), "reads “What You'll Actually Be Doing”");
  assert.ok(reqs.some((r) => r.startsWith("Fluency in object-oriented")), "reads “You're Our Person If...”");
  assert.ok(reqs.some((r) => r.startsWith("Experience using Copilot")), "reads “Even Better If...”");
  assert.ok(reqs.length >= 6, `found ${reqs.length}`);
});

test("a short bullet that mentions “skills” is a requirement, not a heading", () => {
  const jd = `Basic Qualifications
- Strong analytical and problem-solving skills
- Experience with Java or Python in a professional setting
Benefits
- Medical, dental and vision insurance for you and your family`;
  const reqs = requirements(jd);
  assert.ok(reqs.includes("Strong analytical and problem-solving skills"));
  assert.ok(!reqs.some((r) => /insurance/.test(r)), "benefits aren't requirements");
});

test("plain headings with a colon still work", () => {
  const jd = `What we are looking for:
- Experience with Java, Kotlin, or TypeScript from coursework or projects
- Familiarity with containers, such as Docker, and with GitHub Actions
- Working knowledge of Agile development practices such as sprints`;
  assert.equal(requirements(jd).length, 3);
});
