ShipMate AI v2 — Live Search Starter

IMPORTANT: This is a deployable starter package, not a hosted/live website yet.
It attempts to use Gemini API Google Search grounding for current research answers. It can only work after the server is deployed/run and a valid API key is configured. Search/model availability, quotas, and charges depend on Google AI Studio account terms; check usage before use.

LOCAL SETUP
1. Create a NEW key at https://aistudio.google.com/apikey (rotate the key shown in your screenshot).
2. Install Node.js 18+ on a computer.
3. Extract this ZIP; open terminal in this folder.
4. Run: npm install
5. Copy .env.example to .env and put the new key after GEMINI_API_KEY=
6. Run: npm start
7. Open http://localhost:3000

SECURITY
- Never paste the API key into the public HTML/JS or chat.
- On hosting, configure GEMINI_API_KEY as a server-side environment variable.
- The app stores business records/chat in this browser's local storage.

LIMITS
- Android web pages cannot freely open/control other apps such as Chrome. That requires a separate Android app and user-granted permissions/automation.
- No message-sending connector is installed. Message Approval only records approval status and NEVER sends messages. Every exact message must be reviewed/approved before any future sending integration is enabled.
- The app cannot be called live until you deploy/run it and configure the key.
