# Chat Application

## Description

A real-time chat application built with React.js, Node.js, and Socket.IO, featuring a two-user chat system with real-time messaging and user management.

## Features

- Real-time messaging between two users.
- User list display with selectable users.
- Persistent message storage.
- Per-contact unread counts, per-message read receipts, and message timestamps.
- User authentication and logout functionality.
- Admin dashboard for user presence and audit events.
- Kafka-backed chat events with a SQL Server transactional outbox.
- Redis server-side cache and TanStack Query client-side cache.
- Call.
- Call video.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/N-I-V-Z/chat-socketio.git
   cd chat-socketio
   ```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.

3. Create a root `.env` file from the example, choose a strong SQL Server password, and replace `JWT_ACCESS_SECRET` with a random value of at least 32 bytes (for example, `openssl rand -hex 32`):

   ```bash
   cp .env.example .env
   ```

4. Local Docker Compose builds the client with `http://localhost:5000` by default. To override this, set `LOCAL_API_ROOT` in the root `.env` file. This is a build-time setting; the browser needs a URL it can reach.

   For a production client image, create `client/.env.production` with the API URL reachable by the user's browser:

   ```dotenv
   REACT_APP_API_ROOT=https://api.example.com
   ```

   The production API URL is embedded into the static client bundle when you build the image directly without a `REACT_APP_API_ROOT` build argument:

   ```bash
   docker build -t nivz0911/chat-socketio-client:latest ./client
   ```

   The file is ignored by Git so each deployment can build with its own API URL. A VPS Compose service that uses this prebuilt image does not need a client API environment variable. Set the root `.env` variable `CLIENT_URL` to the frontend's public origin for server CORS.

5. Build and start the client, server, SQL Server, Redis, and Kafka:

   ```bash
   docker compose up --build
   ```

   Open `http://localhost:3000`. The API is available at `http://localhost:5000`.

The server creates the `ChatDb` database when needed and runs Sequelize migrations before starting. The initial migration creates the current `Users` and `Message` schema, and skips tables that already exist. SQL Server data is persisted in the `sqlserver_data` Docker volume; Kafka data is persisted in `kafka_data`. The single-node KRaft broker is intended for local development, not as a highly available production cluster.

Stop the containers with `docker compose down`. This keeps the SQL Server and Kafka volumes. To permanently remove both data sets as well, use `docker compose down --volumes`.

Access tokens expire after 15 minutes. Refresh tokens are rotated, stored only as SHA-256 hashes in the database, and sent to the browser as an `HttpOnly` cookie. Set `COOKIE_SECURE=true` when serving over HTTPS. New passwords are bcrypt-hashed, and the auth migration hashes existing plaintext passwords. The auth migration adds a unique username index, so resolve any duplicate usernames in an existing database before starting the new version.

The server applies pending Sequelize migrations before starting. Migration filenames use the current date followed by a six-digit sequence. The admin migration adds user roles and audit-log storage, promotes the existing `nivz` account to admin, and gives new accounts the `user` role. It does not grant admin access to a newly registered account just because its username is `nivz`.

Roles are restricted to `user` and `admin` by a named SQL Server `CHECK` constraint. The migration validates existing values before enforcing the constraint, so unexpected role values must be resolved rather than silently converted.

Messages belong to conversations, with membership recorded separately in `ConversationParticipants`. Existing direct messages are backfilled into one conversation per user pair. The chat API returns the newest 30 messages first; clients request earlier pages with the exclusive `beforeMessageId` cursor. Selecting a user resolves or creates their direct conversation.

## Caching

Docker Compose starts Redis on the private application network; its port is not published to the host. Redis persistence is disabled and memory is limited to 128 MB with an LRU eviction policy. The database remains the source of truth.

The server caches the user directory for 60 seconds and each conversation-history page for 30 seconds. Conversation entries include message text and are volatile: they are not written to disk; successful writes invalidate the latest page. If Redis is unavailable, the server logs the failure and loads data from SQL Server instead. For local development, `REDIS_URL` is optional; leave it unset to run without Redis, or point it to a Redis instance reachable by the server.

