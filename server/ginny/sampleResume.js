// A fictional student's résumé for the recruiter demo, so visitors can see the ATS score without
// uploading anything. Same shape as a parsed, sanitized PDF: { experience, projects, skills, education }.

export const SAMPLE_RESUME = {
  experience: [
    "Software Engineering Intern, Northwind Logistics (May 2025 – Aug 2025)",
    "Built REST APIs in Python (FastAPI) and PostgreSQL for shipment tracking, serving 40K requests a day with p95 latency under 120 ms.",
    "Cut a nightly data pipeline from 2 hours to 18 minutes by batching SQL writes and adding indexes.",
    "Wrote unit and integration tests with pytest, raising coverage from 52% to 85%; shipped through GitHub Actions CI/CD.",
    "Teaching Assistant, Data Structures, State University (Jan 2025 – May 2025)",
    "Led weekly labs for 30 students on trees, graphs and dynamic programming; held office hours debugging Java and C++.",
  ],
  projects: [
    "Campus Eats: React + TypeScript web app with a Node.js/Express API and Redis cache, used by 600+ students to find open dining halls.",
    "Course Recommender: TF-IDF and cosine similarity over 4,000 course descriptions in Python (scikit-learn), deployed on AWS Lambda.",
    "Realtime Chat: WebSocket chat service in Go with Docker, load-tested to 2,000 concurrent connections.",
  ],
  skills: [
    "Python, Java, C++, TypeScript, JavaScript, Go, SQL, React, Node.js, Express, FastAPI, PostgreSQL, Redis, AWS, Docker, Git, GitHub Actions, REST APIs, Linux, pytest, scikit-learn",
  ],
  education: ["State University, B.S. in Computer Science, Expected May 2027, GPA 3.8"],
};
