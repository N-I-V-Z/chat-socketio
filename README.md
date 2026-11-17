# Chat Application

## Description

A real-time chat application built with React.js, Node.js, and Socket.IO, featuring a two-user chat system with real-time messaging and user management.

## Features

- Real-time messaging between two users.
- User list display with selectable users.
- Persistent message storage.
- User authentication and logout functionality.
- Admin dashboard for user presence and audit events.
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

4. Build and start the client, server, and SQL Server:

   ```bash
   docker compose up --build
   ```

   Open `http://localhost:3000`. The API is available at `http://localhost:5000`.

The server creates the `ChatDb` database when needed and runs Sequelize migrations before starting. The initial migration creates the current `Users` and `Message` schema, and skips tables that already exist. SQL Server data is persisted in the `sqlserver_data` Docker volume.

Stop the containers with `docker compose down`. This keeps the database volume. To permanently remove the database data as well, use `docker compose down --volumes`.

Access tokens expire after 15 minutes. Refresh tokens are rotated, stored only as SHA-256 hashes in the database, and sent to the browser as an `HttpOnly` cookie. Set `COOKIE_SECURE=true` when serving over HTTPS. New passwords are bcrypt-hashed, and the auth migration hashes existing plaintext passwords. The auth migration adds a unique username index, so resolve any duplicate usernames in an existing database before starting the new version.

The server applies pending Sequelize migrations before starting. The admin migration adds user roles and audit-log storage, promotes the existing `nivz` account to admin, and gives new accounts the `user` role. It does not grant admin access to a newly registered account just because its username is `nivz`.

## Caching

Docker Compose starts Redis on the private application network; its port is not published to the host. Redis persistence is disabled and memory is limited to 128 MB with an LRU eviction policy. The database remains the source of truth.

The server caches the user directory for 60 seconds and conversation history for 30 seconds. Conversation entries include message text and are volatile: they are not written to disk and are invalidated after successful writes. If Redis is unavailable, the server logs the failure and loads data from SQL Server instead. For local development, `REDIS_URL` is optional; leave it unset to run without Redis, or point it to a Redis instance reachable by the server.

The client uses TanStack Query to cache chat and admin responses in browser memory. Queries are considered fresh for up to 30 seconds by default and unused data is garbage-collected after five minutes. Logging out clears the client query cache.

## Local Development

The database can still be started with Docker while running the client and server directly. Put `DB_HOST=localhost`, `DB_PORT=1433`, `DB_USER=sa`, `DB_PASSWORD`, `DB_NAME=ChatDb`, and a random `JWT_ACCESS_SECRET` of at least 32 bytes in the root `.env` file. For local HTTP, use `COOKIE_SECURE=false`. Then run:

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