The Socket.IO Redis adapter fans events out across server replicas. Redis is required for realtime connections, call sessions, and presence. When Redis is unavailable, HTTP routes continue, `/readyz` returns `503`, and new realtime connections are rejected. Local development needs `REDIS_URL` when testing calls or sockets.

## Notifications and read state

SQL Server remains authoritative for messages, read receipts, and unread counts. A message, the sender's read receipt, and a `chat.message.created` outbox row are committed in one database transaction. The relay publishes outbox rows to Kafka and marks them published only after broker acknowledgement; failed delivery is retried with bounded backoff. Kafka delivery is at-least-once. The consumer records delivered event IDs in Redis for 24 hours and clients deduplicate messages by `MessageId`; duplicates remain possible around a process crash.

Kafka events contain identifiers rather than message bodies. Consumers load the message from SQL Server and emit it to authenticated Socket.IO user rooms. If Kafka is unavailable, message writes continue to persist in SQL Server and the outbox is retried after Kafka reconnects. Unread totals are recalculated from SQL Server on reconnect; per-user unread data is not stored in the shared user-directory cache.

The authenticated conversation API exposes unread counts per peer and accepts a `upToMessageId` cursor to mark messages read. The cursor must belong to the conversation, and receipt writes are idempotent. Existing messages are backfilled as read for current participants during migration because their historical read state is unknown. The chat marks a cursor after its message becomes sufficiently visible, displays unread badges beside contacts, and shows “Đã xem” for the latest outgoing message the other participant has read. Group-chat UI is not included.

- `GET /api/v1/users` lists users available to the authenticated user; `GET /api/v1/users/me` returns the current user.
- `GET /api/v1/messages?receiverId={userId}` lists direct messages; `POST /api/v1/messages` creates one.
- `PUT /api/v1/conversations/direct/:otherUserId` gets or creates the current user's direct conversation.
- `GET /api/v1/conversations/unread-summary` returns the authenticated user's unread counts.
- `GET` and `POST /api/v1/conversations/:conversationId/messages` list and create conversation messages.
- `PUT /api/v1/conversations/:conversationId/read-receipt` accepts `{ "upToMessageId": 123 }`.
- Socket.IO emits `conversationRead` to the other conversation participants after a read update.

Admin accounts can set `isActive` with `PATCH /api/v1/admin/users/:userId/status` and `{ "isActive": false }`; inactive accounts cannot log in, refresh, use authenticated APIs, or connect via Socket.IO. Calls carry a server-issued `callId` on every signaling event, and the server authorizes both participants against the Redis call session.

Message times use the browser's local time in `HH:mm` format. Messages are grouped under “Hôm nay”, “Hôm qua”, a Vietnamese weekday for recent days, or `dd/MM/yyyy` for older dates. Messages with a null legacy timestamp appear under “Không rõ thời gian” and do not receive a fabricated time.

The client uses TanStack Query to cache chat and admin responses in browser memory. Chat history uses 30-message pages and loads earlier messages when scrolling to the top while preserving the visible scroll position. Queries are considered fresh for up to 30 seconds by default and unused data is garbage-collected after five minutes. Logging out clears the client query cache.

## Local Development

### Client structure

The React client is organized by product feature under `client/src/features`: `auth` owns sign-in, registration, and the auth store; `chat` owns conversations, messaging, read receipts, and call media; `admin` owns user and audit views. Shared HTTP configuration, query keys, layout, and reusable controls live under `client/src/shared`. Keep server payload conversion in feature API or view-model modules rather than presentational components. The visual rules and semantic tokens are documented in `client/DESIGN.md`.

Run `npm --prefix client test -- --watchAll=false` and `npm --prefix client run build` after client changes. The root pre-commit hook runs the full server/client validation gate.

