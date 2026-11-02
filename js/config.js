/* ============================================
   AI-Learning System - Configuration
   ============================================
   
   Central configuration file for the application.
   All constants and settings are defined here.
   
   Architecture:
   Page JavaScript -> api.js -> Flask REST API -> MySQL
   ============================================ */

var LearnSphereConfig = (function () {
  "use strict";

  var config = {
    APP_NAME: "AI-Learning System",
    APP_VERSION: "1.0.0",

    // When true, the app uses LocalStorage for mock data.
    // When false, api.js will call Flask REST endpoints.
    // Default is true (README: "When MOCK_MODE = true (default), all auth
    // functions use LocalStorage"). Set to false only when the Flask
    // backend is running, since every other API function is still mock-only.
    MOCK_MODE: true,

    // Flask REST API base URL (used when MOCK_MODE is false)
    API_BASE_URL: "http://localhost:5000/api",

    // LocalStorage keys
    STORAGE_KEYS: {
      THEME: "learnsphere_theme",
      SESSION: "learnsphere_session",
      USER: "learnsphere_user",
    },

    // Session duration in milliseconds (7 days)
    SESSION_DURATION: 7 * 24 * 60 * 60 * 1000,

    // Routes (relative paths)
    ROUTES: {
      HOME: "/index.html",
      LOGIN: "/pages/login.html",
      SIGNUP: "/pages/signup.html",
      FORGOT_PASSWORD: "/pages/forgot-password.html",
      DASHBOARD: "/pages/dashboard.html",
      COURSES: "#", // future
      LEARNING_PATH: "/pages/learning-path.html",
      AI_TUTOR: "/pages/ai-tutor.html",
      FLASHCARDS: "/pages/flashcards.html",
      REVISION: "/pages/revision.html",
      ANALYTICS: "/pages/analytics.html",
    },
  };

  return config;
})();
