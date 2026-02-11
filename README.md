# COMP3133 - Lab Test - Chat Application
A real-time chat application using Socket.io, Express, and MongoDB. Users are able to signup, login, join predefined chat rooms, send group messages, send direct messages, and has a typing indicator.

## Features
- Signup page with unique usernames (stored in MongoDB)
- Login with JWT Authentication
- Session storage via localStorage
- Join predefined rooms
- Room-based chat using Socket.io
- Typing indicator
- Private messaging

## Tech Stack
**Backend**
- Node.js
- Express
- Socket.io
- Mongoose

**Frontend**
- HTML5
- CSS
- Bootstrap 5
- jQuery + fetch

**Database**
- MongoDB

## Project Structure

├─ server.js
├─ package.json
├─ package-lock.json
├─ .env (not committed)
├─ .gitignore
├─ docker-compose.yml
├─ config/
│ └─ rooms.js
├─ middleware/
│ └─ auth.js
├─ models/
│ ├─ User.js
│ ├─ GroupMessage.js
│ └─ PrivateMessage.js
├─ routes/
│ ├─ auth.js
│ └─ messages.js
├─ view/
│ ├─ signup.html
│ ├─ login.html
│ └─ chat.html
└─ public/
├─ app.js
└─ styles.css

---

## Setup

### 1) Install dependencies
```bash
npm install
```

## 2) Create a `.env` file in the project root
```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/student_chat_app
JWT_SECRET=super_secret_change_me
```

## 3) Start MongoDB + Mongo Express
```
docker compose up - d
```
Open Mongo Express in your browser to see the database
'http://localhost:8081'

## 4) Run the app
```
npm start
```

## 5) Open in your browser
- Signup: http://localhost:3000/signup

- Login: http://localhost:3000/login

- Chat: http://localhost:3000/chat