The infrastructure can be started with Docker while running the client and server directly. Put `DB_HOST=localhost`, `DB_PORT=1433`, `DB_USER=sa`, `DB_PASSWORD`, `DB_NAME=ChatDb`, `KAFKA_BROKERS=localhost:29092`, and a random `JWT_ACCESS_SECRET` of at least 32 bytes in the root `.env` file. For local HTTP, use `COOKIE_SECURE=false`. Start the database, Redis, and Kafka with `docker compose up -d db redis kafka`, then run:

```bash
cd server
npm install
npm start
```

In another terminal:

```bash
cd client
npm install
npm start
```

The server exposes `/livez` for process liveness and `/readyz` for DB, Redis, and Kafka readiness. Set `METRICS_TOKEN` to enable `/metrics`; scrape it with `Authorization: Bearer <token>`. Metrics include active sockets, rejected socket events, dependency state, rate limits, and Kafka consumer lag. Logs are structured JSON through Pino. To run a local load benchmark against a running server, set `LOAD_TEST_TOKEN` to a valid access token, optionally set `LOAD_TEST_URL`, `LOAD_TEST_CLIENTS`, and `LOAD_TEST_DURATION_MS`, then run `npm --prefix server run test:load`.

## Pre-commit Checks

The Husky pre-commit hook formats staged source/configuration files with Prettier, then runs the server tests, client tests, and client production build. A formatting or validation failure stops the commit. To enable the hook for local development, install the root tooling and both app dependencies:

```bash
npm install
npm --prefix server ci
npm --prefix client ci
```

Run formatting on staged files with `npm run format:staged`, or run tests and the build with `npm run validate`.

`npm start` in the server applies pending migrations automatically. To run migrations manually, use `npm run db:migrate`; to undo the latest migration, use `npm run db:migrate:undo`. The initial baseline migration intentionally does not drop tables when undone, so it cannot accidentally delete data in an existing database.

## Configuration

- Ensure that the backend server is running on `http://localhost:5000`.
- The frontend application runs on `http://localhost:3000`.

## API Responses

Successful endpoints return `{ "success": true, "data": ..., "message": ... }`. Errors return `{ "success": false, "data": null, "error": { "code": "...", "message": "..." } }`. HTTP status codes remain meaningful; logout is a JSON `200` response, and unknown routes use the same error envelope.

## Admin and Audit Logs

The admin dashboard is available at `/admin` to authenticated users with the `admin` role. Admins can view all registered accounts with their current Socket.IO online/offline state, and browse audit events with pagination and event-type filtering. Admin API access is enforced by the server, not only by the client route.

The audit log records registration, successful and failed login, logout, online/offline transitions, admin dashboard views, and message-send metadata. Message entries contain sender and recipient user IDs and event time only; message text is never stored in audit logs. Passwords, access/refresh tokens, cookies, IP addresses, and request bodies are not recorded. Audit entries are retained for 30 days and expired entries are removed at server startup and periodically while it is running.

## Usage

1. **Register**: Navigate to the registration page and create a new account.

2. **Login**: After registration, log in to the application using the newly created account.

3. **Select a user to chat**:
   - After successful login, you will see a list of users.
   - Select a user from the list to start a conversation.

4. **Send a message**:
   - Type your message in the input field and press Enter or click the "Send" button to send the message.

5. **Call**:
   - Click "Call" button to send a request to call.
   - After request is accepted, call popup will be displayed.

6. **Call Video**:
   - Click "Video Call" button to send a request to call video.
   - After request is accepted, video call popup will be displayed.

7. **Logout**:

- Click the "Logout" button to log out and return to the login page.

## Contributing

Feel free to open issues or submit pull requests if you find any bugs or want to add new features.

## Contact

For any questions or feedback, please reach out to [vothanhnhan106@gmail.com](mailto:vothanhnhan106@gmail.com).

##### &#169; 2024.N-I-V-Z. All rights reserved.
