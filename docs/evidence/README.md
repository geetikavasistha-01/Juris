# Slice Evidence Files

This directory records the empirical evidence files produced at the conclusion of each development slice, as mandated by PRD Section 3 (Engineering Principle 4) and Section 12.

## Protocol for Evidence Files

Every slice concludes with `docs/evidence/<slice>.md` detailing:

1. Exact commands executed (with all secrets strictly redacted).
2. Observed outputs, test logs, and runtime behavior.
3. Screenshots or recordings of user interfaces and visual interactions.
4. A clear, explicit "Not Verified" section documenting items deferred or dependent on external staging infrastructure.
