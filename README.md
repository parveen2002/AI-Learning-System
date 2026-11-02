# AI-Learning System

**"Learning That Adapts To You"**

An AI-powered personalized learning platform that adapts to every student's unique knowledge, learning speed, strengths, and weaknesses.

---

## Project Objective

AI-Learning System aims to revolutionize online education by using artificial intelligence to create adaptive, personalized learning paths for each student. This repository contains the **frontend** built with vanilla HTML5, CSS3, and JavaScript, designed to connect to a Flask + MySQL backend in the future.

---

## Technologies Used

| Layer | Technology |
|-------|-----------|
| Markup | HTML5 (Semantic) |
| Styling | CSS3 (Custom Properties, Flexbox, Grid, Glassmorphism) |
| Logic | Vanilla JavaScript (ES5/ES6, Module Pattern) |
| Data | JSON (Mock data) |
| Storage | LocalStorage (Temporary mock state only) |
| Backend (planned) | Python Flask REST API |
| Database (planned) | MySQL |

**Not used:** React, Vue, Angular, TypeScript, Vite, Tailwind CSS, Bootstrap, Next.js, or any frontend framework.

---

## Folder Structure

```
LearnSphere-AI/
|
+-- index.html                     # Homepage
|
+-- pages/
|   +-- login.html                 # Login page
|   +-- signup.html                # Signup/Registration page
|   +-- forgot-password.html       # Password reset page
|
+-- css/
|   +-- style.css                  # Main stylesheet (variables, components, layout)
|   +-- responsive.css             # Responsive breakpoints (320px - 1440px)
|   +-- animations.css             # Keyframes and scroll animations
|
+-- js/
|   +-- config.js                  # App configuration and constants
|   +-- api.js                     # API layer (frontend <-> backend communication)
|   +-- auth.js                    # Authentication helper functions
|   +-- main.js                    # Homepage initialization and scroll animations
|   +-- navigation.js              # Navbar, mobile menu, auth-aware UI
|   +-- theme.js                   # Dark/Light mode with system preference detection
|
+-- data/
|   +-- mock-users.json            # Sample user data
|   +-- mock-config.json           # App configuration and feature data
|
+-- assets/
|   +-- images/                    # Image assets (empty, to be added)
|   +-- icons/                     # Icon assets (empty, to be added)
|   +-- videos/                    # Video assets (empty, to be added)
|
+-- README.md                      # This file
```

---

## How to Run

1. **Clone or download** the project folder.
2. Open `index.html` in any modern web browser.
3. No server is required for the frontend (all files are local).
4. For the best experience, use a local server (e.g., VS Code Live Server extension).

**To test authentication:**
1. Go to `pages/signup.html` and create an account.
2. You will be redirected to `pages/login.html`.
3. Login with the credentials you just created.
4. The navbar will update to show your name and a logout option.

---

## Mock Authentication

The current authentication system is **frontend-only** using LocalStorage for temporary state.

### How it works:
- `api.js` is the single communication layer between page JavaScript and the backend
- When `MOCK_MODE = true` (default), all auth functions use LocalStorage
- User data is stored in `learnsphere_users` in LocalStorage
- Session data is stored in `learnsphere_session` in LocalStorage
- Sessions expire after 7 days

### Student data structure:
```json
{
  "id": "usr_123456_abc123",
  "name": "John Doe",
  "email": "john@example.com",
  "educationLevel": "Undergraduate",
  "learningGoal": "Skill Development",
  "preferredFormat": "Mixed",
  "dailyGoal": "60 minutes",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Important Security Notes:
- LocalStorage authentication is **NOT** secure production authentication
- Passwords are stored in plain text (mock only) - real hashing will be done server-side
- This is temporary infrastructure for frontend development and testing
- Real authentication will use Flask sessions + JWT tokens

---

## Architecture

The frontend is designed with a clean architecture ready for Flask integration:

```
Page JavaScript
      |
      v
   api.js          <-- Single communication layer
      |
      v
Flask REST API     <-- Backend (to be implemented)
      |
      v
    MySQL           <-- Database (to be implemented)
```

### Why this architecture?
- Page JavaScript **never** directly calls backend endpoints
- API URLs are **never** hardcoded in page scripts
- Switching from mock to real API only requires changing `MOCK_MODE` to `false` in `config.js`
- All API functions are centralized in `api.js`

---

## Current Limitations

- No real backend (Flask API not yet implemented)
- No real database (MySQL not yet connected)
- No real authentication (passwords not hashed, no JWT)
- No real AI/NLP features
- Mock data only
- Courses, Learning Path, AI Tutor, Dashboard pages are placeholder links
- No real email for password reset
- Google Sign-In uses a local demo account chooser (no Google OAuth client or backend yet)

---

## Future Integration Plan

### Phase 2: Backend (Flask + MySQL)
- Flask REST API with proper endpoints
- MySQL database for users, courses, progress
- JWT-based authentication
- Password hashing with bcrypt
- Session management

### Phase 3: AI Features
- AI Tutor (using OpenAI API or similar)
- NLP-based concept analysis
- Personalized recommendation engine
- Adaptive learning path algorithm
- Spaced repetition system

### Phase 4: Core Features
- Quiz engine with adaptive difficulty
- Flashcard system with spaced repetition
- Progress analytics engine
- Course management system

### Phase 5: Advanced Features
- Leaderboard and gamification
- Admin panel
- Payment system
- Certificate generation
- Real-time notifications

---

## License

This project is for educational purposes.

---

**Built with care for personalized learning.**
