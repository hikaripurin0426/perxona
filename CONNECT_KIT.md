# Connect Kit usage (Avilingo)

Avilingo leans on Perxona Connect Kit features for the hackathon demo.

## Connect features in use

| Feature | Where |
|--------|--------|
| `<sv-presenter>` | Live avatar stage |
| Connect token + catalogs | Avatar / voice / scene |
| Motion list + Motion Markup / `playMotion` | Gestures while speaking & listening |
| Presentation API `emotion` + `intensity` | Facial tone for replies |
| **Connect Chatbot** | Lesson conversation (no OpenAI required for chat) |
| Chatbot knowledge file | `content/avilingo-tutor-knowledge.txt` |
| **Connect Level Assessor chatbot** | CEFR-style level after ~3 user turns |
| **Function Tool `update_learner_level`** | Writes level to Firestore via `POST /api/tools/update-level` |

## Env

Required for lessons + chatbot:

```
PERXONA_API_BASE_URL=
PERXONA_CONNECT_EMAIL=
PERXONA_CONNECT_PASSWORD=
PRESENTER_URL=
```

### Level update via chatbot tool (recommended for demo)

Connect tools may only call **public** hosts (no localhost). For local demos use a tunnel (e.g. ngrok) or a deployed URL.

```
AVILINGO_PUBLIC_BASE_URL=https://your-public-host
AVILINGO_TOOL_SECRET=long-random-string
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Flow:

1. After ≥3 user turns, the client calls `POST /api/assess-level` with `messages` + Firebase `uid`.
2. **Avilingo Level Assessor** assesses the transcript.
3. When the tool is configured and `uid` is present, the chatbot calls **`update_learner_level`** → `POST /api/tools/update-level` (header `X-Avilingo-Tool-Key`) → Firebase Admin writes `users/{uid}`.
4. If the tool is unavailable (no public URL / Admin), the assess route falls back to Admin write, then the client Firestore write.

On first tutor reply, the server ensures **Avilingo English Tutor** (with knowledge).
On first level assessment, it ensures **Avilingo Level Assessor** (and registers the Function Tool when env is set).
