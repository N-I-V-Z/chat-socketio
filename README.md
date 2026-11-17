# Chat Application

## Description

A real-time chat application built with React.js, Node.js, and Socket.IO, featuring a two-user chat system with real-time messaging and user management.

## Features

- Real-time messaging between two users.
- User list display with selectable users.
- Persistent message storage.
- User authentication and logout functionality.
- Call.
- Call video.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/N-I-V-Z/chat-socketio.git
   cd chat-socketio
   ```

2. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.

3. Create a root `.env` file from the example and choose a strong SQL Server password:

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

## Local Development

The database can still be started with Docker while running the client and server directly. Configure the database variables in `server/.env` (`DB_HOST=localhost`, `DB_PORT=1433`, `DB_USER=sa`, `DB_PASSWORD`, and `DB_NAME=ChatDb`), then run:

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

`npm start` in the server applies pending migrations automatically. To run migrations manually, use `npm run db:migrate`; to undo the latest migration, use `npm run db:migrate:undo`. The initial baseline migration intentionally does not drop tables when undone, so it cannot accidentally delete data in an existing database.

## Configuration

- Ensure that the backend server is running on `http://localhost:5000`.
- The frontend application runs on `http://localhost:3000`.

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

77. **Logout**:
   - Click the "Logout" button to log out and return to the login page.

## Contributing

Feel free to open issues or submit pull requests if you find any bugs or want to add new features.

## Contact

For any questions or feedback, please reach out to [vothanhnhan106@gmail.com](mailto:vothanhnhan106@gmail.com).

##### &#169; 2024.N-I-V-Z. All rights reserved.
