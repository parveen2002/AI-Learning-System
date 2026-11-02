/* ============================================
   AI-Learning System - Authentication Module
   ============================================
   
   Handles authentication state and provides
   convenience functions for pages to use.
   
   IMPORTANT:
   - This module uses api.js for all backend calls
   - LocalStorage is used ONLY for mock session state
   - Real authentication will be handled by Flask API
   ============================================ */

var LearnSphereAuth = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var config = LearnSphereConfig;

  // ==================================================
  // PUBLIC FUNCTIONS
  // ==================================================

  /**
   * Register a new user.
   * @param {Object} userData - The student registration data
   * @returns {Object} { success, message, user }
   */
  function registerUser(userData) {
    // Client-side validation
    var validation = validateRegistration(userData);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    // Call API layer
    return api.registerStudent(userData);
  }

  /**
   * Login a user.
   * @param {string} email
   * @param {string} password
   * @returns {Object} { success, message, user, token }
   */
  function loginUser(email, password) {
    // Basic validation
    if (!email || !email.trim()) {
      return { success: false, message: "Email is required." };
    }
    if (!password || !password.trim()) {
      return { success: false, message: "Password is required." };
    }

    return api.loginStudent(email.trim(), password);
  }

  /**
   * Logout the current user.
   * @returns {Object} { success, message }
   */
  function logoutUser() {
    return api.logoutStudent();
  }

  /**
   * Check if a user is currently logged in.
   * @returns {boolean}
   */
  function isLoggedIn() {
    var user = api.getCurrentStudent();
    return user !== null;
  }

  /**
   * Get the current logged-in student data.
   * @returns {Object|null} Student object or null
   */
  function getCurrentStudent() {
    return api.getCurrentStudent();
  }

  /**
   * Get the current user's profile via the API layer.
   * @returns {Object} { success, profile }
   */
  function getUserProfile() {
    return api.getUserProfile();
  }

  /**
   * Update editable profile fields via the API layer.
   * @param {Object} profile - { name?, educationLevel?, learningGoal?, preferredFormat?, avatarColor? }
   * @returns {Object} { success, message, user }
   */
  function updateUserProfile(profile) {
    return api.updateUserProfile(profile);
  }

  /**
   * Get the base URL for links based on current page location.
   * This handles being in /pages/ subdirectory.
   */
  function getBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/LearnSphere-AI/pages/") !== -1) {
      return "..";
    }
    if (path.indexOf("/pages/") !== -1) {
      return "..";
    }
    if (path.indexOf("/LearnSphere-AI/") !== -1) {
      return ".";
    }
    return ".";
  }

  // ==================================================
  // VALIDATION HELPERS
  // ==================================================

  function validateRegistration(data) {
    if (!data.name || !data.name.trim()) {
      return { valid: false, message: "Full name is required." };
    }
    if (data.name.trim().length < 2) {
      return { valid: false, message: "Name must be at least 2 characters." };
    }

    if (!data.email || !data.email.trim()) {
      return { valid: false, message: "Email is required." };
    }
    if (!isValidEmail(data.email)) {
      return { valid: false, message: "Please enter a valid email address." };
    }

    if (!data.password) {
      return { valid: false, message: "Password is required." };
    }
    if (data.password.length < 6) {
      return {
        valid: false,
        message: "Password must be at least 6 characters.",
      };
    }

    if (!data.confirmPassword) {
      return { valid: false, message: "Please confirm your password." };
    }
    if (data.password !== data.confirmPassword) {
      return { valid: false, message: "Passwords do not match." };
    }

    if (!data.educationLevel) {
      return { valid: false, message: "Please select your education level." };
    }

    if (!data.learningGoal) {
      return { valid: false, message: "Please select a learning goal." };
    }

    if (!data.preferredFormat) {
      return {
        valid: false,
        message: "Please select a preferred learning format.",
      };
    }

    if (!data.dailyGoal) {
      return { valid: false, message: "Please set a daily learning goal." };
    }

    return { valid: true };
  }

  function isValidEmail(email) {
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  // ==================================================
  // RETURN PUBLIC API
  // ==================================================

  return {
    registerUser: registerUser,
    loginUser: loginUser,
    logoutUser: logoutUser,
    isLoggedIn: isLoggedIn,
    getCurrentStudent: getCurrentStudent,
    getUserProfile: getUserProfile,
    updateUserProfile: updateUserProfile,
    getBasePath: getBasePath,
    isValidEmail: isValidEmail,
  };
})();

