// Unit tests for the job-feed rules (npm run test:unit). Node's built-in test runner, no setup.
import assert from "node:assert/strict";
import { test } from "node:test";
import { classify, isRemoteOrNyc, isTech, roleTrack } from "../server/jobs/classify.js";

test("level from the title", () => {
  const cases = {
    "Software Engineer, New Grad": "entry",
    "Software Engineer Intern": "internship",
    "Sales Development Representative": "entry",
    "Associate Product Manager": "entry",
    "Adobe Sales Academy Associate": "entry",
    "Explore Program Intern (Freshman)": "underclassmen",
    "Senior Software Engineer": null,
    "Staff Machine Learning Engineer": null,
    "Software Engineer II": null,
  };
  for (const [title, level] of Object.entries(cases)) assert.equal(classify(title), level, title);
});

test("role type, checked in order (sales before AI before product before data)", () => {
  const cases = {
    "Software Engineer, New Grad": "eng",
    "Sales Engineer, AI": "sales",
    "Solutions Engineer": "sales",
    "Account Executive": "sales",
    "Customer Success Associate": "sales",
    "Machine Learning Engineer Intern": "ai",
    "Data Scientist, Machine Learning": "ai",
    "Forward Deployed Engineer": "ai",
    "Associate Product Manager": "product",
    "Product Designer Intern": "product",
    "Data Analyst": "data",
    "Business Analyst": "data",
    "UI Engineer": "eng",
    "Finance Rotation Program": "other",
    "Customer Support Agent": "other",
  };
  for (const [title, track] of Object.entries(cases)) assert.equal(roleTrack(title), track, title);
});

test("tech roles beyond engineering count as tech; non-tech roles don't", () => {
  for (const t of ["Sales Development Representative", "Product Manager", "IT Support Specialist", "UX Researcher"]) assert.ok(isTech(t), t);
  for (const t of ["Sales Manager", "Recruiter", "Marketing Coordinator", "Registered Nurse"]) assert.ok(!isTech(t), t);
});

test("Remote / NYC: remote or the five boroughs, not New York State", () => {
  for (const loc of ["Remote", "New York, NY", "New York, New York, United States", "Brooklyn, NY", "NYC · Remote", "Hybrid - New York", "Remote in USA"]) assert.ok(isRemoteOrNyc(loc), loc);
  for (const loc of ["Albany, New York", "New York State", "San Francisco, CA", "Jersey City, NJ", ""]) assert.ok(!isRemoteOrNyc(loc), loc);
});
