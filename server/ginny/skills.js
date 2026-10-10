// Technical skills dictionary used by the hard-skills stage (BM25 exact-string matching).
// Each entry: canonical name → aliases (all matched case-insensitively as whole tokens).

const SKILLS = {
  // Languages
  Python: ["python"], Java: ["java"], "C++": ["c++", "cpp"], C: ["c"], "C#": ["c#", "csharp"], Go: ["golang", "go"],
  Rust: ["rust"], JavaScript: ["javascript", "js", "ecmascript"], TypeScript: ["typescript", "ts"], Kotlin: ["kotlin"],
  Swift: ["swift"], "Objective-C": ["objective-c"], Ruby: ["ruby"], PHP: ["php"], Scala: ["scala"], R: ["r"],
  MATLAB: ["matlab"], SQL: ["sql"], Bash: ["bash", "shell scripting", "shell"], Perl: ["perl"], Haskell: ["haskell"],
  OCaml: ["ocaml"], Lua: ["lua"], Dart: ["dart"], Verilog: ["verilog", "systemverilog"], VHDL: ["vhdl"], Assembly: ["assembly"],
  // Web / frameworks
  React: ["react", "react.js", "reactjs"], "Next.js": ["next.js", "nextjs"], Vue: ["vue", "vue.js"], Angular: ["angular"],
  Svelte: ["svelte"], "Node.js": ["node.js", "nodejs", "node"], Express: ["express", "express.js"], Django: ["django"],
  Flask: ["flask"], FastAPI: ["fastapi"], "Spring Boot": ["spring boot", "spring"], Rails: ["rails", "ruby on rails"],
  ".NET": [".net", "asp.net"], GraphQL: ["graphql"], "REST APIs": ["rest", "restful", "rest api", "rest apis"], gRPC: ["grpc"],
  HTML: ["html", "html5"], CSS: ["css", "css3", "tailwind", "sass"], Redux: ["redux"], "React Native": ["react native"],
  Flutter: ["flutter"], iOS: ["ios"], Android: ["android"], SwiftUI: ["swiftui"],
  // Data / ML
  PyTorch: ["pytorch"], TensorFlow: ["tensorflow"], Keras: ["keras"], "scikit-learn": ["scikit-learn", "sklearn"],
  Pandas: ["pandas"], NumPy: ["numpy"], Spark: ["spark", "pyspark"], Hadoop: ["hadoop"], Kafka: ["kafka"], Airflow: ["airflow"],
  dbt: ["dbt"], Tableau: ["tableau"], "Power BI": ["power bi"], "Machine Learning": ["machine learning", "ml"],
  "Deep Learning": ["deep learning"], NLP: ["nlp", "natural language processing"], "Computer Vision": ["computer vision"],
  LLMs: ["llm", "llms", "large language models"], RAG: ["rag", "retrieval-augmented generation"], CUDA: ["cuda"],
  Statistics: ["statistics", "statistical"], "A/B Testing": ["a/b testing", "ab testing", "experimentation"],
  // Databases
  PostgreSQL: ["postgresql", "postgres"], MySQL: ["mysql"], MongoDB: ["mongodb", "mongo"], Redis: ["redis"],
  DynamoDB: ["dynamodb"], Cassandra: ["cassandra"], Elasticsearch: ["elasticsearch", "opensearch"], SQLite: ["sqlite"],
  Snowflake: ["snowflake"], BigQuery: ["bigquery"], NoSQL: ["nosql"],
  // Cloud / infra
  AWS: ["aws", "amazon web services", "ec2", "s3", "lambda"], GCP: ["gcp", "google cloud"], Azure: ["azure"],
  Docker: ["docker", "containers", "containerization"], Kubernetes: ["kubernetes", "k8s"], Terraform: ["terraform"],
  Linux: ["linux", "unix"], "CI/CD": ["ci/cd", "continuous integration", "github actions", "jenkins"], Git: ["git", "github"],
  Microservices: ["microservices", "microservice"], "Distributed Systems": ["distributed systems", "distributed system"],
  "System Design": ["system design"], Networking: ["networking", "tcp/ip", "tcp", "http"], Security: ["security", "cybersecurity"],
  Ansible: ["ansible"], Prometheus: ["prometheus"], Grafana: ["grafana"], Nginx: ["nginx"],
  // CS fundamentals
  "Data Structures": ["data structures"], Algorithms: ["algorithms"], "Operating Systems": ["operating systems", "os"],
  "Object-Oriented Programming": ["object-oriented", "oop"], Concurrency: ["concurrency", "multithreading", "multi-threaded"],
  "Embedded Systems": ["embedded", "embedded systems", "firmware", "rtos"], Agile: ["agile", "scrum"], Testing: ["unit testing", "integration testing", "jest", "pytest"],
  Figma: ["figma"], Excel: ["excel"],
};

// Very short names and common words only count in their usual capitalization, so "go to",
// "the rest of" or "c." don't register as skills.
const EXACT_CASE = { c: "C", r: "R", go: "Go", os: "OS", ts: "TS", js: "JS", ml: "ML", rest: "REST", http: "HTTP", tcp: "TCP", node: "Node", shell: "Shell" };

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Regex that matches an alias as a whole token (handles C++, C#, .NET, CI/CD). */
export function aliasRegex(alias) {
  if (EXACT_CASE[alias]) return new RegExp(`(^|[^A-Za-z0-9+#.\-])${escape(EXACT_CASE[alias])}(?=$|[^A-Za-z0-9+#\-])`);
  return new RegExp(`(^|[^A-Za-z0-9+#.])${escape(alias)}(?=$|[^A-Za-z0-9+#])`, "i");
}

const ENTRIES = Object.entries(SKILLS).map(([name, aliases]) => ({ name, aliases, regexes: aliases.map(aliasRegex) }));

/** Canonical skill names found in `text`. */
export function findSkills(text) {
  return ENTRIES.filter((e) => e.regexes.some((r) => r.test(text))).map((e) => e.name);
}

export function skillAliases(name) {
  return ENTRIES.find((e) => e.name === name)?.regexes || [];
}
