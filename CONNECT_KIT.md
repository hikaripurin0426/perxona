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
| **Function Tool `update_learner_level`** | Optional Admin write path (`POST /api/tools/update-level`) |

## Live level progression

Signed-in learners start at **A1 (level 1)**. Every **5** learner chat messages, Firestore `level` increases by 1 (up to **C1 / 5**). Field `userMessageCount` tracks turns. Guests do not persist level.

## Env

Required for lessons + chatbot:

```
PERXONA_API_BASE_URL=
PERXONA_CONNECT_EMAIL=
PERXONA_CONNECT_PASSWORD=
PRESENTER_URL=
```

### Optional: chatbot Function Tool for Admin level writes

Connect tools may only call **public** hosts (no localhost). For local demos use a tunnel (e.g. ngrok) or a deployed URL.

```
AVILINGO_PUBLIC_BASE_URL=https://your-public-host
AVILINGO_TOOL_SECRET=long-random-string
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

On first tutor reply, the server ensures **Avilingo English Tutor** (with knowledge).
