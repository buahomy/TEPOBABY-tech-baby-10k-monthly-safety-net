// Who can see the Sierra OA practice (Interview → Technical → Sierra OA) and use its AI assistant.
// It's the author's personal prep, so it's limited to the signed-in emails in SIERRA_EMAILS
// (comma-separated), defaulting to the author's account. Checked on the server: /api/auth/me reports
// `sierra: true` only for these accounts, and /api/ginny/code-assist refuses everyone else.

const DEFAULT = "buahomy@whitman.edu";

const emails = () =>
  (process.env.SIERRA_EMAILS || DEFAULT)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const sierraAllowed = (email) => !!email && emails().includes(String(email).toLowerCase());
