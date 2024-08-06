# Chat Application

## Description

A real-time chat application built with React.js, Node.js, and Socket.IO, featuring a two-user chat system with real-time messaging and user management.

## Features

- Real-time messaging between two users.
- User list display with selectable users.
- Persistent message storage.
- User authentication and logout functionality.
- Call video.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/N-I-V-Z/chat-socketio.git
   cd chat-socketio
   ```

2. Install dependencies:

- Install dependences for Front-end

   ```bash
   cd client
   npm install
   ```

- Install dependences for Back-end

   ```bash
   cd server
   npm install
   ```

## Database Setup

1. **Configure the database**:
   - Ensure that you have SQL Server installed and running.
   - Create a new database named `ChatDb`.

2. **Run the SQL script**:
   - Navigate to the `db` folder in your project directory.
   - Execute the `ChatDb.sql` file to set up the database schema and initial data.

   You can use SQL Server Management Studio (SSMS) or another SQL client to run the script. Open the `ChatDb.sql` file and execute it in your SQL Server environment.

3. **Update configuration**:
   - The database configuration can be found in the file `./server/config/config.js`.

   Make sure the configuration matches your SQL Server setup.

## Running the Application

1. Start the backend server:

   ```bash
   cd server
   npm start
   ```

2. Start the frontend application:

   ```bash
   cd client
   npm start
   ```

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
  
5. **Call Video**:
   - Click "Video Call" button to send a request to call video.
   - After request is accepted, video call popup will be displayed.

5. **Logout**:
   - Click the "Logout" button to log out and return to the login page.

## Contributing

Feel free to open issues or submit pull requests if you find any bugs or want to add new features.

## Contact

For any questions or feedback, please reach out to [vothanhnhan106@gmail.com](mailto:vothanhnhan106@gmail.com).

##### &#169; 2024.N-I-V-Z. All rights reserved.
