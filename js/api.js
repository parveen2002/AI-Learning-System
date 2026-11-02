/* ============================================
   AI-Learning System - API Layer
   ============================================
   
   Single communication layer between frontend JS
   and the backend (Flask REST API + MySQL).
   
   IMPORTANT:
   - Page JS should ONLY call functions from api.js
   - Page JS should NEVER directly call Flask endpoints
   - When MOCK_MODE = true, uses LocalStorage
   - When MOCK_MODE = false, uses fetch() to Flask
   
   Architecture:
   Page JavaScript -> api.js -> Flask REST API -> MySQL
   ============================================ */

var LearnSphereAPI = (function () {
  "use strict";

  var config = LearnSphereConfig;

  // ---------- Helper: build URL ----------
  function buildURL(endpoint) {
    return config.API_BASE_URL + endpoint;
  }

  // ---------- Helper: get stored users ----------
  function getStoredUsers() {
    var data = localStorage.getItem("learnsphere_users");
    if (!data) return [];
    try {
      var parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  // ---------- Helper: save users ----------
  function saveUsers(users) {
    localStorage.setItem("learnsphere_users", JSON.stringify(users));
  }

  // ---------- Helper: generate unique ID ----------
  function generateID() {
    return "usr_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
  }

  // ==================================================
  // MOCK MODE FUNCTIONS
  // ==================================================

  /**
   * Register a new student (mock).
   * Returns { success, message, user }
   */
  function mockRegisterStudent(studentData) {
    var users = getStoredUsers();

    // Check if email already exists
    for (var i = 0; i < users.length; i++) {
      if (users[i].email.toLowerCase() === studentData.email.toLowerCase()) {
        return {
          success: false,
          message: "An account with this email already exists.",
        };
      }
    }

    // Create new user
    var newUser = {
      id: generateID(),
      name: studentData.name,
      email: studentData.email,
      password: studentData.password, // In production, this would be hashed server-side
      educationLevel: studentData.educationLevel || "",
      learningGoal: studentData.learningGoal || "",
      preferredFormat: studentData.preferredFormat || "",
      dailyGoal: studentData.dailyGoal || "",
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveUsers(users);

    // Return user without password
    var safeUser = Object.assign({}, newUser);
    delete safeUser.password;

    return {
      success: true,
      message: "Account created successfully!",
      user: safeUser,
    };
  }

  /**
   * Login a student (mock).
   * Returns { success, message, user, token }
   */
  function mockLoginStudent(email, password) {
    var users = getStoredUsers();

    for (var i = 0; i < users.length; i++) {
      if (
        users[i].email.toLowerCase() === email.toLowerCase() &&
        users[i].password === password
      ) {
        var safeUser = Object.assign({}, users[i]);
        delete safeUser.password;

        // Create mock session token
        var token = "mock_token_" + Date.now();
        var session = {
          token: token,
          userId: safeUser.id,
          expiresAt: Date.now() + config.SESSION_DURATION,
        };

        localStorage.setItem(config.STORAGE_KEYS.SESSION, JSON.stringify(session));
        localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(safeUser));

        return {
          success: true,
          message: "Login successful!",
          user: safeUser,
          token: token,
        };
      }
    }

    return {
      success: false,
      message: "Invalid email or password.",
    };
  }

  /**
   * Sign in with a Google profile (mock).
   *
   * The project has no backend or Google OAuth client configured, so this
   * accepts the profile returned by the local Google account chooser,
   * creates the local account on first use and starts a normal mock session.
   * Returns { success, message, user, token, isNewUser }
   */
  function mockGoogleSignIn(profile) {
    if (!profile || !profile.email) {
      return { success: false, message: "Google account email is required." };
    }

    var email = String(profile.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: "Please enter a valid email address." };
    }

    var users = getStoredUsers();
    var found = null;
    for (var i = 0; i < users.length; i++) {
      if (users[i].email && users[i].email.toLowerCase() === email.toLowerCase()) {
        found = users[i];
        break;
      }
    }

    var isNewUser = false;
    if (!found) {
      var fallbackName = email.split("@")[0].replace(/[._-]+/g, " ");
      fallbackName = fallbackName.replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      });
      found = {
        id: generateID(),
        name: (profile.name && String(profile.name).trim()) || fallbackName,
        email: email,
        password: null, // Google accounts do not use a local password
        provider: "google",
        educationLevel: "Undergraduate",
        learningGoal: "Skill Development",
        preferredFormat: "Mixed",
        dailyGoal: "30 minutes",
        createdAt: new Date().toISOString(),
      };
      users.push(found);
      saveUsers(users);
      isNewUser = true;
    } else if (profile.name && String(profile.name).trim()) {
      found.name = String(profile.name).trim();
      found.provider = found.provider || "google";
      saveUsers(users);
    }

    var safeUser = Object.assign({}, found);
    delete safeUser.password;

    var token = "mock_token_" + Date.now();
    var session = {
      token: token,
      userId: safeUser.id,
      provider: "google",
      expiresAt: Date.now() + config.SESSION_DURATION,
    };

    localStorage.setItem(config.STORAGE_KEYS.SESSION, JSON.stringify(session));
    localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(safeUser));

    return {
      success: true,
      message: isNewUser ? "Account created with Google!" : "Signed in with Google!",
      user: safeUser,
      token: token,
      isNewUser: isNewUser,
    };
  }

  /**
   * Logout the current student (mock).
   */
  function mockLogoutStudent() {
    localStorage.removeItem(config.STORAGE_KEYS.SESSION);
    localStorage.removeItem(config.STORAGE_KEYS.USER);
    return { success: true, message: "Logged out successfully." };
  }

  /**
   * Get the currently logged-in student (mock).
   * Returns user object or null.
   */
  function mockGetCurrentStudent() {
    var sessionData = localStorage.getItem(config.STORAGE_KEYS.SESSION);
    var userData = localStorage.getItem(config.STORAGE_KEYS.USER);

    if (!sessionData || !userData) {
      return null;
    }

    var session = null;
    try {
      session = JSON.parse(sessionData);
    } catch (e) {
      session = null;
    }
    if (!session) {
      localStorage.removeItem(config.STORAGE_KEYS.SESSION);
      localStorage.removeItem(config.STORAGE_KEYS.USER);
      return null;
    }

    // Check if session has expired
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(config.STORAGE_KEYS.SESSION);
      localStorage.removeItem(config.STORAGE_KEYS.USER);
      return null;
    }

    try {
      return JSON.parse(userData);
    } catch (e) {
      localStorage.removeItem(config.STORAGE_KEYS.SESSION);
      localStorage.removeItem(config.STORAGE_KEYS.USER);
      return null;
    }
  }

  /**
   * Request password reset (mock).
   * Always returns success for security reasons.
   */
  function mockRequestPasswordReset(email) {
    return {
      success: true,
      message:
        "If an account exists with this email, password reset instructions will be sent.",
    };
  }

  // ==================================================
  // PROFILE & PREFERENCES (mock)
  // Future: users / user_profiles / user_preferences /
  // notification_preferences tables via Flask + MySQL.
  // ==================================================

  var NOTIFICATION_PREFS_KEY = "ai_learning_notification_preferences";

  var NOTIFICATION_DEFAULTS = {
    studyReminders: true,
    revisionReminders: true,
    quizReminders: true,
    achievementNotifications: true,
  };

  function profileUserId() {
    var user = mockGetCurrentStudent();
    return user ? String(user.id) : null;
  }

  function findStoredUser(userId) {
    if (!userId) return null;
    var users = getStoredUsers();
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].id) === String(userId)) return users[i];
    }
    return null;
  }

  function sanitizeUserProfile(user) {
    if (!user) return null;
    var profile = Object.assign({}, user);
    delete profile.password;
    return profile;
  }

  /**
   * Normalize a daily-goal value to whole minutes, or "" when unset.
   * Accepts plain minutes ("30", 30) and descriptive strings
   * ("30 minutes") used by the existing signup form.
   */
  function profileMinutesFrom(value) {
    if (value === undefined || value === null) return "";
    var num = Number(value);
    if (!isNaN(num) && num > 0) return Math.round(num);
    var match = /(\d+)/.exec(String(value).trim());
    if (match) {
      var m = Number(match[1]);
      if (m > 0) return Math.round(m);
    }
    return "";
  }

  /**
   * Refresh the session copy (learnsphere_user) from the users
   * database so other pages see updated profile/preference data.
   */
  function refreshSessionUser(profile) {
    var safe = sanitizeUserProfile(profile);
    if (safe) {
      localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(safe));
    }
    return safe;
  }

  function requireLoggedIn() {
    var user = mockGetCurrentStudent();
    if (!user) {
      return { error: { success: false, message: "Please log in to continue." } };
    }
    return { user: user };
  }

  /**
   * Get the current user's profile.
   * Returns { success, profile }
   */
  function mockGetUserProfile() {
    var check = requireLoggedIn();
    if (check.error) return check.error;
    var stored = findStoredUser(check.user.id);
    var profile = sanitizeUserProfile(stored || check.user);
    return { success: true, profile: profile };
  }

  /**
   * Update editable profile fields.
   * Email is intentionally never changed here (read-only identity).
   * Returns { success, message, user }
   */
  function mockUpdateUserProfile(profile) {
    var check = requireLoggedIn();
    if (check.error) return check.error;

    var fields = profile || {};
    var name = fields.name !== undefined ? String(fields.name).trim() : check.user.name;
    if (!name) {
      return { success: false, message: "Full name is required." };
    }
    if (name.length < 2) {
      return { success: false, message: "Name must be at least 2 characters." };
    }

    var users = getStoredUsers();
    var stored = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].id) === String(check.user.id)) {
        stored = users[i];
        stored.name = name;
        if (fields.role !== undefined) stored.role = fields.role;
        if (fields.college !== undefined) stored.college = fields.college;
        if (fields.educationLevel !== undefined) stored.educationLevel = fields.educationLevel;
        if (fields.learningGoal !== undefined) stored.learningGoal = fields.learningGoal;
        if (fields.preferredFormat !== undefined) stored.preferredFormat = fields.preferredFormat;
        if (fields.avatarColor !== undefined) stored.avatarColor = fields.avatarColor;
        if (fields.learningLevel !== undefined) stored.learningLevel = fields.learningLevel;
        if (fields.profilePhoto !== undefined) stored.profilePhoto = fields.profilePhoto;
        break;
      }
    }
    saveUsers(users);

    var source = stored || check.user;
    var safe = refreshSessionUser(source);
    return { success: true, message: "Profile updated successfully.", user: safe };
  }

  /**
   * Get the current user's learning preferences.
   * Returns { success, preferences }
   */
  function mockGetUserPreferences() {
    var check = requireLoggedIn();
    if (check.error) return check.error;
    var stored = findStoredUser(check.user.id);
    var user = stored || check.user;
    return {
      success: true,
      preferences: {
        learningLevel: user.learningLevel || "",
        learningGoal: user.learningGoal || "",
        preferredFormat: user.preferredFormat || "",
        educationLevel: user.educationLevel || "",
        dailyGoal: profileMinutesFrom(user.dailyGoal),
      },
    };
  }

  /**
   * Update the current user's learning preferences.
   * Returns { success, message, preferences }
   */
  function mockUpdateUserPreferences(preferences) {
    var check = requireLoggedIn();
    if (check.error) return check.error;

    var prefs = preferences || {};
    var users = getStoredUsers();
    var stored = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].id) === String(check.user.id)) {
        stored = users[i];
        if (prefs.learningLevel !== undefined) stored.learningLevel = prefs.learningLevel;
        if (prefs.learningGoal !== undefined) stored.learningGoal = prefs.learningGoal;
        if (prefs.preferredFormat !== undefined) stored.preferredFormat = prefs.preferredFormat;
        if (prefs.educationLevel !== undefined && prefs.educationLevel !== "") stored.educationLevel = prefs.educationLevel;
        if (prefs.dailyGoal !== undefined) stored.dailyGoal = profileMinutesFrom(prefs.dailyGoal);
        if (prefs.avatarColor !== undefined) stored.avatarColor = prefs.avatarColor;
        break;
      }
    }
    saveUsers(users);

    refreshSessionUser(stored || check.user);
    return {
      success: true,
      message: "Preferences saved successfully.",
      preferences: mockGetUserPreferences().preferences,
    };
  }

  function loadNotificationPrefsRaw() {
    var raw = localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  function getNotificationPrefsFor(userId) {
    var id = userId || profileUserId() || "guest";
    var data = loadNotificationPrefsRaw() || {};
    var entry = data[id];
    var prefs = {};
    for (var k in NOTIFICATION_DEFAULTS) {
      if (!Object.prototype.hasOwnProperty.call(NOTIFICATION_DEFAULTS, k)) continue;
      prefs[k] = entry && entry[k] !== undefined ? !!entry[k] : NOTIFICATION_DEFAULTS[k];
    }
    return prefs;
  }

  function saveNotificationPrefsFor(userId, prefs) {
    var id = userId || profileUserId() || "guest";
    var data = loadNotificationPrefsRaw() || {};
    var entry = {};
    for (var k in prefs) {
      if (!Object.prototype.hasOwnProperty.call(prefs, k)) continue;
      entry[k] = !!prefs[k];
    }
    data[id] = entry;
    localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(data));
  }

  /**
   * Get the current user's notification preferences.
   * Returns { success, preferences }
   */
  function mockGetNotificationPreferences() {
    var check = requireLoggedIn();
    if (check.error) return check.error;
    return { success: true, preferences: getNotificationPrefsFor(check.user.id) };
  }

  /**
   * Update the current user's notification preferences.
   * Returns { success, message, preferences }
   */
  function mockUpdateNotificationPreferences(preferences) {
    var check = requireLoggedIn();
    if (check.error) return check.error;
    var prefs = {};
    for (var k in NOTIFICATION_DEFAULTS) {
      if (!Object.prototype.hasOwnProperty.call(NOTIFICATION_DEFAULTS, k)) continue;
      prefs[k] = preferences && preferences[k] !== undefined ? !!preferences[k] : NOTIFICATION_DEFAULTS[k];
    }
    saveNotificationPrefsFor(check.user.id, prefs);
    return {
      success: true,
      message: "Notification preferences saved successfully.",
      preferences: prefs,
    };
  }

  /**
   * Reset ONLY learning preferences.
   * Progress, quiz results, flashcards, achievements, XP,
   * bookmarks and study tasks are never touched here.
   */
  function mockResetUserPreferences() {
    var check = requireLoggedIn();
    if (check.error) return check.error;

    var users = getStoredUsers();
    var stored = null;
    for (var i = 0; i < users.length; i++) {
      if (String(users[i].id) === String(check.user.id)) {
        stored = users[i];
        stored.learningLevel = "";
        stored.learningGoal = "";
        stored.preferredFormat = "";
        stored.dailyGoal = "";
        stored.avatarColor = "";
        break;
      }
    }
    saveUsers(users);
    refreshSessionUser(stored || check.user);

    saveNotificationPrefsFor(check.user.id, NOTIFICATION_DEFAULTS);

    var goalStore = plannerStorageGet(DAILY_GOAL_KEY);
    if (goalStore && typeof goalStore === "object") {
      delete goalStore[check.user.id];
      plannerStorageSet(DAILY_GOAL_KEY, goalStore);
    }

    return { success: true, message: "Learning preferences reset successfully." };
  }

  // ==================================================
  // COURSE DATA (loaded from JSON, cached in memory)
  // ==================================================

  var _coursesCache = null;
  var _lessonsCache = null;

  function loadCoursesData() {
    if (_coursesCache) return _coursesCache;
    var raw = localStorage.getItem("learnsphere_courses_data");
    if (raw) {
      try {
        _coursesCache = JSON.parse(raw);
      } catch (e) {
        _coursesCache = null;
      }
    }
    return _coursesCache;
  }

  function saveCoursesData(data) {
    _coursesCache = data;
    localStorage.setItem("learnsphere_courses_data", JSON.stringify(data));
  }

  function loadLessonsData() {
    if (_lessonsCache) return _lessonsCache;
    var raw = localStorage.getItem("learnsphere_lessons_data");
    if (raw) {
      try {
        _lessonsCache = JSON.parse(raw);
      } catch (e) {
        _lessonsCache = null;
      }
    }
    return _lessonsCache;
  }

  function saveLessonsData(data) {
    _lessonsCache = data;
    localStorage.setItem("learnsphere_lessons_data", JSON.stringify(data));
  }

  // ==================================================
  // MOCK COURSE FUNCTIONS
  // ==================================================

  /**
   * Get all courses from mock JSON data.
   */
  function mockGetCourses() {
    return loadCoursesData() || [];
  }

  /**
   * Get a single course by ID.
   */
  function mockGetCourseById(courseId) {
    var courses = loadCoursesData() || [];
    for (var i = 0; i < courses.length; i++) {
      if (courses[i].id === courseId) return courses[i];
    }
    return null;
  }

  /**
   * Get curriculum modules for a specific course.
   * Reads from course.curriculum in courses.json.
   */
  function mockGetLessonsByCourse(courseId) {
    var course = mockGetCourseById(courseId);
    if (course && course.curriculum) return course.curriculum;
    // Fallback: check separate lessons data
    var lessons = loadLessonsData() || [];
    var result = [];
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].courseId === courseId) result.push(lessons[i]);
    }
    return result;
  }

  /**
   * Get a single lesson by courseId and lessonId.
   */
  function mockGetLessonById(courseId, lessonId) {
    var lessons = loadLessonsData() || [];
    for (var i = 0; i < lessons.length; i++) {
      if (lessons[i].courseId === courseId && lessons[i].lessonId === lessonId) {
        return lessons[i];
      }
    }
    // Fallback: check course curriculum
    var course = mockGetCourseById(courseId);
    if (course && course.curriculum) {
      for (var m = 0; m < course.curriculum.length; m++) {
        var mod = course.curriculum[m];
        for (var l = 0; l < (mod.lessons || []).length; l++) {
          if (mod.lessons[l].id === lessonId) {
            return { courseId: courseId, lessonId: lessonId, title: mod.lessons[l].title, type: mod.lessons[l].type, duration: mod.lessons[l].duration, content: {} };
          }
        }
      }
    }
    return null;
  }

  // ==================================================
  // MOCK ENROLLMENT & PROGRESS FUNCTIONS
  // ==================================================

  function getStoredProgress() {
    var data = localStorage.getItem("learnsphere_course_progress");
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }

  function saveProgress(progress) {
    localStorage.setItem("learnsphere_course_progress", JSON.stringify(progress));
  }

  /**
   * Start a course (enroll).
   */
  function mockStartCourse(courseId) {
    var progress = getStoredProgress();
    if (!progress[courseId]) {
      progress[courseId] = {
        courseId: courseId,
        completedLessons: [],
        startedAt: new Date().toISOString(),
        lastLessonId: null,
      };
      saveProgress(progress);
    }
    return { success: true, message: "Course started!" };
  }

  /**
   * Mark a lesson as complete.
   */
  function mockMarkLessonComplete(courseId, lessonId) {
    var progress = getStoredProgress();
    if (!progress[courseId]) {
      progress[courseId] = {
        courseId: courseId,
        completedLessons: [],
        startedAt: new Date().toISOString(),
        lastLessonId: null,
      };
    }
    var completed = progress[courseId].completedLessons;
    if (completed.indexOf(lessonId) === -1) {
      completed.push(lessonId);
    }
    progress[courseId].lastLessonId = lessonId;
    saveProgress(progress);

    var course = mockGetCourseById(courseId);
    var lessonsCount = course ? course.lessonsCount : 1;
    var pct = Math.round((completed.length / lessonsCount) * 100);

    return {
      success: true,
      message: "Lesson marked as complete!",
      progress: pct,
      completedCount: completed.length,
      totalCount: lessonsCount,
    };
  }

  /**
   * Get course progress for the current user.
   */
  function mockGetCourseProgress(courseId) {
    var progress = getStoredProgress();
    var data = progress[courseId] || null;
    if (!data) return null;

    var course = mockGetCourseById(courseId);
    var lessonsCount = course ? course.lessonsCount : 1;
    var pct = Math.round((data.completedLessons.length / lessonsCount) * 100);

    return {
      courseId: courseId,
      completedLessons: data.completedLessons,
      completedCount: data.completedLessons.length,
      totalCount: lessonsCount,
      progressPercentage: pct,
      startedAt: data.startedAt,
      lastLessonId: data.lastLessonId,
    };
  }

  /**
   * Check if a specific lesson is complete.
   */
  function mockIsLessonComplete(courseId, lessonId) {
    var progress = getStoredProgress();
    if (!progress[courseId]) return false;
    return progress[courseId].completedLessons.indexOf(lessonId) !== -1;
  }

  /**
   * Get all enrolled course IDs.
   */
  function mockGetEnrolledCourses() {
    var progress = getStoredProgress();
    var enrolled = [];
    for (var key in progress) {
      if (progress.hasOwnProperty(key)) {
        enrolled.push(parseInt(key, 10));
      }
    }
    return enrolled;
  }

  // ==================================================
  // MOCK BOOKMARK FUNCTIONS
  // Per-user bookmarks stored under ai_learning_bookmarks.
  // Structure: { "<userId>": { userId, items: [ { id, type, courseId,
  // lessonId, savedAt } ] } } so each student's saved learning stays
  // isolated and ready to map to a future bookmarks DB table.
  // ==================================================

  var BOOKMARKS_STORAGE_KEY = "ai_learning_bookmarks";
  var BookmarkTypes = { COURSE: "course", LESSON: "lesson" };

  function getBookmarkUserId() {
    var student = mockGetCurrentStudent();
    return student && student.id !== undefined && student.id !== null ? String(student.id) : "guest";
  }

  function bookmarkIdFor(type, courseId, lessonId) {
    if (type === BookmarkTypes.LESSON) {
      return "lesson-" + courseId + "-" + (lessonId !== undefined && lessonId !== null ? lessonId : "unknown");
    }
    return "course-" + courseId;
  }

  function loadUserBookmarks() {
    var data = null;
    var raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        data = null;
      }
    }
    if (!data || typeof data !== "object") data = {};
    var userId = getBookmarkUserId();
    var userData = data[userId];
    if (!userData || typeof userData !== "object" || userData === null) {
      userData = { userId: userId, items: [] };
    }
    if (!Array.isArray(userData.items)) userData.items = [];
    return userData;
  }

  function saveUserBookmarks(userData) {
    var data = {};
    var raw = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch (e) {
        data = {};
      }
    }
    if (!data || typeof data !== "object") data = {};
    data[userData.userId] = { userId: userData.userId, items: userData.items.slice() };
    localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Get all bookmark items for the current user.
   */
  function mockGetBookmarks() {
    var userData = loadUserBookmarks();
    return userData.items.slice();
  }

  /**
   * Get the total bookmark count for the current user.
   */
  function mockGetBookmarkCount() {
    var userData = loadUserBookmarks();
    return userData.items.length;
  }

  /**
   * Check if an item is already bookmarked.
   * A single itemId works for lessons; bare courseIds are treated as
   * course bookmarks so existing course card integrations keep working.
   */
  function mockIsBookmarked(itemId, type) {
    if (itemId === undefined || itemId === null) return false;
    var userData = loadUserBookmarks();
    var want = itemId;
    if (String(itemId).indexOf("course-") !== 0 && String(itemId).indexOf("lesson-") !== 0) {
      want = "course-" + itemId;
    }
    for (var i = 0; i < userData.items.length; i++) {
      var item = userData.items[i];
      if (String(item.id) !== String(want)) continue;
      if (type && item.type !== type) continue;
      return true;
    }
    return false;
  }

  /**
   * Add a bookmark. Prevents duplicates.
   */
  function mockAddBookmark(bookmark) {
    if (!bookmark || bookmark.id === undefined || bookmark.id === null || !bookmark.type) {
      return { success: false, bookmarked: false, message: "Invalid bookmark." };
    }
    var userData = loadUserBookmarks();
    for (var i = 0; i < userData.items.length; i++) {
      if (userData.items[i].id === bookmark.id && userData.items[i].type === bookmark.type) {
        return { success: true, bookmarked: true, message: BookmarkTypes.LESSON === bookmark.type ? "Lesson saved to bookmarks." : "Course saved to bookmarks.", duplicate: true };
      }
    }
    var courseTitle = null;
    if (bookmark.type === BookmarkTypes.COURSE) {
      var course = mockGetCourseById(bookmark.courseId);
      courseTitle = course ? course.title || "" : "";
    }
    userData.items.push({
      id: bookmark.id,
      type: bookmark.type,
      courseId: bookmark.courseId,
      lessonId: bookmark.type === BookmarkTypes.LESSON ? (bookmark.lessonId !== undefined ? bookmark.lessonId : null) : undefined,
      courseTitle: courseTitle,
      savedAt: new Date().toISOString(),
    });
    saveUserBookmarks(userData);
    return {
      success: true,
      bookmarked: true,
      message: BookmarkTypes.LESSON === bookmark.type ? "Lesson saved successfully." : "Course saved successfully.",
    };
  }

  /**
   * Remove a bookmark by item id + type (case by id alone fails safely).
   */
  function mockRemoveBookmark(itemId, type) {
    if (itemId === undefined || itemId === null) {
      return { success: false, bookmarked: false, message: "Invalid bookmark." };
    }
    var userData = loadUserBookmarks();
    for (var i = 0; i < userData.items.length; i++) {
      var item = userData.items[i];
      if (String(item.id) !== String(itemId)) continue;
      if (type && item.type !== type) continue;
      userData.items.splice(i, 1);
      saveUserBookmarks(userData);
      return { success: true, bookmarked: false, message: "Bookmark removed." };
    }
    return { success: true, bookmarked: false, message: "Bookmark removed." };
  }

  /**
   * Toggle a bookmark on or off.
   */
  function mockToggleBookmark(bookmark) {
    if (!bookmark || bookmark.id === undefined || bookmark.id === null || !bookmark.type) {
      return { success: false, bookmarked: false, message: "Invalid bookmark." };
    }
    var userData = loadUserBookmarks();
    for (var i = 0; i < userData.items.length; i++) {
      if (userData.items[i].id === bookmark.id && userData.items[i].type === bookmark.type) {
        userData.items.splice(i, 1);
        saveUserBookmarks(userData);
        return { success: true, bookmarked: false, message: "Bookmark removed." };
      }
    }
    var add = mockAddBookmark(bookmark);
    return add;
  }

  /**
   * Toggle bookmark on a course (course-specific convenience wrapper).
   */
  function mockBookmarkCourse(courseId) {
    var bookmark = { id: bookmarkIdFor(BookmarkTypes.COURSE, courseId), type: BookmarkTypes.COURSE, courseId: courseId };
    return mockToggleBookmark(bookmark);
  }

  /**
   * Check if a course is bookmarked.
   */
  function mockIsCourseBookmarked(courseId) {
    return mockIsBookmarked("course-" + courseId, BookmarkTypes.COURSE);
  }

  /**
   * Get all bookmarked course IDs (backwards compatible with older callers).
   */
  function mockGetBookmarkedCourses() {
    var items = mockGetBookmarks();
    var ids = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type === BookmarkTypes.COURSE) {
        ids.push(items[i].courseId !== undefined ? items[i].courseId : items[i].id);
      }
    }
    return ids;
  }

  /**
   * Get recommended courses for a given course.
   */
  function mockGetRecommendedCourses(courseId) {
    var courses = loadCoursesData() || [];
    var course = mockGetCourseById(courseId);
    if (!course) return [];

    var recommended = [];
    for (var i = 0; i < courses.length; i++) {
      if (courses[i].id === courseId) continue;
      if (courses[i].category === course.category || courses[i].featured) {
        recommended.push(courses[i]);
      }
    }
    return recommended.slice(0, 3);
  }

  // ==================================================
  // MOCK QUIZ FUNCTIONS
  // ==================================================

  var _quizzesCache = null;

  function loadQuizzesData() {
    if (_quizzesCache) return _quizzesCache;
    var raw = localStorage.getItem("learnsphere_quizzes_data");
    if (raw) {
      try {
        _quizzesCache = JSON.parse(raw);
      } catch (e) {
        _quizzesCache = null;
      }
    }
    return _quizzesCache;
  }

  function saveQuizzesData(data) {
    _quizzesCache = data;
    localStorage.setItem("learnsphere_quizzes_data", JSON.stringify(data));
  }

  /**
   * Get all quizzes, optionally filtered by course.
   */
  function mockGetQuizzes(courseId) {
    var quizzes = loadQuizzesData() || [];
    if (!courseId) return quizzes;
    var result = [];
    for (var i = 0; i < quizzes.length; i++) {
      if (quizzes[i].course_id === courseId) result.push(quizzes[i]);
    }
    return result;
  }

  /**
   * Get a single quiz by quiz ID.
   */
  function mockGetQuiz(quizId) {
    var quizzes = loadQuizzesData() || [];
    for (var i = 0; i < quizzes.length; i++) {
      if (quizzes[i].quiz_id === quizId) return quizzes[i];
    }
    return null;
  }

  /**
   * Get a quiz connected to a specific course lesson.
   */
  function mockGetQuizForLesson(courseId, lessonId) {
    var quizzes = loadQuizzesData() || [];
    for (var i = 0; i < quizzes.length; i++) {
      if (
        quizzes[i].course_id === courseId &&
        quizzes[i].lesson_id === lessonId
      ) {
        return quizzes[i];
      }
    }
    return null;
  }

  /**
   * Get stored quiz results from LocalStorage.
   * Storage key: ai_learning_quiz_results
   */
  function getStoredQuizResults() {
    var raw = localStorage.getItem("ai_learning_quiz_results");
    if (!raw) return [];
    try {
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveQuizResults(results) {
    localStorage.setItem("ai_learning_quiz_results", JSON.stringify(results));
  }

  /**
   * Get all quiz results for a specific user.
   */
  function getQuizResultsForUser(userId) {
    var results = getStoredQuizResults();
    var mine = [];
    for (var i = 0; i < results.length; i++) {
      if (results[i].user_id === userId) mine.push(results[i]);
    }
    return mine;
  }

  /**
   * Submit a quiz result and store it for the current user.
   * Also marks the quiz's lesson as completed.
   */
  function mockSubmitQuizResult(result) {
    var user = mockGetCurrentStudent();
    var results = getStoredQuizResults();
    var record = {
      result_id:
        "result_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      user_id: user ? user.id : "guest",
      user_email: user ? user.email : "",
      quiz_id: result.quiz_id,
      course_id: result.course_id,
      lesson_id: result.lesson_id || "",
      score: result.score,
      correct: result.correct,
      wrong: result.wrong,
      unanswered: result.unanswered,
      total: result.total,
      passed: result.passed,
      answers: result.answers || [],
      completed_at: new Date().toISOString(),
    };
    results.push(record);
    saveQuizResults(results);

    // Mark the quiz lesson as completed for this user.
    if (result.course_id && result.lesson_id) {
      mockMarkLessonComplete(result.course_id, result.lesson_id);
    }

    return record;
  }

  /**
   * Get the latest quiz result for the current user.
   */
  function mockGetQuizResult(quizId) {
    var user = mockGetCurrentStudent();
    if (!user) return null;
    var mine = getQuizResultsForUser(user.id);
    var result = null;
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].quiz_id === quizId) result = mine[i];
    }
    return result;
  }

  /**
   * Get all attempts for a quiz made by the current user.
   */
  function mockGetQuizAttempts(quizId) {
    var user = mockGetCurrentStudent();
    if (!user) return [];
    var mine = getQuizResultsForUser(user.id);
    var attempts = [];
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].quiz_id === quizId) attempts.push(mine[i]);
    }
    return attempts;
  }

  /**
   * Get the best score (highest percentage) for a quiz by the current user.
   */
  function mockGetQuizBestScore(quizId) {
    var attempts = mockGetQuizAttempts(quizId);
    if (!attempts.length) return null;
    var best = 0;
    for (var i = 0; i < attempts.length; i++) {
      if (attempts[i].score > best) best = attempts[i].score;
    }
    return best;
  }

  /**
   * Get a specific quiz result for the current user by its completion timestamp.
   */
  function mockGetQuizResultByTime(quizId, timestamp) {
    var user = mockGetCurrentStudent();
    if (!user) return null;
    var mine = getQuizResultsForUser(user.id);
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].quiz_id === quizId && Date.parse(mine[i].completed_at) === timestamp) {
        return mine[i];
      }
    }
    return mockGetQuizResult(quizId);
  }

  // ==================================================
  // MOCK DASHBOARD FUNCTIONS
  // ==================================================

  var _dashboardCache = null;

  function loadDashboardData() {
    if (_dashboardCache) return _dashboardCache;
    var raw = localStorage.getItem("learnsphere_dashboard_data");
    if (raw) {
      try {
        _dashboardCache = JSON.parse(raw);
      } catch (e) {
        _dashboardCache = null;
      }
    }
    return _dashboardCache;
  }

  function saveDashboardData(data) {
    _dashboardCache = data;
    localStorage.setItem("learnsphere_dashboard_data", JSON.stringify(data));
  }

  /**
   * Get the full dashboard data object.
   */
  function mockGetDashboardData() {
    return loadDashboardData() || null;
  }

  /**
   * Initialize dashboard data from JSON file.
   */
  function mockInitDashboardData(dashboardJson) {
    if (dashboardJson && !loadDashboardData()) {
      saveDashboardData(dashboardJson);
    }
  }

  /**
   * Get overview stats (progress, quizAccuracy, studyStreak, topicsMastered).
   */
  function mockGetDashboardOverview() {
    var data = loadDashboardData();
    return data ? data.overview : null;
  }

  /**
   * Get active courses (enrolled but not completed).
   */
  function mockGetActiveCourses() {
    var enrolled = mockGetEnrolledCourses();
    var courses = loadCoursesData() || [];
    var active = [];
    for (var i = 0; i < enrolled.length; i++) {
      var course = mockGetCourseById(enrolled[i]);
      if (!course) continue;
      var progress = mockGetCourseProgress(enrolled[i]);
      if (progress && progress.progressPercentage < 100) {
        active.push({ course: course, progress: progress });
      }
    }
    return active;
  }

  /**
   * Get completed courses (100% progress).
   */
  function mockGetCompletedCourses() {
    var enrolled = mockGetEnrolledCourses();
    var courses = loadCoursesData() || [];
    var completed = [];
    for (var i = 0; i < enrolled.length; i++) {
      var course = mockGetCourseById(enrolled[i]);
      if (!course) continue;
      var progress = mockGetCourseProgress(enrolled[i]);
      if (progress && progress.progressPercentage >= 100) {
        completed.push({ course: course, progress: progress });
      }
    }
    return completed;
  }

  /**
   * Get saved/bookmarked courses with details.
   */
  function mockGetSavedCourses() {
    var bookmarked = mockGetBookmarkedCourses();
    var result = [];
    for (var i = 0; i < bookmarked.length; i++) {
      var course = mockGetCourseById(bookmarked[i]);
      if (course) result.push(course);
    }
    return result;
  }

  /**
   * Get recent activity from dashboard data.
   */
  function mockGetRecentActivity() {
    var data = loadDashboardData();
    return data ? data.recentActivity || [] : [];
  }

  /**
   * Get daily goal data. A user-chosen planner override
   * (ai_learning_daily_goal) wins so the dashboard ring updates
   * wherever the student sets their daily goal in Settings.
   */
  function mockGetDailyGoal() {
    var data = loadDashboardData();
    var goal = data ? data.dailyGoal : null;
    if (!goal) return null;
    var store = plannerStorageGet(DAILY_GOAL_KEY);
    var custom = null;
    if (store && typeof store === "object" && store[plannerUserId()]) {
      custom = Number(store[plannerUserId()]);
      if (isNaN(custom) || custom <= 0) custom = null;
    }
    var target = custom || Number(goal.targetMinutes) || 60;
    var merged = Object.assign({}, goal);
    merged.targetMinutes = Math.round(target);
    return merged;
  }

  /**
   * Get learning streak data.
   */
  function mockGetLearningStreak() {
    var data = loadDashboardData();
    return data ? data.streak : null;
  }

  /**
   * Get recommended next step.
   */
  function mockGetRecommendedNextStep() {
    var data = loadDashboardData();
    return data ? data.recommendedNextStep : null;
  }

  // ==================================================
  // FLASK API FUNCTIONS (for future use)
  // ==================================================

  /**
   * Register a student via Flask REST API.
   * Must exist even when MOCK_MODE is true: registerStudent() references it
   * directly, so leaving it commented out throws a ReferenceError that
   * crashes the signup form.
   */
  async function flaskRegisterStudent(studentData) {
      try {
          var response = await fetch(buildURL('/register'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(studentData)
          });
          var data = await response.json();
          if (data && data.success) {
              try {
                  localStorage.setItem(config.STORAGE_KEYS.SESSION, data.token || '');
                  var userCopy = Object.assign({}, data.user);
                  localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(userCopy));
              } catch (e) {}
          }
          return data;
      } catch (error) {
          return { success: false, message: 'Network error. Please try again.' };
      }
  }

  /**
   * Login a student via Flask REST API.
   */
  async function flaskLoginStudent(email, password) {
      try {
          var response = await fetch(buildURL('/login'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: email, password: password })
          });
          var data = await response.json();
          if (data && data.success) {
              try {
                  localStorage.setItem(config.STORAGE_KEYS.SESSION, data.token || '');
                  var userCopy = Object.assign({}, data.user);
                  localStorage.setItem(config.STORAGE_KEYS.USER, JSON.stringify(userCopy));
              } catch (e) {}
          }
          return data;
      } catch (error) {
          return { success: false, message: 'Network error. Please try again.' };
      }
  }

  // ==================================================
  // LEARNING PATH FUNCTIONS
  // ==================================================

  /**
   * Flatten all curriculum lessons for a course.
   */
  function lpFlattenLessons(course) {
    var flat = [];
    if (!course || !course.curriculum) return flat;
    for (var m = 0; m < course.curriculum.length; m++) {
      var mod = course.curriculum[m];
      for (var l = 0; l < (mod.lessons || []).length; l++) {
        var stub = mod.lessons[l];
        flat.push({
          lessonId: stub.id,
          title: stub.title,
          type: stub.type,
          duration: stub.duration,
          moduleId: mod.id,
          moduleTitle: mod.title,
        });
      }
    }
    return flat;
  }

  /**
   * Get all quiz results for a specific course.
   */
  function lpGetCourseQuizResults(courseId) {
    var results = [];
    var stored = localStorage.getItem("ai_learning_quiz_results");
    if (!stored) return results;
    try {
      var all = JSON.parse(stored);
      var student = mockGetCurrentStudent();
      var userId = student ? student.id : "guest";
      for (var i = 0; i < all.length; i++) {
        if (all[i].course_id === courseId && all[i].user_id === userId) {
          results.push(all[i]);
        }
      }
    } catch (e) { /* ignore */ }
    return results;
  }

  /**
   * Compute mastery level (0-100) for a course.
   * Combines lesson completion %, best quiz score, and attempt count.
   */
  function mockGetStudentMastery(courseId) {
    var course = mockGetCourseById(courseId);
    if (!course) return null;

    var progress = mockGetCourseProgress(courseId);
    var quizzes = mockGetQuizzes(courseId);
    var quizResults = lpGetCourseQuizResults(courseId);

    var completedCount = progress ? progress.completedCount : 0;
    var totalCount = progress ? progress.totalCount : (course.lessonsCount || 1);
    var completionPct = Math.round((completedCount / totalCount) * 100);

    var bestQuizScore = 0;
    var quizCount = 0;
    var quizScores = [];

    if (quizzes && quizzes.length > 0) {
      quizCount = quizzes.length;
      for (var q = 0; q < quizzes.length; q++) {
        var best = mockGetQuizBestScore(quizzes[q].quiz_id);
        if (best !== null && best > bestQuizScore) bestQuizScore = best;
        if (best !== null) quizScores.push(best);
      }
    }

    // Weighted formula: 40% completion + 40% best quiz + 20% consistency
    var consistency = quizScores.length > 0
      ? Math.round(quizScores.reduce(function (a, b) { return a + b; }, 0) / quizScores.length)
      : 0;

    var mastery = Math.round(
      (completionPct * 0.4) +
      (bestQuizScore * 0.4) +
      (consistency * 0.2)
    );
    mastery = Math.min(100, Math.max(0, mastery));

    var level;
    if (mastery >= 80) level = "mastered";
    else if (mastery >= 60) level = "proficient";
    else if (mastery >= 40) level = "developing";
    else level = "needs_improvement";

    return {
      score: mastery,
      level: level,
      completionPct: completionPct,
      bestQuizScore: bestQuizScore,
      avgQuizScore: consistency,
      quizzesAttempted: quizScores.length,
      quizzesTotal: quizCount,
    };
  }

  /**
   * Get weak topics for a course based on quiz results.
   */
  function mockGetWeakTopics(courseId) {
    var weakTopics = [];
    var quizzes = mockGetQuizzes(courseId);
    if (!quizzes || quizzes.length === 0) return weakTopics;

    for (var q = 0; q < quizzes.length; q++) {
      var quiz = quizzes[q];
      var best = mockGetQuizBestScore(quiz.quiz_id);
      if (best !== null && best < 75) {
        weakTopics.push({
          quizId: quiz.quiz_id,
          title: quiz.title,
          score: best,
          moduleId: quiz.module_id,
          lessonId: quiz.lesson_id,
          reason: best < 50
            ? "Your score of " + best + "% indicates a need for foundational review."
            : "Your score of " + best + "% suggests reviewing this topic would help."
        });
      }
    }
    return weakTopics;
  }

  /**
   * Get strong topics for a course based on quiz results.
   */
  function mockGetStrongTopics(courseId) {
    var strongTopics = [];
    var quizzes = mockGetQuizzes(courseId);
    if (!quizzes || quizzes.length === 0) return strongTopics;

    for (var q = 0; q < quizzes.length; q++) {
      var quiz = quizzes[q];
      var best = mockGetQuizBestScore(quiz.quiz_id);
      if (best !== null && best >= 75) {
        strongTopics.push({
          quizId: quiz.quiz_id,
          title: quiz.title,
          score: best,
          moduleId: quiz.module_id,
          lessonId: quiz.lesson_id,
        });
      }
    }
    return strongTopics;
  }

  /**
   * Get the recommended next step for a course.
   */
  function mockGetRecommendedNextStepForCourse(courseId) {
    var course = mockGetCourseById(courseId);
    if (!course) return null;

    var progress = mockGetCourseProgress(courseId);
    var mastery = mockGetStudentMastery(courseId);
    var quizzes = mockGetQuizzes(courseId);
    var quizResults = lpGetCourseQuizResults(courseId);
    var flatLessons = lpFlattenLessons(course);

    if (!progress || (progress.completedCount === 0 && quizResults.length === 0)) {
      return {
        type: "start",
        title: flatLessons.length > 0 ? flatLessons[0].title : "First Lesson",
        lessonId: flatLessons.length > 0 ? flatLessons[0].lessonId : null,
        message: "Start your learning journey with the first lesson.",
        actionLabel: "Start Learning",
        priority: "high",
      };
    }

    // Check if a quiz was recently failed (low score)
    var lowQuizzes = mockGetWeakTopics(courseId);
    if (lowQuizzes.length > 0) {
      var weakest = lowQuizzes[0];
      var retryUrl = "quiz.html?course=" + courseId + "&lesson=" + weakest.lessonId + "&quiz=" + weakest.quizId;
      return {
        type: "retry_quiz",
        title: weakest.title,
        quizId: weakest.quizId,
        lessonId: weakest.lessonId,
        quizUrl: retryUrl,
        message: weakest.reason + " We recommend reviewing and retrying this quiz.",
        actionLabel: "Review & Retry Quiz",
        priority: "high",
        score: weakest.score,
      };
    }

    // Check if there is a quiz that hasn't been attempted
    // (only relevant once the student has completed lessons)
    if (progress && progress.completedCount > 0 && quizzes && quizzes.length > quizResults.length) {
      for (var q = 0; q < quizzes.length; q++) {
        var quizResult = mockGetQuizResult(quizzes[q].quiz_id);
        if (!quizResult) {
          var quizUrl = "quiz.html?course=" + courseId + "&lesson=" + quizzes[q].lesson_id + "&quiz=" + quizzes[q].quiz_id;
          return {
            type: "take_quiz",
            title: quizzes[q].title,
            quizId: quizzes[q].quiz_id,
            lessonId: quizzes[q].lesson_id,
            quizUrl: quizUrl,
            message: "You have completed lessons in this course. Take the quiz so we can better personalize your learning path.",
            actionLabel: "Take Quiz",
            priority: "high",
          };
        }
      }
    }

    // Find next incomplete lesson
    if (progress && progress.completedLessons) {
      for (var i = 0; i < flatLessons.length; i++) {
        var isComplete = false;
        for (var c = 0; c < progress.completedLessons.length; c++) {
          if (progress.completedLessons[c] === flatLessons[i].lessonId) {
            isComplete = true;
            break;
          }
        }
        if (!isComplete && flatLessons[i].type !== "quiz") {
          return {
            type: "continue",
            title: flatLessons[i].title,
            lessonId: flatLessons[i].lessonId,
            moduleId: flatLessons[i].moduleId,
            message: "Keep up the momentum. Continue with the next lesson in your path.",
            actionLabel: "Continue Learning",
            priority: "medium",
            duration: flatLessons[i].duration,
          };
        }
      }
    }

    // Course completed
    if (progress && progress.progressPercentage >= 100) {
      return {
        type: "course_completed",
        title: course.title,
        message: "Congratulations! You have completed this course. Explore more courses to expand your skills.",
        actionLabel: "Explore More Courses",
        priority: "low",
      };
    }

    return {
      type: "continue",
      title: course.title,
      message: "Continue your learning journey.",
      actionLabel: "Continue Learning",
      priority: "medium",
    };
  }

  /**
   * Get the full learning path data for a course.
   */
  function mockGetLearningPathData(courseId) {
    var course = mockGetCourseById(courseId);
    if (!course) return null;

    var progress = mockGetCourseProgress(courseId);
    var mastery = mockGetStudentMastery(courseId);
    var recommendation = mockGetRecommendedNextStepForCourse(courseId);
    var weakTopics = mockGetWeakTopics(courseId);
    var strongTopics = mockGetStrongTopics(courseId);
    var flatLessons = lpFlattenLessons(course);
    var quizResults = lpGetCourseQuizResults(courseId);
    var quizzes = mockGetQuizzes(courseId);

    // Build timeline with status
    var completedLessons = progress ? progress.completedLessons : [];
    var timeline = [];

    for (var i = 0; i < flatLessons.length; i++) {
      var lesson = flatLessons[i];
      var status = "upcoming";
      var score = null;

      // Check if completed
      for (var c = 0; c < completedLessons.length; c++) {
        if (completedLessons[c] === lesson.lessonId) {
          status = "completed";
          break;
        }
      }

      // Check if it has a quiz and get score
      if (lesson.type === "quiz" && quizzes) {
        for (var q = 0; q < quizzes.length; q++) {
          if (quizzes[q].lesson_id === lesson.lessonId) {
            score = mockGetQuizBestScore(quizzes[q].quiz_id);
            if (score !== null && score < 60) {
              status = "needs_review";
            } else if (score !== null && status !== "needs_review") {
              status = "completed";
            }
            break;
          }
        }
      }

      // Determine current lesson (first incomplete non-quiz)
      if (status === "upcoming" && lesson.type !== "quiz") {
        var foundCurrent = false;
        for (var t = 0; t < timeline.length; t++) {
          if (timeline[t].status === "upcoming" && timeline[t].type !== "quiz") {
            foundCurrent = true;
            break;
          }
        }
        if (!foundCurrent || timeline.length === 0) {
          status = "current";
        }
      }

      timeline.push({
        lessonId: lesson.lessonId,
        title: lesson.title,
        type: lesson.type,
        duration: lesson.duration,
        moduleId: lesson.moduleId,
        moduleTitle: lesson.moduleTitle,
        status: status,
        score: score,
      });
    }

    // Compute stats
    var completedCount = progress ? progress.completedCount : 0;
    var totalLessons = flatLessons.length;
    var lastQuizResult = null;
    if (quizResults.length > 0) {
      lastQuizResult = quizResults[quizResults.length - 1];
    }

    return {
      course: course,
      progress: progress,
      mastery: mastery,
      recommendation: recommendation,
      weakTopics: weakTopics,
      strongTopics: strongTopics,
      timeline: timeline,
      stats: {
        completedLessons: completedCount,
        totalLessons: totalLessons,
        completionPct: progress ? progress.progressPercentage : 0,
        latestQuizScore: lastQuizResult ? lastQuizResult.score : null,
        bestQuizScore: mastery ? mastery.bestQuizScore : null,
        masteryLevel: mastery ? mastery.level : "needs_improvement",
        masteryScore: mastery ? mastery.score : 0,
        quizzesAttempted: mastery ? mastery.quizzesAttempted : 0,
        quizzesTotal: mastery ? mastery.quizzesTotal : 0,
      },
      hasActivity: completedCount > 0 || quizResults.length > 0,
    };
  }

  // ==================================================
  // MOCK AI TUTOR FUNCTIONS
  // ==================================================

  var _tutorCache = null;

  var _tutorTopicOrder = [
    "javascript", "function", "array", "html", "css",
    "python", "database", "sql", "algorithm", "loop", "variable", "quiz"
  ];

  function loadTutorData() {
    _tutorCache = _tutorCache || (function () {
      var raw = localStorage.getItem("learnsphere_tutor_data");
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    })();
    return _tutorCache;
  }

  function saveTutorData(data) {
    _tutorCache = data;
    localStorage.setItem("learnsphere_tutor_data", JSON.stringify(data));
  }

  function findTopic(text) {
    var data = loadTutorData();
    if (!data || !data.topics) return null;
    for (var i = 0; i < _tutorTopicOrder.length; i++) {
      var topic = data.topics[_tutorTopicOrder[i]];
      if (!topic || !topic.keywords) continue;
      for (var k = 0; k < topic.keywords.length; k++) {
        if (text.indexOf(topic.keywords[k]) !== -1) {
          return _tutorTopicOrder[i];
        }
      }
    }
    return null;
  }

  function buildTopicReply(topicKey, context) {
    var data = loadTutorData();
    var topic = data.topics[topicKey];
    var lines = [topic.intro, ""];
    var points = topic.points || [];
    for (var i = 0; i < points.length; i++) {
      lines.push("â€¢ " + points[i]);
    }
    if (topic.example) {
      lines.push("", "Example:", topic.example);
    }
    if (topicKey === "quiz" && data.quizPrompt) {
      var subject = context && context.course ? context.course : "the topic";
      lines.push("", data.quizPrompt.replace("{topic}", subject));
    }
    return lines.join("\n");
  }

  function buildPracticeQuestion(text, context) {
    var data = loadTutorData();
    var topicKey = findTopic(text) || (context && context.topicKey) || null;
    var pool = data.practiceQuestions || [];
    var matched = [];
    for (var i = 0; i < pool.length; i++) {
      if (!topicKey || pool[i].topic === topicKey) matched.push(pool[i]);
    }
    var list = matched.length ? matched : pool;
    var pick = list[Math.floor(Math.random() * list.length)];
    if (!pick) return null;
    return { question: pick.question, answer: pick.answer };
  }

  function buildExplainReply(context) {
    var data = loadTutorData();
    var templates = data.explainLessonTemplates || {};
    var isCompletion = /completed|finished|summary|review/i.test(context && context.message || "");
    var template = isCompletion && templates.completion
      ? templates.completion
      : templates.generic;
    if (!template) return null;
    return template.replace("{lessonTitle}", context && context.lessonTitle ? context.lessonTitle : "this concept");
  }

  function mockSendTutorMessage(message, context) {
    var data = loadTutorData();
    if (!data) {
      return { success: false, reply: "The AI tutor data could not be loaded. Please refresh the page and try again." };
    }

    var text = String(message || "").toLowerCase().replace(/\s+/g, " ").trim();
    var ctx = context || {};

    if (!text && ctx.action !== "explain" && ctx.action !== "practice") {
      return { success: false, reply: "Please type a question or choose a suggested topic below." };
    }

    var wantsPractice = ctx.action === "practice" || text.indexOf("practice") !== -1;
    if (wantsPractice) {
      var practice = buildPracticeQuestion(text, ctx);
      if (practice) {
        return {
          success: true,
          reply: practice.question,
          source: "practice",
          topic: findTopic(text),
          practice: practice
        };
      }
    }

    if (ctx.action === "explain" || text.indexOf("explain this concept") !== -1) {
      var explainReply = buildExplainReply(ctx);
      if (explainReply) {
        return { success: true, reply: explainReply, source: "explain", topic: ctx.topicKey || null, practice: null };
      }
    }

    var topicKey = findTopic(text);
    if (topicKey) {
      return { success: true, reply: buildTopicReply(topicKey, ctx), source: "topic", topic: topicKey, practice: null };
    }

    if (text.indexOf("example") !== -1) {
      var exampleTopic = data.topics["function"];
      return {
        success: true,
        reply: "Here is a simple example that shows the core idea:\n\n" + exampleTopic.example + "\n\nWould you like to see another example or a practice question?",
        source: "example",
        topic: "function",
        practice: null
      };
    }

    return { success: true, reply: data.genericResponse, source: "generic", topic: null, practice: null };
  }

  // ==================================================
  // MOCK FLASHCARD FUNCTIONS
  // ==================================================
  //
  // Flashcards use a simple, explainable spaced repetition
  // schedule. This is NOT a machine learning model.
  //
  // Schedule:
  //   Hard   -> review again after 1 day  (interval resets to 1)
  //   Medium -> review again after 3 days
  //   Easy   -> 7 days, then 14, then 30 for consecutive Easy ratings
  //   Mastered -> after 3 consecutive Easy ratings (cards are kept,
  //               never deleted, and can fall out of mastery if rated lower)

  var FLASHCARD_STORAGE_KEY = "ai_learning_flashcard_progress";
  var _flashcardsCache = null;

  function loadFlashcardsData() {
    if (_flashcardsCache) return _flashcardsCache;
    var raw = localStorage.getItem("learnsphere_flashcards_data");
    if (raw) {
      try {
        _flashcardsCache = JSON.parse(raw);
      } catch (e) {
        _flashcardsCache = null;
      }
    }
    return _flashcardsCache;
  }

  function saveFlashcardsData(data) {
    _flashcardsCache = data;
    localStorage.setItem("learnsphere_flashcards_data", JSON.stringify(data));
  }

  function getStoredFlashcardProgress() {
    var raw = localStorage.getItem(FLASHCARD_STORAGE_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveFlashcardProgress(allProgress) {
    localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(allProgress));
  }

  function getFlashcardUserId() {
    var student = mockGetCurrentStudent();
    return student ? student.id : "guest";
  }

  function getUserFlashcardProgress() {
    var store = getStoredFlashcardProgress();
    var user = getFlashcardUserId();
    return store[user] || {};
  }

  function saveUserFlashcardProgress(record) {
    var store = getStoredFlashcardProgress();
    var user = getFlashcardUserId();
    if (!store[user]) store[user] = {};
    store[user][record.card_id] = record;
    saveFlashcardProgress(store);
  }

  function startOfToday() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function startOfTomorrow() {
    return new Date(startOfToday().getTime() + 86400000);
  }

  function isSameLocalDay(dateA, dateB) {
    return dateA.getFullYear() === dateB.getFullYear() &&
      dateA.getMonth() === dateB.getMonth() &&
      dateA.getDate() === dateB.getDate();
  }

  function mockGetFlashcards(courseId) {
    var cards = loadFlashcardsData() || [];
    if (courseId === undefined || courseId === null) return cards;
    var result = [];
    for (var i = 0; i < cards.length; i++) {
      if (String(cards[i].course_id) === String(courseId)) {
        result.push(cards[i]);
      }
    }
    return result;
  }

  function findFlashcard(cardId) {
    var cards = loadFlashcardsData() || [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].card_id === cardId) return cards[i];
    }
    return null;
  }

  /**
   * Compute the next review for a rating using the rule-based schedule.
   * review: { rating, previous }
   * previous is an existing progress record for the card, or null.
   */
  function computeFlashcardSchedule(review) {
    var rating = review.rating;
    var prev = review.previous || null;
    var consecutiveEasy = prev ? (prev.consecutive_easy || 0) : 0;
    var intervalDays;
    var mastered = prev ? !!prev.mastered : false;

    if (rating === "hard") {
      intervalDays = 1;
      consecutiveEasy = 0;
      mastered = false;
    } else if (rating === "medium") {
      intervalDays = 3;
      consecutiveEasy = 0;
      mastered = false;
    } else {
      consecutiveEasy = consecutiveEasy + 1;
      if (consecutiveEasy === 1) intervalDays = 7;
      else if (consecutiveEasy === 2) intervalDays = 14;
      else intervalDays = 30;
      mastered = consecutiveEasy >= 3;
    }

    return {
      interval: intervalDays,
      consecutiveEasy: consecutiveEasy,
      mastered: mastered,
      nextReview: new Date(Date.now() + intervalDays * 86400000).toISOString(),
    };
  }

  function mockSaveFlashcardReview(review) {
    var card = findFlashcard(review.card_id);
    if (!card) {
      return { success: false, message: "Flashcard not found." };
    }
    if (["hard", "medium", "easy"].indexOf(review.rating) === -1) {
      return { success: false, message: "Invalid rating. Choose hard, medium, or easy." };
    }

    var progress = getUserFlashcardProgress();
    var prev = progress[review.card_id] || null;
    var schedule = computeFlashcardSchedule({ rating: review.rating, previous: prev });

    var record = {
      card_id: review.card_id,
      user: getFlashcardUserId(),
      last_reviewed: new Date().toISOString(),
      next_review: schedule.nextReview,
      interval: schedule.interval,
      difficulty: review.rating,
      review_count: (prev ? (prev.review_count || 0) : 0) + 1,
      consecutive_easy: schedule.consecutiveEasy,
      mastered: schedule.mastered,
    };

    saveUserFlashcardProgress(record);

    return {
      success: true,
      record: record,
      masteredNow: schedule.mastered && !(prev && prev.mastered),
    };
  }

  /**
   * Get cards that are due for review (reviewable today or overdue).
   * Returns enriched items: { card, progress }
   */
  function mockGetDueFlashcards(courseId) {
    var cards = mockGetFlashcards(courseId);
    var progress = getUserFlashcardProgress();
    var limit = startOfTomorrow().getTime();
    var now = Date.now();
    var result = [];

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var record = progress[card.card_id];
      if (!record) continue;
      var nextReviewTime = Date.parse(record.next_review);
      if (isNaN(nextReviewTime)) continue;
      // Due to be reviewed today (next_review is before the start of tomorrow).
      if (nextReviewTime < limit) {
        result.push({
          card: card,
          progress: record,
          overdue: nextReviewTime < startOfToday().getTime(),
          dueNow: nextReviewTime <= now,
        });
      }
    }

    result.sort(function (a, b) {
      return Date.parse(a.progress.next_review) - Date.parse(b.progress.next_review);
    });
    return result;
  }

  /**
   * Get flashcard progress statistics for a course.
   */
  function mockGetFlashcardProgress(courseId) {
    var cards = mockGetFlashcards(courseId);
    var progress = getUserFlashcardProgress();
    var map = {};
    var reviewedCount = 0;
    var masteredCount = 0;
    var newCount = 0;
    var dueCount = 0;
    var reviewedToday = 0;
    var limit = startOfTomorrow().getTime();
    var today = new Date();

    for (var i = 0; i < cards.length; i++) {
      var record = progress[cards[i].card_id];
      if (!record) {
        newCount++;
        continue;
      }
      map[cards[i].card_id] = record;
      reviewedCount++;
      if (record.mastered) masteredCount++;
      if (Date.parse(record.next_review) < limit) dueCount++;
      if (isSameLocalDay(new Date(record.last_reviewed), today)) reviewedToday++;
    }

    return {
      courseId: courseId,
      total: cards.length,
      map: map,
      reviewedCount: reviewedCount,
      newCount: newCount,
      masteredCount: masteredCount,
      dueCount: dueCount,
      reviewedToday: reviewedToday,
      needReviewCount: reviewedCount - masteredCount,
    };
  }

  /**
   * Describe a review timestamp in friendly terms.
   * Returns "Overdue", "Today", "Tomorrow", or a short date.
   */
  function mockDescribeNextReview(iso) {
    if (!iso) return "Not scheduled";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "Not scheduled";

    var now = new Date();
    if (date.getTime() <= now.getTime()) return "Overdue";

    var tomorrowStart = startOfTomorrow();
    var dayAfterStart = new Date(tomorrowStart.getTime() + 86400000);

    if (date.getTime() < tomorrowStart.getTime()) return "Today";
    if (date.getTime() < dayAfterStart.getTime()) return "Tomorrow";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /**
   * Get a revision summary for a course (or across all courses when
   * courseId is not provided).
   */
  function mockGetRevisionSummary(courseId) {
    var cards = mockGetFlashcards(courseId);
    var progress = getUserFlashcardProgress();
    var courses = loadCoursesData() || [];
    var limit = startOfTomorrow().getTime();
    var todayStart = startOfToday().getTime();
    var now = Date.now();

    var dueCount = 0;
    var overdueCount = 0;
    var reviewedToday = 0;
    var masteredCount = 0;
    var reviewedCount = 0;
    var newCount = 0;
    var needReviewCount = 0;
    var nextReview = null;
    var topicStats = {};
    var hardCount = 0;

    function courseTitleFor(courseId) {
      for (var i = 0; i < courses.length; i++) {
        if (String(courses[i].id) === String(courseId)) return courses[i].title;
      }
      return "";
    }

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var record = progress[card.card_id];

      if (!record) {
        newCount++;
        continue;
      }

      reviewedCount++;
      if (record.mastered) masteredCount++;

      var nextReviewTime = Date.parse(record.next_review);
      var due = !isNaN(nextReviewTime) && nextReviewTime < limit;
      var overdue = !isNaN(nextReviewTime) && nextReviewTime < todayStart;
      var reviewedOnTime = isSameLocalDay(new Date(record.last_reviewed), new Date());

      if (due) {
        dueCount++;
        if (overdue) overdueCount++;
        if (!topicStats[card.topic]) {
          topicStats[card.topic] = {
            topic: card.topic,
            courseId: card.course_id,
            courseTitle: courseTitleFor(card.course_id),
            count: 0,
            overdueCount: 0,
            hardCount: 0,
          };
        }
        topicStats[card.topic].count++;
        if (overdue) topicStats[card.topic].overdueCount++;
        if (record.difficulty === "hard") topicStats[card.topic].hardCount++;
      }

      if (reviewedOnTime) reviewedToday++;
      if (!record.mastered) needReviewCount++;
      if (record.difficulty === "hard") hardCount++;

      if (!isNaN(nextReviewTime) && nextReviewTime > now) {
        if (!nextReview || nextReviewTime < Date.parse(nextReview)) {
          nextReview = record.next_review;
        }
      }
    }

    var dueTopics = [];
    for (var key in topicStats) {
      if (!topicStats.hasOwnProperty(key)) continue;
      var t = topicStats[key];
      var priority = (t.overdueCount > 0 || t.hardCount > 0) ? "high"
        : (t.count > 0 ? "medium" : "low");
      dueTopics.push({
        topic: t.topic,
        courseId: t.courseId,
        courseTitle: t.courseTitle,
        count: t.count,
        overdueCount: t.overdueCount,
        hardCount: t.hardCount,
        priority: priority,
      });
    }

    dueTopics.sort(function (a, b) {
      var rank = { high: 0, medium: 1, low: 2 };
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
      return b.count - a.count;
    });

    return {
      total: cards.length,
      reviewedCount: reviewedCount,
      newCount: newCount,
      dueCount: dueCount,
      overdueCount: overdueCount,
      reviewedToday: reviewedToday,
      masteredCount: masteredCount,
      needReviewCount: needReviewCount,
      hardCount: hardCount,
      nextReview: nextReview,
      nextReviewDescription: mockDescribeNextReview(nextReview),
      dueTopics: dueTopics,
      hasActivity: reviewedCount > 0,
    };
  }

  // ==================================================
  // MOCK ANALYTICS FUNCTIONS
  // ==================================================
  // Rule-based student analytics computed from real
  // LocalStorage data: lesson progress, quiz results,
  // flashcard progress and course enrollment.
  // This is NOT a machine learning model.

  function analyticsGetCourses() {
    return loadCoursesData() || [];
  }

  function analyticsFindCourse(courseId) {
    var courses = analyticsGetCourses();
    for (var i = 0; i < courses.length; i++) {
      if (String(courses[i].id) === String(courseId)) return courses[i];
    }
    return null;
  }

  function analyticsCourseTitle(courseId) {
    var course = analyticsFindCourse(courseId);
    return course ? course.title : "";
  }

  function analyticsQuizTitle(quizId) {
    var quizzes = loadQuizzesData() || [];
    for (var i = 0; i < quizzes.length; i++) {
      if (String(quizzes[i].quiz_id) === String(quizId)) return quizzes[i].title;
    }
    return "";
  }

  function analyticsLessonTitle(course, lessonId) {
    if (!course || !course.curriculum || !lessonId) return "";
    for (var m = 0; m < course.curriculum.length; m++) {
      var mod = course.curriculum[m];
      if (!mod || !mod.lessons) continue;
      for (var l = 0; l < mod.lessons.length; l++) {
        if (String(mod.lessons[l].id) === String(lessonId)) {
          return mod.lessons[l].title;
        }
      }
    }
    return "";
  }

  function analyticsGetQuizResults() {
    var all = getStoredQuizResults();
    var user = mockGetCurrentStudent();
    var userId = user ? user.id : "guest";
    var mine = [];
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].user_id) === String(userId)) mine.push(all[i]);
    }
    return mine;
  }

  function analyticsMasteryLevel(pct) {
    if (pct >= 80) return "mastered";
    if (pct >= 60) return "proficient";
    if (pct >= 40) return "developing";
    return "needs_improvement";
  }

  function analyticsYMD(date) {
    var month = ("0" + (date.getMonth() + 1)).slice(-2);
    var day = ("0" + date.getDate()).slice(-2);
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function analyticsBuildWeek(daysSet) {
    var names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    var out = [];
    var now = new Date();
    for (var offset = 6; offset >= 0; offset--) {
      var d = new Date(now.getTime() - offset * 86400000);
      out.push({
        label: names[d.getDay()],
        active: !!(daysSet && daysSet[analyticsYMD(d)]),
        isToday: offset === 0,
      });
    }
    return out;
  }

  /**
   * Get course-wise analytics (progress) for every enrolled course.
   */
  function mockGetCourseAnalytics() {
    var enrolled = mockGetEnrolledCourses();
    var rows = [];
    for (var i = 0; i < enrolled.length; i++) {
      var course = mockGetCourseById(enrolled[i]);
      if (!course) continue;
      var progress = mockGetCourseProgress(enrolled[i]);
      var completed = progress ? progress.completedCount : 0;
      var total = progress ? progress.totalCount : (course.lessonsCount || 0);
      if (!total) continue;
      var pct = Math.min(100, Math.round((completed / total) * 100));
      var status = "not_started";
      if (pct >= 100) status = "completed";
      else if (pct >= 80) status = "almost_complete";
      else if (pct > 0) status = "in_progress";
      rows.push({
        courseId: course.id,
        title: course.title,
        category: course.category || "",
        difficulty: course.level || "",
        thumbnail: course.thumbnail || "",
        completedCount: completed,
        totalCount: total,
        progressPercentage: pct,
        status: status,
      });
    }
    rows.sort(function (a, b) {
      return b.progressPercentage - a.progressPercentage;
    });
    return rows;
  }

  /**
   * Get quiz analytics from real quiz results in LocalStorage.
   */
  function mockGetQuizAnalytics() {
    var results = analyticsGetQuizResults();
    var base = {
      hasData: false,
      attempts: 0,
      average: 0,
      best: 0,
      passed: 0,
      failed: 0,
      trend: [],
      recent: [],
    };
    var scores = [];
    var passed = 0;
    var trend = [];
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var score = Number(r.score);
      if (isNaN(score)) continue;
      scores.push(score);
      if (r.passed) passed++;
      trend.push({
        quizId: r.quiz_id,
        courseId: r.course_id,
        title: analyticsQuizTitle(r.quiz_id) || analyticsCourseTitle(r.course_id) || "Quiz",
        score: Math.round(score),
        passed: !!r.passed,
        completedAt: r.completed_at,
      });
    }
    if (!scores.length) return base;

    trend.sort(function (a, b) {
      return Date.parse(a.completedAt) - Date.parse(b.completedAt);
    });

    var total = scores.length;
    var sum = 0;
    for (var s = 0; s < scores.length; s++) sum += scores[s];
    var best = 0;
    for (var b2 = 0; b2 < scores.length; b2++) {
      if (scores[b2] > best) best = scores[b2];
    }

    var recent = trend.slice(-6).reverse();

    return {
      hasData: true,
      attempts: total,
      average: Math.round(sum / total),
      best: Math.round(best),
      passed: passed,
      failed: total - passed,
      trend: trend,
      recent: recent,
    };
  }

  /**
   * Get topic mastery from quiz + lesson performance.
   * Mastery = best quiz score on the topic, reduced by 15%
   * when the related lesson has not been completed yet.
   */
  function mockGetTopicMastery() {
    var results = analyticsGetQuizResults();
    var map = {};
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var score = Number(r.score);
      if (isNaN(score)) continue;
      var key = String(r.course_id) + "::" + String(r.lesson_id || r.quiz_id);
      var entry = map[key];
      if (!entry) {
        var course = analyticsFindCourse(r.course_id);
        var title = analyticsLessonTitle(course, r.lesson_id) ||
          analyticsQuizTitle(r.quiz_id) ||
          "Lesson " + (r.lesson_id || "");
        entry = map[key] = {
          topic: title,
          courseId: r.course_id,
          courseTitle: course ? course.title : "",
          best: -1,
          attempts: 0,
          lessonDone: false,
        };
      }
      if (score > entry.best) entry.best = score;
      entry.attempts++;
      if (r.lesson_id && mockIsLessonComplete(r.course_id, r.lesson_id)) {
        entry.lessonDone = true;
      }
    }

    var topics = [];
    for (var k in map) {
      if (!map.hasOwnProperty(k)) continue;
      var t = map[k];
      var lessonBonus = t.lessonDone ? 0 : -15;
      var pct = Math.min(100, Math.max(0, Math.round(t.best + lessonBonus)));
      topics.push({
        topic: t.topic,
        courseId: t.courseId,
        courseTitle: t.courseTitle,
        percent: pct,
        attempts: t.attempts,
        level: analyticsMasteryLevel(pct),
      });
    }

    topics.sort(function (a, b) {
      if (b.percent !== a.percent) return b.percent - a.percent;
      return a.topic.localeCompare(b.topic);
    });
    return topics;
  }

  /**
   * Build a recent learning activity feed from real stored data.
   * Sources: quiz results, flashcard reviews, course starts and
   * completions, and lesson completions (anchored to quiz times).
   */
  function mockGetLearningActivity() {
    var items = [];

    // Quiz completions (real timestamps)
    var results = analyticsGetQuizResults();
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      items.push({
        type: "quiz",
        timestamp: r.completed_at,
        title: "Completed quiz: " + (analyticsQuizTitle(r.quiz_id) || "Assessment"),
        meta: analyticsCourseTitle(r.course_id),
        detail: "Scored " + (Math.round(Number(r.score) || 0)) + "%",
      });
    }

    // Course started + completed
    var progress = getStoredProgress();
    var completedCourses = {};
    for (var key in progress) {
      if (!progress.hasOwnProperty(key)) continue;
      var p = progress[key];
      var course = mockGetCourseById(parseInt(key, 10));
      if (!course) continue;
      var lessonsTotal = course.lessonsCount || 0;
      var lessonsDone = (p.completedLessons || []).length;
      if (p.startedAt) {
        items.push({
          type: "course_start",
          timestamp: p.startedAt,
          title: "Started course: " + course.title,
          meta: course.category || "",
          detail: "Enrolled in " + (course.duration || "a course"),
        });
      }
      if (lessonsTotal && lessonsDone >= lessonsTotal) {
        completedCourses[parseInt(key, 10)] = true;
      }
    }

    // Anchor course completion to the most recent activity in that course
    if (results.length) {
      var latestInCourse = {};
      for (var j = results.length - 1; j >= 0; j--) {
        var rr = results[j];
        var cid = Number(rr.course_id);
        var at = Date.parse(rr.completed_at);
        if (completedCourses[cid] && latestInCourse[cid] === undefined && !isNaN(at)) {
          latestInCourse[cid] = rr.completed_at;
        }
      }
      for (var cdone in latestInCourse) {
        if (!latestInCourse.hasOwnProperty(cdone)) continue;
        var cCourse = mockGetCourseById(parseInt(cdone, 10));
        items.push({
          type: "course_complete",
          timestamp: latestInCourse[cdone],
          title: "Completed course: " + (cCourse ? cCourse.title : "A course"),
          meta: cCourse ? cCourse.category : "",
          detail: "Course finished",
        });
      }
    }

    // Flashcard reviews grouped per day + topic
    var flashcards = loadFlashcardsData() || [];
    var fprogress = getUserFlashcardProgress();
    var fgroups = {};
    for (var f = 0; f < flashcards.length; f++) {
      var card = flashcards[f];
      var rec = fprogress[card.card_id];
      if (!rec || !rec.last_reviewed) continue;
      var d = new Date(rec.last_reviewed);
      var gkey = analyticsYMD(d) + "::" + card.topic + "::" + card.course_id;
      if (!fgroups[gkey]) {
        fgroups[gkey] = {
          topic: card.topic,
          courseId: card.course_id,
          count: 0,
          updated: rec.last_reviewed,
        };
      }
      fgroups[gkey].count += 1;
      if (Date.parse(rec.last_reviewed) > Date.parse(fgroups[gkey].updated)) {
        fgroups[gkey].updated = rec.last_reviewed;
      }
    }
    for (var gk in fgroups) {
      if (!fgroups.hasOwnProperty(gk)) continue;
      var g = fgroups[gk];
      items.push({
        type: "revision",
        timestamp: g.updated,
        title: "Reviewed " + g.count + " " + g.topic + " flashcard" + (g.count === 1 ? "" : "s"),
        meta: analyticsCourseTitle(g.courseId),
        detail: "Spaced repetition review",
      });
    }

    // Lesson completions anchored to quiz times (quiz submission completes the lesson)
    var anchorLesson = {};
    for (var q = 0; q < results.length; q++) {
      var qr = results[q];
      if (!qr.lesson_id) continue;
      var lkey = String(qr.course_id) + "::" + qr.lesson_id;
      if (!anchorLesson[lkey] || Date.parse(qr.completed_at) > Date.parse(anchorLesson[lkey].at)) {
        anchorLesson[lkey] = { courseId: qr.course_id, lessonId: qr.lesson_id, at: qr.completed_at };
      }
    }
    for (var lk in anchorLesson) {
      if (!anchorLesson.hasOwnProperty(lk)) continue;
      var al = anchorLesson[lk];
      var courseL = mockGetCourseById(parseInt(al.courseId, 10));
      var lessonTitle = analyticsLessonTitle(courseL, al.lessonId);
      if (!lessonTitle) continue;
      if (!mockIsLessonComplete(al.courseId, al.lessonId)) continue;
      items.push({
        type: "lesson",
        timestamp: al.at,
        title: "Completed lesson: " + lessonTitle,
        meta: analyticsCourseTitle(al.courseId),
        detail: "Lesson complete",
      });
    }

    items.sort(function (a, b) {
      return Date.parse(b.timestamp) - Date.parse(a.timestamp);
    });
    return items.slice(0, 15);
  }

  /**
   * Compute learning streak from real activity timestamps.
   */
  function mockGetLearningStreakAnalytics() {
    var items = mockGetLearningActivity();
    var days = {};
    for (var i = 0; i < items.length; i++) {
      var d = new Date(items[i].timestamp);
      if (isNaN(d.getTime())) continue;
      days[analyticsYMD(d)] = true;
    }
    var dayList = Object.keys(days).sort();
    var learningDays = dayList.length;
    if (!learningDays) {
      return {
        hasData: false,
        current: 0,
        longest: 0,
        learningDays: 0,
        week: analyticsBuildWeek(null),
      };
    }

    var today = startOfToday();
    var todayYmd = analyticsYMD(today);
    var yesterday = new Date(today.getTime() - 86400000);
    var yesterdayYmd = analyticsYMD(yesterday);

    var current = 0;
    var cursor = null;
    if (days[todayYmd]) cursor = today;
    else if (days[yesterdayYmd]) cursor = yesterday;
    if (cursor) {
      current = 1;
      var prev = new Date(cursor.getTime() - 86400000);
      while (days[analyticsYMD(prev)]) {
        current++;
        prev = new Date(prev.getTime() - 86400000);
      }
    }

    var longest = 0;
    var run = 0;
    var lastDay = null;
    for (var k = 0; k < dayList.length; k++) {
      var dk = new Date(dayList[k] + "T00:00:00");
      if (lastDay && (dk.getTime() - lastDay.getTime()) === 86400000) run++;
      else run = 1;
      if (run > longest) longest = run;
      lastDay = dk;
    }

    return {
      hasData: true,
      current: current,
      longest: longest,
      learningDays: learningDays,
      week: analyticsBuildWeek(days),
    };
  }

  /**
   * Get revision (flashcard) analytics from ai_learning_flashcard_progress.
   */
  function mockGetRevisionAnalytics() {
    var cards = loadFlashcardsData() || [];
    var progress = getUserFlashcardProgress();
    var todayStart = startOfToday().getTime();
    var tomorrowStart = startOfTomorrow().getTime();
    var weekLater = todayStart + 7 * 86400000;

    var stats = {
      hasData: false,
      total: cards.length,
      reviewed: 0,
      newCards: 0,
      easy: 0,
      medium: 0,
      hard: 0,
      mastered: 0,
      due: 0,
      overdue: 0,
      dueToday: 0,
      upcoming: 0,
      priority: { high: 0, medium: 0, low: 0 },
    };

    for (var i = 0; i < cards.length; i++) {
      var rec = progress[cards[i].card_id];
      if (!rec) {
        stats.newCards++;
        continue;
      }
      stats.reviewed++;
      stats.hasData = true;
      if (rec.mastered) stats.mastered++;
      if (rec.difficulty === "easy") stats.easy++;
      else if (rec.difficulty === "medium") stats.medium++;
      else if (rec.difficulty === "hard") stats.hard++;

      var nextTime = Date.parse(rec.next_review);
      if (isNaN(nextTime)) continue;
      if (nextTime < todayStart) {
        stats.overdue++;
        stats.due++;
        stats.priority.high++;
      } else if (nextTime < tomorrowStart) {
        stats.dueToday++;
        stats.due++;
        stats.priority.medium++;
      } else if (nextTime <= weekLater) {
        stats.upcoming++;
        stats.priority.low++;
      }
    }
    return stats;
  }

  /**
   * Compare available historical performance (quiz average over time).
   * Only reports a comparison when real data exists.
   */
  function mockGetLearningImprovement() {
    var quiz = mockGetQuizAnalytics();
    var result = {
      hasComparison: false,
      quiz: null,
      note: "Complete at least two quizzes to see how your performance changes over time.",
    };
    if (quiz.hasData && quiz.attempts >= 2) {
      var trend = quiz.trend; // sorted oldest -> newest
      var sumPrev = 0;
      for (var i = 0; i < trend.length - 1; i++) sumPrev += trend[i].score;
      var previous = Math.round(sumPrev / (trend.length - 1));
      var current = trend[trend.length - 1].score;
      var status = "stable";
      if (current - previous >= 3) status = "improving";
      else if (previous - current >= 3) status = "needs_attention";
      result.hasComparison = true;
      result.quiz = {
        previous: previous,
        current: current,
        status: status,
        sampleSize: quiz.attempts,
      };
    }
    return result;
  }

  /**
   * Rule-based personalized learning insight (not AI).
   */
  function mockGetPersonalizedInsight() {
    var insights = [];
    var quiz = mockGetQuizAnalytics();
    var courses = mockGetCourseAnalytics();
    var rev = mockGetRevisionAnalytics();

    var lessonsTotal = 0;
    var lessonsDone = 0;
    for (var i = 0; i < courses.length; i++) {
      lessonsTotal += courses[i].totalCount;
      lessonsDone += courses[i].completedCount;
    }
    var lessonsPct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;

    if (quiz.hasData && quiz.average < 60) {
      insights.push("Your average quiz score is below 60%. Revise weak topics before moving to advanced lessons.");
    }
    if (quiz.hasData && quiz.average >= 80) {
      insights.push("Your quiz performance is strong. Keep it up by attempting more advanced quizzes.");
    }
    if (quiz.hasData && quiz.failed > 0 && quiz.average >= 60) {
      insights.push("Most of your quizzes are passing, but a few need another attempt. Review the failed topics before retrying.");
    }
    if (rev.due > 0) {
      insights.push("You have " + rev.due + (rev.due === 1 ? " flashcard due" : " flashcards due") +
        " for review. Complete today's revision to improve retention.");
    }
    if (lessonsPct >= 70 && quiz.hasData && quiz.average < 70) {
      insights.push("Your lesson progress is high but quiz performance is lower. Focus on practice and revision to close the gap.");
    }
    if (lessonsPct >= 100) {
      insights.push("You have completed all enrolled lessons. Explore new courses to keep growing.");
    }
    if (lessonsTotal > 0 && quiz.hasData && quiz.attempts < 2) {
      insights.push("Complete more quizzes to get a clearer picture of your topic mastery.");
    }

    if (!insights.length) {
      insights.push("Start a course, complete lessons and quizzes to receive personalized learning insights.");
    }
    return insights;
  }

  /**
   * Aggregate all analytics needed by the Student Analytics page.
   * Computed in a single pass to avoid repeated LocalStorage reads.
   */
  function mockGetAnalytics() {
    var courses = mockGetCourseAnalytics();
    var quiz = mockGetQuizAnalytics();
    var topics = mockGetTopicMastery();
    var streak = mockGetLearningStreakAnalytics();
    var rev = mockGetRevisionAnalytics();

    var lessonsTotal = 0;
    var lessonsDone = 0;
    var coursesEnrolled = courses.length;
    var coursesCompleted = 0;
    var activeCount = 0;
    for (var i = 0; i < courses.length; i++) {
      lessonsTotal += courses[i].totalCount;
      lessonsDone += courses[i].completedCount;
      if (courses[i].status === "completed") coursesCompleted++;
      if (courses[i].status !== "completed") activeCount++;
    }
    var overallPct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;

    var topicsMastered = 0;
    for (var t = 0; t < topics.length; t++) {
      if (topics[t].level === "mastered") topicsMastered++;
    }

    var kpis = [
      {
        id: "overall",
        title: "Overall Progress",
        value: overallPct + "%",
        supporting: lessonsTotal ? lessonsDone + " of " + lessonsTotal + " lessons completed" : "No lessons completed yet",
        progress: overallPct,
      },
      {
        id: "coursesEnrolled",
        title: "Courses Enrolled",
        value: String(coursesEnrolled),
        supporting: coursesEnrolled ? activeCount + " still in progress" : "Enroll in a course to get started",
        progress: null,
      },
      {
        id: "coursesCompleted",
        title: "Courses Completed",
        value: String(coursesCompleted),
        supporting: coursesEnrolled ? Math.round((coursesCompleted / coursesEnrolled) * 100) + "% of enrolled courses" : "No courses yet",
        progress: coursesEnrolled ? Math.round((coursesCompleted / coursesEnrolled) * 100) : 0,
      },
      {
        id: "lessons",
        title: "Lessons Completed",
        value: String(lessonsDone),
        supporting: lessonsTotal ? lessonsTotal - lessonsDone + " remaining" : "Start a course to unlock lessons",
        progress: lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0,
      },
      {
        id: "quizAvg",
        title: "Quiz Average",
        value: quiz.hasData ? quiz.average + "%" : "â€”",
        supporting: quiz.hasData ? quiz.passed + " passed, " + quiz.failed + " failed" : "Complete a quiz to see your average",
        progress: quiz.hasData ? quiz.average : null,
      },
      {
        id: "streak",
        title: "Learning Streak",
        value: streak.hasData ? streak.current + " days" : "â€”",
        supporting: streak.hasData ? "Longest " + streak.longest + " days" : "Start learning today to build your streak",
        progress: null,
      },
      {
        id: "flashcards",
        title: "Flashcards Reviewed",
        value: String(rev.reviewed),
        supporting: rev.due > 0 ? rev.due + " due for review" : (rev.hasData ? "All caught up" : "Study flashcards to get started"),
        progress: rev.total ? Math.round((rev.reviewed / rev.total) * 100) : 0,
      },
      {
        id: "topicsMastered",
        title: "Topics Mastered",
        value: String(topicsMastered),
        supporting: quiz.hasData ? quiz.attempts + " quizzes attempted" : "Complete quizzes to unlock mastery",
        progress: topics.length ? Math.round((topicsMastered / topics.length) * 100) : 0,
      },
    ];

    return {
      kpis: kpis,
      overall: {
        percent: overallPct,
        lessonsDone: lessonsDone,
        lessonsTotal: lessonsTotal,
        coursesCompleted: coursesCompleted,
        coursesEnrolled: coursesEnrolled,
      },
      courses: courses,
      quiz: quiz,
      topics: topics,
      activity: mockGetLearningActivity(),
      streak: streak,
      revision: rev,
      improvement: mockGetLearningImprovement(),
      insight: mockGetPersonalizedInsight(),
    };
  }

  // ==================================================
  // MOCK ACHIEVEMENTS & GAMIFICATION FUNCTIONS
  // ==================================================
  // XP and achievement progress are computed from real
  // LocalStorage data: lesson progress, quiz results,
  // flashcard progress, course enrollment and streak.
  // XP is awarded once per activity using unique ids,
  // so refreshing the page never duplicates rewards.
  //
  // (Future: api.js -> Flask REST API -> MySQL)

  var ACHIEVEMENTS_STORAGE_KEY = "ai_learning_achievements";
  var XP_STORAGE_KEY = "ai_learning_xp";
  var _achievementsCache = null;

  function getStoredAchievementState() {
    var raw = localStorage.getItem(ACHIEVEMENTS_STORAGE_KEY);
    var data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = {};
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    return data;
  }

  function saveAchievementState(store) {
    var data = {};
    if (store && typeof store === "object") data = store;
    localStorage.setItem(ACHIEVEMENTS_STORAGE_KEY, JSON.stringify(data));
  }

  function getStoredXpData() {
    var raw = localStorage.getItem(XP_STORAGE_KEY);
    var data = null;
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch (e) {
      data = {};
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) data = {};
    return data;
  }

  function getXpLedger(userId) {
    var store = getStoredXpData();
    var userXp = store[userId];
    if (!userXp || typeof userXp !== "object") {
      userXp = { total: 0, entries: [] };
      store[userId] = userXp;
    }
    if (!Array.isArray(userXp.entries)) userXp.entries = [];
    return { store: store, userXp: userXp };
  }

  function saveXpData(store) {
    localStorage.setItem(XP_STORAGE_KEY, JSON.stringify(store));
  }

  function recomputeXpTotal(userXp) {
    var total = 0;
    for (var i = 0; i < userXp.entries.length; i++) {
      total += Number(userXp.entries[i].amount) || 0;
    }
    userXp.total = total;
  }

  function xpHasEntry(userXp, id) {
    for (var i = 0; i < userXp.entries.length; i++) {
      if (userXp.entries[i].id === id) return true;
    }
    return false;
  }

  function awardXp(userId, entry) {
    var holder = getXpLedger(userId);
    if (xpHasEntry(holder.userXp, entry.id)) return null;
    holder.userXp.entries.push({
      id: entry.id,
      amount: Number(entry.amount) || 0,
      label: entry.label || "Learning activity",
      meta: entry.meta || "",
      date: entry.date || new Date().toISOString(),
    });
    recomputeXpTotal(holder.userXp);
    saveXpData(holder.store);
    return holder.userXp.entries[holder.userXp.entries.length - 1];
  }

  function gamificationYMD(date) {
    var month = ("0" + (date.getMonth() + 1)).slice(-2);
    var day = ("0" + date.getDate()).slice(-2);
    return date.getFullYear() + "-" + month + "-" + day;
  }

  /**
   * Level formula:
   * Level 1: 0-99 XP, Level 2: 100-249 XP, Level 3: 250-499 XP,
   * Level 4: 500-999 XP, Level 5: 1000-1499 XP,
   * then each level spans 500 XP (1500-1999, 2000-2499, ...).
   */
  function xpLevelInfo(xp) {
    xp = Number(xp) || 0;
    var level, floor, nextFloor;
    if (xp < 100) {
      level = 1;
      floor = 0;
      nextFloor = 100;
    } else if (xp < 250) {
      level = 2;
      floor = 100;
      nextFloor = 250;
    } else if (xp < 500) {
      level = 3;
      floor = 250;
      nextFloor = 500;
    } else if (xp < 1000) {
      level = 4;
      floor = 500;
      nextFloor = 1000;
    } else {
      level = 5 + Math.floor((xp - 1000) / 500);
      floor = 1000 + (level - 5) * 500;
      nextFloor = floor + 500;
    }
    var span = nextFloor - floor;
    var into = xp - floor;
    var pct = span > 0 ? Math.round((into / span) * 100) : 100;
    return {
      level: level,
      floor: floor,
      nextLevelAt: nextFloor,
      xpIntoLevel: into,
      levelSpan: span,
      levelPct: Math.min(100, Math.max(0, pct)),
      remaining: Math.max(0, nextFloor - xp),
    };
  }

  function gamificationLessonTitle(course, lessonId) {
    if (!course || !course.curriculum || !lessonId) return "";
    for (var m = 0; m < course.curriculum.length; m++) {
      var mod = course.curriculum[m];
      if (!mod || !mod.lessons) continue;
      for (var l = 0; l < mod.lessons.length; l++) {
        if (String(mod.lessons[l].id) === String(lessonId)) {
          return mod.lessons[l].title;
        }
      }
    }
    return "";
  }

  /**
   * Anchor for a lesson completion: the matching quiz result
   * timestamp when available, otherwise the course start time.
   */
  function lessonCompletedAt(courseId, lessonId, fallbackIso) {
    var results = analyticsGetQuizResults();
    for (var i = 0; i < results.length; i++) {
      if (
        results[i].lesson_id &&
        String(results[i].lesson_id) === String(lessonId) &&
        Number(results[i].course_id) === Number(courseId)
      ) {
        return results[i].completed_at;
      }
    }
    return fallbackIso || new Date().toISOString();
  }

  /**
   * Latest quiz completion date within a course (used to anchor
   * course completion XP) or the course start date.
   */
  function courseCompletedAt(courseId, startedAt) {
    var results = analyticsGetQuizResults();
    var latest = null;
    for (var i = 0; i < results.length; i++) {
      if (Number(results[i].course_id) === Number(courseId)) {
        var t = Date.parse(results[i].completed_at);
        if (!latest || t > Date.parse(latest)) latest = results[i].completed_at;
      }
    }
    return latest || startedAt || new Date().toISOString();
  }

  /**
   * Collect the current state of the student's stored activity.
   */
  function computeGamificationStats() {
    var stats = {
      lessonsCompleted: 0,
      quizAttempts: 0,
      quizPassed: 0,
      quizAverage: 0,
      coursesStarted: 0,
      coursesCompleted: 0,
      currentStreak: 0,
      longestStreak: 0,
      flashcardsReviewed: 0,
      flashcardsMastered: 0,
      revisionDays: 0,
      xpTotal: 0,
    };

    // Lessons (unique per course + lesson)
    var progressMap = getStoredProgress();
    var seenLessons = {};
    for (var key in progressMap) {
      if (!progressMap.hasOwnProperty(key)) continue;
      var p = progressMap[key];
      if (!p || !Array.isArray(p.completedLessons)) continue;
      for (var i = 0; i < p.completedLessons.length; i++) {
        var lid = String(p.completedLessons[i]);
        if (seenLessons[key + "::" + lid]) continue;
        seenLessons[key + "::" + lid] = true;
        stats.lessonsCompleted++;
      }
    }

    // Quizzes from real result history
    var results = analyticsGetQuizResults();
    stats.quizAttempts = results.length;
    var scores = [];
    for (var q = 0; q < results.length; q++) {
      if (results[q].passed) stats.quizPassed++;
      var sc = Number(results[q].score);
      if (!isNaN(sc)) scores.push(sc);
    }
    if (scores.length) {
      var sum = 0;
      for (var s = 0; s < scores.length; s++) sum += scores[s];
      stats.quizAverage = Math.round(sum / scores.length);
    }

    // Courses started / completed
    var enrolled = mockGetEnrolledCourses();
    stats.coursesStarted = enrolled.length;
    for (var c = 0; c < enrolled.length; c++) {
      var prog = mockGetCourseProgress(enrolled[c]);
      if (prog && prog.totalCount && prog.completedCount >= prog.totalCount) {
        stats.coursesCompleted++;
      }
    }

    // Streak from real timestamps
    var streak = mockGetLearningStreakAnalytics();
    if (streak) {
      stats.currentStreak = streak.current || 0;
      stats.longestStreak = streak.longest || 0;
    }

    // Flashcards reviewed / mastered / active revision days
    var cards = loadFlashcardsData() || [];
    var fprogress = getUserFlashcardProgress();
    var revisionDays = {};
    for (var f = 0; f < cards.length; f++) {
      var rec = fprogress[cards[f].card_id];
      if (!rec) continue;
      stats.flashcardsReviewed++;
      if (rec.mastered) stats.flashcardsMastered++;
      var d = new Date(rec.last_reviewed);
      if (!isNaN(d.getTime())) {
        revisionDays[gamificationYMD(d)] = true;
      }
    }
    stats.revisionDays = Object.keys(revisionDays).length;

    return stats;
  }

  /**
   * Award XP for every detected activity the student has performed.
   * Every reward uses a unique id tied to the activity itself, so
   * repeated page loads never create duplicate XP.
   */
  function awardActivityXp(userId, stats) {
    // Lessons: +10 XP each
    var progressMap = getStoredProgress();
    for (var key in progressMap) {
      if (!progressMap.hasOwnProperty(key)) continue;
      var p = progressMap[key];
      var cid = parseInt(key, 10);
      var course = mockGetCourseById(cid);
      if (!p || !Array.isArray(p.completedLessons)) continue;
      for (var i = 0; i < p.completedLessons.length; i++) {
        var lid = String(p.completedLessons[i]);
        awardXp(userId, {
          id: "lesson:" + cid + ":" + lid,
          amount: 10,
          label: "Lesson completed",
          meta: gamificationLessonTitle(course, lid) || (course ? course.title : ""),
          date: lessonCompletedAt(cid, lid, p.startedAt),
        });
      }
    }

    // Quizzes: +20 XP for completion, +30 XP extra when passed
    var results = analyticsGetQuizResults();
    for (var r = 0; r < results.length; r++) {
      var quizTitle = analyticsQuizTitle(results[r].quiz_id) ||
        analyticsCourseTitle(results[r].course_id) || "Quiz";
      awardXp(userId, {
        id: "quiz:" + results[r].result_id,
        amount: 20,
        label: "Quiz completed",
        meta: quizTitle,
        date: results[r].completed_at,
      });
      if (results[r].passed) {
        awardXp(userId, {
          id: "quizpass:" + results[r].result_id,
          amount: 30,
          label: "Quiz passed",
          meta: quizTitle,
          date: results[r].completed_at,
        });
      }
    }

    // Flashcards: +5 XP per recorded review event
    var cards = loadFlashcardsData() || [];
    var fprogress = getUserFlashcardProgress();
    for (var f = 0; f < cards.length; f++) {
      var rec = fprogress[cards[f].card_id];
      if (!rec) continue;
      var count = Number(rec.review_count) || 0;
      var topic = cards[f].topic || "flashcards";
      for (var step = 1; step <= count; step++) {
        awardXp(userId, {
          id: "fc:" + cards[f].card_id + ":" + step,
          amount: 5,
          label: "Flashcard reviewed",
          meta: topic,
          date: rec.last_reviewed || new Date().toISOString(),
        });
      }
    }

    // Revision days: +15 XP per active revision day
    var daySet = {};
    for (var fd = 0; fd < cards.length; fd++) {
      var recf = fprogress[cards[fd].card_id];
      if (!recf) continue;
      var dd = new Date(recf.last_reviewed);
      if (!isNaN(dd.getTime())) daySet[gamificationYMD(dd)] = true;
    }
    for (var ymd in daySet) {
      if (!daySet.hasOwnProperty(ymd)) continue;
      awardXp(userId, {
        id: "session:" + ymd,
        amount: 15,
        label: "Revision session completed",
        meta: ymd,
        date: ymd + "T12:00:00",
      });
    }

    // Completed courses: +100 XP each
    var enrolled = mockGetEnrolledCourses();
    for (var c = 0; c < enrolled.length; c++) {
      var prog2 = mockGetCourseProgress(enrolled[c]);
      if (prog2 && prog2.totalCount && prog2.completedCount >= prog2.totalCount) {
        var course2 = mockGetCourseById(enrolled[c]);
        awardXp(userId, {
          id: "course:" + enrolled[c],
          amount: 100,
          label: "Course completed",
          meta: course2 ? course2.title : "Course completed",
          date: courseCompletedAt(enrolled[c], prog2.startedAt),
        });
      }
    }

    // Streak milestones: +10 XP per qualifying milestone reached
    var milestones = [3, 7, 14, 21, 30, 50, 100, 200, 365];
    var longestStreak = 0;
    var streakInfo = mockGetLearningStreakAnalytics();
    if (streakInfo) longestStreak = streakInfo.longest || 0;
    for (var m = 0; m < milestones.length; m++) {
      if (longestStreak >= milestones[m]) {
        awardXp(userId, {
          id: "streak:" + milestones[m],
          amount: 10,
          label: "Learning streak milestone",
          meta: milestones[m] + "-day streak",
          date: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Evaluate a single achievement against the student's stats.
   */
  function evaluateAchievement(def, stats) {
    var value = 0;
    var type = def.type;
    if (type === "lessons") value = stats.lessonsCompleted;
    else if (type === "quizzes_attempted") value = stats.quizAttempts;
    else if (type === "quizzes_passed") value = stats.quizPassed;
    else if (type === "quiz_average") value = stats.quizAverage;
    else if (type === "courses_started") value = stats.coursesStarted;
    else if (type === "courses_completed") value = stats.coursesCompleted;
    else if (type === "streak") value = stats.longestStreak;
    else if (type === "flashcards_reviewed") value = stats.flashcardsReviewed;
    else if (type === "flashcards_mastered") value = stats.flashcardsMastered;
    else if (type === "revision_days") value = stats.revisionDays;
    else if (type === "xp_total") value = stats.xpTotal;

    var target = Number(def.target) || 1;
    var complete = value >= target;
    if (type === "quiz_average" && stats.quizAttempts < 2) complete = false;

    var pct = Math.min(100, Math.round((value / target) * 100));
    if (pct > 100) pct = 100;

    return {
      value: value,
      target: target,
      complete: complete,
      pct: pct,
    };
  }

  function buildProgressText(def, value, target, unlocked) {
    if (unlocked) {
      return Number(target) + " / " + Number(target) + " " + def.unit;
    }
    if (def.type === "quiz_average") {
      return value + "% / " + target + "% " + (def.unit || "average");
    }
    if (def.type === "xp_total") {
      return value + " / " + target + " XP";
    }
    if (def.type === "streak") {
      return value + " / " + target + "-day streak";
    }
    return value + " / " + target + " " + (def.unit || "target");
  }

  /**
   * Complete synchronisation: awards XP for new activities,
   * unlocks earned achievements, records unlock dates and
   * returns everything the Achievements page needs.
   */
  function mockGetAchievementProgress() {
    var user = mockGetCurrentStudent();
    var empty = {
      xp: xpLevelInfo(0),
      summary: {
        totalXp: 0,
        level: 1,
        achievementsUnlocked: 0,
        achievementsTotal: 0,
        achievementsRemaining: 0,
        currentStreak: 0,
        longestStreak: 0,
      },
      achievements: [],
      nextAchievement: null,
      recentUnlocked: [],
      xpHistory: [],
      newlyUnlocked: [],
    };
    if (!user) return empty;

    var defs = getAchievementDefinitions();
    if (!defs || !defs.length) {
      empty.summary.achievementsTotal = defs ? defs.length : 0;
      return empty;
    }

    var stats = computeGamificationStats();

    // 1) Award XP for any new real activities (deduplicated ids)
    awardActivityXp(user.id, stats);

    // 2) Unlock any achievements that are now earned.
    var unlockStore = getStoredAchievementState();
    if (!unlockStore[user.id]) unlockStore[user.id] = {};
    var userUnlocks = unlockStore[user.id];
    var newlyUnlocked = [];
    var pass = 0;
    var changed = true;
    while (changed && pass < 5) {
      changed = false;
      pass++;
      stats.xpTotal = getXpLedger(user.id).userXp.total;
      for (var d = 0; d < defs.length; d++) {
        var def = defs[d];
        if (userUnlocks[def.id] && userUnlocks[def.id].unlocked) continue;
        var assess = evaluateAchievement(def, stats);
        if (!assess.complete) continue;
        userUnlocks[def.id] = {
          unlocked: true,
          date: new Date().toISOString(),
        };
        awardXp(user.id, {
          id: "ach:" + def.id,
          amount: Number(def.xp) || 0,
          label: "Achievement unlocked",
          meta: def.name,
          date: new Date().toISOString(),
        });
        newlyUnlocked.push({
          id: def.id,
          icon: def.icon,
          name: def.name,
          category: def.category,
          xp: Number(def.xp) || 0,
        });
        stats.xpTotal += Number(def.xp) || 0;
        changed = true;
      }
    }
    if (newlyUnlocked.length) {
      saveAchievementState(unlockStore);
    }

    // 3) Build the full achievement list with live progress.
    var achievements = [];
    var unlockedCount = 0;
    for (var a = 0; a < defs.length; a++) {
      var adef = defs[a];
      var st = userUnlocks[adef.id];
      var unlocked = !!(st && st.unlocked);
      var assess2 = evaluateAchievement(adef, stats);
      if (unlocked) unlockedCount++;
      achievements.push({
        id: adef.id,
        category: adef.category,
        icon: adef.icon,
        name: adef.name,
        description: adef.description,
        requirement: adef.requirement,
        xp: Number(adef.xp) || 0,
        type: adef.type,
        unit: adef.unit,
        value: unlocked ? assess2.target : assess2.value,
        target: assess2.target,
        progressPercentage: unlocked ? 100 : assess2.pct,
        unlocked: unlocked,
        unlockDate: unlocked ? (st.date || "") : "",
        progressText: buildProgressText(adef, assess2.value, assess2.target, unlocked),
        remainingText: buildRemainingText(adef, assess2.value, assess2.target),
      });
    }

    var xpInfo = xpLevelInfo(stats.xpTotal);
    var currentStreak = stats.currentStreak;
    var longestStreak = stats.longestStreak;

    // 4) Recently unlocked (newest 5).
    var recent = [];
    var dates = [];
    for (var uid in userUnlocks) {
      if (!userUnlocks.hasOwnProperty(uid)) continue;
      if (!userUnlocks[uid] || !userUnlocks[uid].unlocked) continue;
      var entry = null;
      for (var idx = 0; idx < defs.length; idx++) {
        if (defs[idx].id === uid) {
          entry = defs[idx];
          break;
        }
      }
      if (!entry) continue;
      recent.push({
        id: uid,
        icon: entry.icon,
        name: entry.name,
        category: entry.category,
        xp: Number(entry.xp) || 0,
        unlockDate: userUnlocks[uid].date || "",
      });
      dates.push(userUnlocks[uid].date || "");
    }
    recent.sort(function (x, y) {
      return Date.parse(y.unlockDate) - Date.parse(x.unlockDate);
    });
    recent = recent.slice(0, 5);

    // 5) Next achievement: closest incomplete one.
    var nextAchievement = null;
    var bestGap = -1;
    for (var n = 0; n < achievements.length; n++) {
      if (achievements[n].unlocked) continue;
      var gap = achievements[n].target - achievements[n].value;
      if (gap < 0) gap = 0;
      if (bestGap === -1 || gap < bestGap) {
        bestGap = gap;
        nextAchievement = achievements[n];
      } else if (gap === bestGap && nextAchievement &&
        achievements[n].target < nextAchievement.target) {
        nextAchievement = achievements[n];
      }
    }

    // 6) XP history (newest first).
    var ledger = getXpLedger(user.id);
    var history = ledger.userXp.entries.slice(0);
    history.sort(function (x, y) {
      var dx = Date.parse(x.date) || 0;
      var dy = Date.parse(y.date) || 0;
      if (dy !== dx) return dy - dx;
      return 0;
    });

    return {
      xp: xpInfo,
      summary: {
        totalXp: stats.xpTotal,
        level: xpInfo.level,
        achievementsUnlocked: unlockedCount,
        achievementsTotal: achievements.length,
        achievementsRemaining: achievements.length - unlockedCount,
        currentStreak: currentStreak,
        longestStreak: longestStreak,
      },
      achievements: achievements,
      nextAchievement: nextAchievement,
      recentUnlocked: recent,
      xpHistory: history,
      newlyUnlocked: newlyUnlocked,
    };
  }

  function buildRemainingText(def, value, target) {
    var gap = target - value;
    if (gap <= 0) return "";
    if (def.type === "quiz_average") {
      return gap + "% average to reach " + target + "%";
    }
    if (def.type === "xp_total") {
      return gap + " XP to earn " + target + " XP";
    }
    if (def.type === "streak") {
      return gap + " more day" + (gap === 1 ? "" : "s") + " for a " + target + "-day streak";
    }
    return gap + " more " + (def.unit || "required") + " to unlock";
  }

  function getAchievementDefinitions() {
    if (_achievementsCache && Array.isArray(_achievementsCache)) {
      return _achievementsCache;
    }
    return [];
  }

  /**
   * Persist the unlock state for an achievement. Only allowed when
   * the requirement is actually met, so achievements are never
   * hard-coded as unlocked.
   */
  function mockSaveAchievementState(achievementId) {
    var user = mockGetCurrentStudent();
    if (!user || !achievementId) {
      return { success: false, message: "Not available." };
    }
    var defs = getAchievementDefinitions();
    var def = null;
    for (var i = 0; i < defs.length; i++) {
      if (defs[i].id === achievementId) {
        def = defs[i];
        break;
      }
    }
    if (!def) {
      return { success: false, message: "Unknown achievement." };
    }
    var stats = computeGamificationStats();
    stats.xpTotal = getXpLedger(user.id).userXp.total;
    var assess = evaluateAchievement(def, stats);
    if (!assess.complete) {
      return { success: false, message: "Requirement not met yet." };
    }
    var unlockStore = getStoredAchievementState();
    if (!unlockStore[user.id]) unlockStore[user.id] = {};
    if (unlockStore[user.id][achievementId] && unlockStore[user.id][achievementId].unlocked) {
      return { success: true, message: "Already unlocked." };
    }
    unlockStore[user.id][achievementId] = {
      unlocked: true,
      date: new Date().toISOString(),
    };
    saveAchievementState(unlockStore);
    awardXp(user.id, {
      id: "ach:" + achievementId,
      amount: Number(def.xp) || 0,
      label: "Achievement unlocked",
      meta: def.name,
      date: new Date().toISOString(),
    });
    return { success: true, achievementId: achievementId, xp: Number(def.xp) || 0 };
  }

  // ==================================================
  // MOCK LEADERBOARD & RANKING FUNCTIONS
  // ==================================================
  // The leaderboard mixes sample students loaded from
  // data/leaderboard.json (DEMO data) with the current
  // student, whose row is always computed from real
  // LocalStorage (XP ledger, quiz results, streak and
  // unlocked achievements). Ranks are derived, never
  // hard-coded. No private data is ever exposed.

  var _leaderboardCache = null;

  function initLeaderboardData(data) {
    var list = [];
    if (Array.isArray(data)) list = data;
    else if (data && typeof data === "object" && Array.isArray(data.students)) {
      list = data.students;
    }
    _leaderboardCache = list;
  }

  /**
   * Combined "Overall" score used for Overall ranking.
   * Weighted so a balanced learner (XP + achievements +
   * streak + quiz performance) ranks well.
   */
  function leaderboardScore(row, category) {
    if (category === "xp") return Number(row.xp) || 0;
    if (category === "quiz") return Number(row.quizAverage) || 0;
    if (category === "streak") return Number(row.currentStreak) || 0;
    if (category === "achievements") return Number(row.achievementsUnlocked) || 0;
    return (
      (Number(row.xp) || 0) +
      (Number(row.achievementsUnlocked) || 0) * 100 +
      (Number(row.currentStreak) || 0) * 25 +
      (Number(row.quizAverage) || 0) * 5
    );
  }

  /**
   * Build a public-safe student record. Never includes
   * private information (email, passwords, tokens).
   * Level/progress is derived from XP for consistency.
   */
  function leaderboardPublicRow(student, isCurrentUser) {
    var name = String((student && student.displayName) || "Student").trim() || "Student";
    var xp = Number(student.xp) || 0;
    var info = xpLevelInfo(xp);
    return {
      id: String((student && student.id) || ""),
      displayName: name,
      avatarInitial: (
        String((student && student.avatarInitial) || "").trim() ||
        name.charAt(0) ||
        "S"
      ).toUpperCase(),
      level: info.level,
      xp: xp,
      levelPct: info.levelPct,
      xpIntoLevel: info.xpIntoLevel,
      remaining: info.remaining,
      quizAverage: Number(student.quizAverage) || 0,
      currentStreak: Number(student.currentStreak) || 0,
      achievementsUnlocked: Number(student.achievementsUnlocked) || 0,
      isCurrentUser: !!isCurrentUser,
    };
  }

  /**
   * The current student's leaderboard row, computed from
   * real stored activity (same sources as the Achievements
   * module). Returns null when no student is logged in.
   */
  function buildCurrentStudentRow() {
    var user = mockGetCurrentStudent();
    if (!user) return null;

    var stats = computeGamificationStats();
    awardActivityXp(user.id, stats);

    var ledger = getXpLedger(user.id);
    var total = Number(ledger.userXp.total) || 0;

    var unlocks = getStoredAchievementState()[user.id];
    var count = 0;
    if (unlocks && typeof unlocks === "object") {
      for (var k in unlocks) {
        if (unlocks.hasOwnProperty(k) && unlocks[k] && unlocks[k].unlocked) count++;
      }
    }

    var name = String(user.name || "").trim();
    if (!name) name = String(user.email || "").split("@")[0] || "Student";

    return leaderboardPublicRow(
      {
        id: user.id,
        displayName: name,
        avatarInitial: name.charAt(0),
        xp: total,
        quizAverage: stats.quizAverage || 0,
        currentStreak: stats.currentStreak || 0,
        achievementsUnlocked: count,
      },
      true
    );
  }

  /**
   * Build a sorted leaderboard for a category:
   * overall, xp, quiz, streak, achievements.
   * Merges mock DEMO students with the current user
   * (deduplicated by id) and assigns competition ranks
   * (ties share a rank; next different entry skips ahead).
   */
  function buildLeaderboardBoard(category) {
    var cat = category || "overall";
    var rows = [];

    var mock = _leaderboardCache || [];
    for (var i = 0; i < mock.length; i++) {
      if (!mock[i] || typeof mock[i] !== "object") continue;
      rows.push(leaderboardPublicRow(mock[i], false));
    }

    var me = buildCurrentStudentRow();
    if (me) {
      var replaced = false;
      for (var j = 0; j < rows.length; j++) {
        if (rows[j].id && me.id && rows[j].id === me.id) {
          rows[j] = me;
          replaced = true;
          break;
        }
      }
      if (!replaced) rows.push(me);
    }

    rows.sort(function (a, b) {
      var sa = leaderboardScore(a, cat);
      var sb = leaderboardScore(b, cat);
      if (sb !== sa) return sb - sa;
      var na = a.displayName.toLowerCase();
      var nb = b.displayName.toLowerCase();
      if (na !== nb) return na < nb ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    var lastScore = NaN;
    var lastRank = 1;
    for (var r = 0; r < rows.length; r++) {
      var sc = leaderboardScore(rows[r], cat);
      if (r === 0 || sc !== lastScore) {
        lastRank = r + 1;
        lastScore = sc;
      }
      rows[r].rank = lastRank;
      rows[r].score = sc;
    }

    return {
      category: cat,
      total: rows.length,
      updatedAt: new Date().toISOString(),
      students: rows,
    };
  }

  // ==================================================
  // MOCK STUDY PLANNER & DAILY SCHEDULE FUNCTIONS
  // ==================================================
  // A per-student study scheduler stored in LocalStorage
  // (ai_learning_study_tasks for tasks, ai_learning_daily_goal
  // for the user's daily target). Tasks are isolated per
  // logged-in user and never expose private account data.
  // Status is derived at read-time: any task whose scheduled
  // date/time has passed while still active becomes "overdue"
  // automatically; completed tasks are never overdue.
  // Suggestions are rule-based, built from real stored
  // activity (course progress, quiz scores, flashcards,
  // learning path). They are never labelled as AI.

  var STUDY_TASKS_KEY = "ai_learning_study_tasks";
  var DAILY_GOAL_KEY = "ai_learning_daily_goal";
  var PLANNER_VIEW_KEY = "ai_learning_planner_view";

  var TASK_TYPES = ["Lesson", "Quiz", "Revision", "Flashcards", "Practice", "Custom Study"];
  var TASK_PRIORITIES = ["Low", "Medium", "High"];
  var TASK_STATUSES = ["pending", "in progress", "completed"];

  function plannerUserId() {
    var user = mockGetCurrentStudent();
    return user ? String(user.id) : "guest";
  }

  function plannerStorageGet(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function plannerStorageSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // ignore storage write errors (private mode / quota)
    }
  }

  function plannerYMD(date) {
    var m = ("0" + (date.getMonth() + 1)).slice(-2);
    var d = ("0" + date.getDate()).slice(-2);
    return date.getFullYear() + "-" + m + "-" + d;
  }

  /**
   * Parse "YYYY-MM-DD" + "HH:MM" into a local Date.
   * Works in ES3 engines (no ISO string dependency).
   */
  function plannerParseDateTime(dateStr, timeStr) {
    if (!dateStr) return null;
    var parts = String(dateStr).split("-");
    if (parts.length !== 3) return null;
    var y = Number(parts[0]);
    var m = Number(parts[1]);
    var d = Number(parts[2]);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    var date = new Date(y, m - 1, d);
    if (timeStr) {
      var t = String(timeStr).split(":");
      if (t.length >= 2) {
        date.setHours(Number(t[0]), Number(t[1]), 0, 0);
      }
    }
    if (isNaN(date.getTime())) return null;
    return date;
  }

  function loadStudyTasks() {
    var store = plannerStorageGet(STUDY_TASKS_KEY);
    var list = null;
    if (store && typeof store === "object") {
      var arr = store[plannerUserId()];
      if (Array.isArray(arr)) list = arr;
    }
    if (!list) return [];
    var clean = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && typeof list[i] === "object" && list[i].id) clean.push(list[i]);
    }
    return clean;
  }

  function saveStudyTasks(list) {
    var store = plannerStorageGet(STUDY_TASKS_KEY);
    if (!store || typeof store !== "object") store = {};
    store[plannerUserId()] = list;
    plannerStorageSet(STUDY_TASKS_KEY, store);
  }

  /**
   * Derive the effective status. "overdue" is computed when
   * the scheduled date/time has passed AND the task is not
   * yet completed (completed tasks stay "completed").
   */
  function plannerTaskEffectiveStatus(task) {
    var base = String(task && task.status || "pending").toLowerCase();
    if (base === "completed") return "completed";
    var sched = plannerParseDateTime(task.date, task.time);
    if (!sched) return "pending";
    if (sched.getTime() < new Date().getTime()) return "overdue";
    return base === "in progress" ? "in progress" : "pending";
  }

  function studyTaskView(task) {
    var view = {};
    for (var k in task) {
      if (Object.prototype.hasOwnProperty.call(task, k)) view[k] = task[k];
    }
    view.effectiveStatus = plannerTaskEffectiveStatus(task);
    view.isOverdue = view.effectiveStatus === "overdue";
    return view;
  }

  function sortTasksBySchedule(list) {
    return list.slice().sort(function (a, b) {
      var da = plannerParseDateTime(a.date, a.time);
      var db = plannerParseDateTime(b.date, b.time);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  }

  function generateTaskId(existing) {
    var id = "task_" + new Date().getTime() + "_" + Math.random().toString(36).substr(2, 8);
    for (var i = 0; existing && i < existing.length; i++) {
      if (existing[i].id === id) return generateTaskId(existing);
    }
    return id;
  }

  /**
   * All study tasks for the current student (enriched with
   * the derived status), sorted by scheduled date/time.
   */
  function getStudyTasks() {
    var tasks = loadStudyTasks();
    var views = [];
    for (var i = 0; i < tasks.length; i++) {
      views.push(studyTaskView(tasks[i]));
    }
    return sortTasksBySchedule(views);
  }

  function getStudyTask(id) {
    var tasks = loadStudyTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === id) return studyTaskView(tasks[i]);
    }
    return null;
  }

  function createStudyTask(task) {
    var title = String((task && task.title) || "").trim();
    var date = String((task && task.date) || "").trim();
    if (!title) return { success: false, message: "Title is required." };
    if (!date) return { success: false, message: "Date is required." };
    if (!task.time) return { success: false, message: "Time is required." };
    var parsed = plannerParseDateTime(date, task.time);
    if (!parsed) return { success: false, message: "Please enter a valid date and time." };
    var existing = loadStudyTasks();
    var record = {
      id: generateTaskId(existing),
      userId: plannerUserId(),
      title: title,
      type: TASK_TYPES.indexOf(task.type) !== -1 ? task.type : "Custom Study",
      courseId: task.courseId !== undefined ? task.courseId : null,
      lessonId: task.lessonId !== undefined ? task.lessonId : null,
      topic: String(task.topic || "").trim(),
      date: date,
      time: task.time,
      duration: Math.max(0, Number(task.duration) || 0),
      priority: TASK_PRIORITIES.indexOf(task.priority) !== -1 ? task.priority : "Medium",
      notes: String(task.notes || "").trim(),
      status: task.status === "completed" ? "completed" : "pending",
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    existing.push(record);
    saveStudyTasks(existing);
    return { success: true, message: "Study task created.", task: studyTaskView(record) };
  }

  function updateStudyTask(id, task) {
    var existing = loadStudyTasks();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].id === id) {
        var record = existing[i];
        if (task.title !== undefined) {
          var title = String(task.title).trim();
          if (!title) return { success: false, message: "Title is required." };
          record.title = title;
        }
        if (task.date !== undefined && String(task.date).trim()) {
          record.date = String(task.date).trim();
        }
        if (task.time !== undefined) record.time = task.time;
        if (!plannerParseDateTime(record.date, record.time)) {
          return { success: false, message: "Please enter a valid date and time." };
        }
        if (task.type !== undefined && TASK_TYPES.indexOf(task.type) !== -1) record.type = task.type;
        if (task.status !== undefined && TASK_STATUSES.indexOf(task.status) !== -1) record.status = task.status;
        if (task.priority !== undefined && TASK_PRIORITIES.indexOf(task.priority) !== -1) record.priority = task.priority;
        if (task.duration !== undefined) record.duration = Math.max(0, Number(task.duration) || 0);
        if (task.notes !== undefined) record.notes = String(task.notes || "").trim();
        if (task.topic !== undefined) record.topic = String(task.topic || "").trim();
        if (task.courseId !== undefined) record.courseId = task.courseId;
        if (task.lessonId !== undefined) record.lessonId = task.lessonId;
        if (task.completedAt !== undefined) record.completedAt = task.completedAt;
        if (record.status === "completed" && !record.completedAt) {
          record.completedAt = new Date().toISOString();
        }
        existing[i] = record;
        saveStudyTasks(existing);
        return { success: true, message: "Study task updated.", task: studyTaskView(record) };
      }
    }
    return { success: false, message: "Study task not found." };
  }

  function deleteStudyTask(id) {
    var existing = loadStudyTasks();
    var next = [];
    var found = false;
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].id === id) found = true;
      else next.push(existing[i]);
    }
    if (!found) return { success: false, message: "Study task not found." };
    saveStudyTasks(next);
    return { success: true, message: "Study task deleted." };
  }

  function completeStudyTask(id) {
    var existing = loadStudyTasks();
    for (var i = 0; i < existing.length; i++) {
      if (existing[i].id === id) {
        if (existing[i].status === "completed") {
          return { success: true, message: "Study task already completed.", task: studyTaskView(existing[i]) };
        }
        existing[i].status = "completed";
        existing[i].completedAt = new Date().toISOString();
        saveStudyTasks(existing);
        return { success: true, message: "Study task completed!", task: studyTaskView(existing[i]) };
      }
    }
    return { success: false, message: "Study task not found." };
  }

  /**
   * Daily goal. A user-chosen override (saved via saveDailyGoal)
   * wins; otherwise the existing dashboard dailyGoal target is
   * reused. Completed minutes are computed from study tasks with
   * a completedAt timestamp from today.
   */
  function getPlannerDailyGoal() {
    var store = plannerStorageGet(DAILY_GOAL_KEY);
    var custom = null;
    if (store && typeof store === "object" && store[plannerUserId()]) {
      custom = Number(store[plannerUserId()]);
      if (isNaN(custom) || custom <= 0) custom = null;
    }
    var base = 60;
    var dash = loadDashboardData();
    if (dash && dash.dailyGoal && Number(dash.dailyGoal.targetMinutes) > 0) {
      base = Number(dash.dailyGoal.targetMinutes);
    }
    var target = custom || base;
    var todayKey = plannerYMD(new Date());
    var tasks = loadStudyTasks();
    var completedMinutes = 0;
    var completedCount = 0;
    for (var i = 0; i < tasks.length; i++) {
      var dur = Number(tasks[i].duration) || 0;
      if (dur <= 0) continue;
      var cDate = tasks[i].completedAt ? String(tasks[i].completedAt).slice(0, 10) : "";
      if (cDate === todayKey) {
        completedMinutes += dur;
        completedCount++;
      }
    }
    var remaining = target - completedMinutes;
    if (remaining < 0) remaining = 0;
    var percent = target > 0 ? Math.round((completedMinutes / target) * 100) : 0;
    if (percent > 100) percent = 100;
    return {
      targetMinutes: target,
      completedMinutes: completedMinutes,
      completedCount: completedCount,
      remainingMinutes: remaining,
      percent: percent,
      reached: percent >= 100,
      customized: !!custom,
      dailyGoalSource: custom ? "planner" : "dashboard",
    };
  }

  function saveDailyGoal(targetMinutes) {
    var m = Number(targetMinutes);
    if (isNaN(m) || m < 5 || m > 480) {
      return { success: false, message: "Daily goal must be between 5 and 480 minutes." };
    }
    var store = plannerStorageGet(DAILY_GOAL_KEY);
    if (!store || typeof store !== "object") store = {};
    store[plannerUserId()] = Math.round(m);
    plannerStorageSet(DAILY_GOAL_KEY, store);
    return { success: true, message: "Daily goal saved!", targetMinutes: Math.round(m) };
  }

  /**
   * Rule-based study suggestions from real stored activity.
   * Sources: learning-path next step per active course, awarded
   * quiz results below 60%, flashcards due for review, and the
   * learning-path recommendation of the most recently started
   * course. Never labelled as AI.
   */
  function getSuggestedStudyTasks() {
    var user = mockGetCurrentStudent();
    if (!user) return [];
    var out = [];
    var seen = {};

    function pushSuggestion(s) {
      var key = s.title + "|" + (s.taskType || "");
      if (seen[key]) return;
      if (out.length >= 8) return;
      seen[key] = true;
      out.push(s);
    }

    function suggestionId() {
      return "suggestion_" + out.length + "_" + new Date().getTime();
    }

    var active = mockGetActiveCourses();
    for (var i = 0; i < active.length; i++) {
      var course = active[i].course;
      if (!course) continue;
      var rec = mockGetRecommendedNextStepForCourse(course.id);
      if (!rec) continue;
      if ((rec.type === "continue" || rec.type === "start") && rec.lessonId !== undefined && rec.lessonId !== null) {
        pushSuggestion({
          suggestionId: suggestionId(),
          title: rec.title,
          taskType: "Lesson",
          courseId: course.id,
          courseTitle: course.title,
          lessonId: rec.lessonId,
          topic: rec.message,
          priority: rec.priority === "high" ? "High" : "Medium",
          reason: rec.message,
        });
      } else if (rec.type === "take_quiz") {
        pushSuggestion({
          suggestionId: suggestionId(),
          title: rec.title,
          taskType: "Quiz",
          courseId: course.id,
          courseTitle: course.title,
          lessonId: rec.lessonId,
          quizId: rec.quizId,
          topic: rec.message,
          priority: rec.priority === "high" ? "High" : "Medium",
          reason: rec.message,
        });
      } else if (rec.type === "retry_quiz") {
        pushSuggestion({
          suggestionId: suggestionId(),
          title: rec.title,
          taskType: "Practice",
          courseId: course.id,
          courseTitle: course.title,
          lessonId: rec.lessonId,
          quizId: rec.quizId,
          topic: rec.message,
          priority: rec.priority === "high" ? "High" : "Medium",
          reason: rec.message,
        });
      }
    }

    var due = mockGetDueFlashcards();
    if (due.length > 0) {
      var dueCourseId = due[0].card && due[0].card.course_id !== undefined ? due[0].card.course_id : null;
      var label = due.length === 1 ? " flashcard is due" : " flashcards are due";
      pushSuggestion({
        suggestionId: suggestionId(),
        title: "Revise your flashcards",
        taskType: "Revision",
        courseId: dueCourseId,
        courseTitle: dueCourseId !== null ? analyticsCourseTitle(dueCourseId) : "",
        topic: due.length + label + " for review today.",
        priority: "Medium",
        reason: "Keep your revision streak going with a short flashcard session.",
        dueCount: due.length,
      });
    }

    var quizResults = analyticsGetQuizResults();
    var best = {};
    var last = {};
    for (i = 0; i < quizResults.length; i++) {
      var r = quizResults[i];
      var key = String(r.quiz_id);
      if (!(key in best) || r.score > best[key]) best[key] = Number(r.score) || 0;
      last[key] = r;
    }
    for (var qk in best) {
      if (!Object.prototype.hasOwnProperty.call(best, qk)) continue;
      if (best[qk] < 60 && best[qk] >= 0) {
        var qRec = last[qk];
        var qTitle = analyticsQuizTitle(qRec.quiz_id);
        var qCourseId = qRec.course_id !== undefined ? qRec.course_id : null;
        pushSuggestion({
          suggestionId: suggestionId(),
          title: "Practice " + (qTitle || "quiz"),
          taskType: "Practice",
          courseId: qCourseId,
          courseTitle: qCourseId !== null ? analyticsCourseTitle(qCourseId) : "",
          lessonId: qRec.lesson_id !== undefined ? qRec.lesson_id : null,
          quizId: qRec.quiz_id,
          topic: "Your latest score was " + qRec.score + "%. Reviewing helps you master this topic.",
          priority: "High",
          reason: "A recent quiz scored below 60%. Practice improves retention.",
        });
      }
    }

    var enrolled = mockGetEnrolledCourses();
    if (enrolled.length > 0) {
      var lpCourse = mockGetCourseById(enrolled[0]);
      var lp = mockGetLearningPathData(enrolled[0]);
      if (lp && lp.recommendation && lp.recommendation.type === "course_completed") {
        pushSuggestion({
          suggestionId: suggestionId(),
          title: lpCourse ? lpCourse.title : "Completed course revision",
          taskType: "Revision",
          courseId: enrolled[0],
          courseTitle: lpCourse ? lpCourse.title : "",
          topic: lp.recommendation.message,
          priority: "Low",
          reason: lp.recommendation.message,
        });
      }
    }

    return out;
  }

  // ==================================================
  // PUBLIC API (routes to mock or Flask based on config)
  // ==================================================

  return {
    /**
     * Register a new student.
     * Currently uses mock. Will switch to Flask when MOCK_MODE = false.
     */
    registerStudent: function (studentData) {
      if (config.MOCK_MODE) {
        return mockRegisterStudent(studentData);
      }
      return flaskRegisterStudent(studentData);
    },

    /**
     * Login a student.
     * Currently uses mock. Will switch to Flask when MOCK_MODE = false.
     */
    loginStudent: function (email, password) {
      if (config.MOCK_MODE) {
        return mockLoginStudent(email, password);
      }
      return flaskLoginStudent(email, password);
    },

    /**
     * Sign in with a Google profile.
     * In mock mode this creates/logs in a local account. A real Flask
     * backend would verify the Google ID token instead.
     */
    loginWithGoogle: function (profile) {
      if (config.MOCK_MODE) {
        return mockGoogleSignIn(profile);
      }
      return {
        success: false,
        message: "Google sign-in needs the Flask backend.",
      };
    },

    /**
     * Logout the current student.
     */
    logoutStudent: function () {
      if (config.MOCK_MODE) {
        return mockLogoutStudent();
      }
      try {
        localStorage.removeItem(config.STORAGE_KEYS.SESSION);
        localStorage.removeItem(config.STORAGE_KEYS.USER);
      } catch (e) {}
      return { success: true, message: "Logged out successfully." };
    },

    /**
     * Get the currently logged-in student.
     * Returns user object or null.
     */
    getCurrentStudent: function () {
      if (config.MOCK_MODE) {
        return mockGetCurrentStudent();
      }
      // Future: Flask session check
    },

    /**
     * Request a password reset.
     */
    requestPasswordReset: function (email) {
      if (config.MOCK_MODE) {
        return mockRequestPasswordReset(email);
      }
      // Future: Flask password reset call
    },

    // ==================================================
    // PROFILE & PREFERENCES FUNCTIONS
    // ==================================================

    /**
     * Get the current user's profile (future: GET /users/me).
     */
    getUserProfile: function () {
      if (config.MOCK_MODE) return mockGetUserProfile();
      return { success: false, message: "Not available." };
    },

    /**
     * Update editable profile fields (future: PATCH /users/me).
     */
    updateUserProfile: function (profile) {
      if (config.MOCK_MODE) return mockUpdateUserProfile(profile);
      return { success: false, message: "Not available." };
    },

    /**
     * Get the current user's learning preferences.
     */
    getUserPreferences: function () {
      if (config.MOCK_MODE) return mockGetUserPreferences();
      return { success: false, message: "Not available." };
    },

    /**
     * Update the current user's learning preferences.
     */
    updateUserPreferences: function (preferences) {
      if (config.MOCK_MODE) return mockUpdateUserPreferences(preferences);
      return { success: false, message: "Not available." };
    },

    /**
     * Get the current user's notification preferences.
     */
    getNotificationPreferences: function () {
      if (config.MOCK_MODE) return mockGetNotificationPreferences();
      return { success: false, message: "Not available." };
    },

    /**
     * Update the current user's notification preferences.
     */
    updateNotificationPreferences: function (preferences) {
      if (config.MOCK_MODE) return mockUpdateNotificationPreferences(preferences);
      return { success: false, message: "Not available." };
    },

    /**
     * Reset ONLY learning preferences for the current user.
     */
    resetUserPreferences: function () {
      if (config.MOCK_MODE) return mockResetUserPreferences();
      return { success: false, message: "Not available." };
    },

    // ==================================================
    // COURSE FUNCTIONS
    // ==================================================

    /**
     * Get all courses.
     */
    getCourses: function () {
      if (config.MOCK_MODE) return mockGetCourses();
    },

    /**
     * Get a course by ID.
     */
    getCourseById: function (courseId) {
      if (config.MOCK_MODE) return mockGetCourseById(courseId);
    },

    /**
     * Get lessons for a course.
     */
    getLessonsByCourse: function (courseId) {
      if (config.MOCK_MODE) return mockGetLessonsByCourse(courseId);
    },

    /**
     * Get a single lesson by courseId and lessonId.
     */
    getLessonById: function (courseId, lessonId) {
      if (config.MOCK_MODE) return mockGetLessonById(courseId, lessonId);
    },

    /**
     * Start/enroll in a course.
     */
    startCourse: function (courseId) {
      if (config.MOCK_MODE) return mockStartCourse(courseId);
    },

    /**
     * Mark a lesson as complete.
     */
    markLessonComplete: function (courseId, lessonId) {
      if (config.MOCK_MODE) return mockMarkLessonComplete(courseId, lessonId);
    },

    /**
     * Get progress for a course.
     */
    getCourseProgress: function (courseId) {
      if (config.MOCK_MODE) return mockGetCourseProgress(courseId);
    },

    /**
     * Check if a lesson is complete.
     */
    isLessonComplete: function (courseId, lessonId) {
      if (config.MOCK_MODE) return mockIsLessonComplete(courseId, lessonId);
    },

    /**
     * Get all enrolled course IDs.
     */
    getEnrolledCourses: function () {
      if (config.MOCK_MODE) return mockGetEnrolledCourses();
    },

    /**
     * Toggle bookmark on a course.
     */
    bookmarkCourse: function (courseId) {
      if (config.MOCK_MODE) return mockBookmarkCourse(courseId);
    },

    /**
     * Check if a course is bookmarked.
     */
    isBookmarked: function (courseId, type) {
      if (config.MOCK_MODE) return mockIsBookmarked(courseId, type);
    },

    /**
     * Get all bookmarked course IDs.
     */
    getBookmarkedCourses: function () {
      if (config.MOCK_MODE) return mockGetBookmarkedCourses();
    },

    /**
     * Get all bookmark items for the current student.
     */
    getBookmarks: function () {
      if (config.MOCK_MODE) return mockGetBookmarks();
    },

    /**
     * Add a bookmark for the current student.
     */
    addBookmark: function (bookmark) {
      if (config.MOCK_MODE) return mockAddBookmark(bookmark);
    },

    /**
     * Remove a bookmark by item id + type.
     */
    removeBookmark: function (itemId, type) {
      if (config.MOCK_MODE) return mockRemoveBookmark(itemId, type);
    },

    /**
     * Toggle a bookmark on or off.
     */
    toggleBookmark: function (bookmark) {
      if (config.MOCK_MODE) return mockToggleBookmark(bookmark);
    },

    /**
     * Get the total bookmark count for the current student.
     */
    getBookmarkCount: function () {
      if (config.MOCK_MODE) return mockGetBookmarkCount();
    },

    /**
     * Get recommended courses for a given course.
     */
    getRecommendedCourses: function (courseId) {
      if (config.MOCK_MODE) return mockGetRecommendedCourses(courseId);
    },

    // ==================================================
    // QUIZ FUNCTIONS
    // ==================================================

    /**
     * Initialize quiz data from JSON file.
     * Call this on page load.
     */
    initQuizData: function (quizzesJson) {
      if (!quizzesJson || !quizzesJson.length) return;
      var current = loadQuizzesData();
      // Refresh stored quiz definitions when the JSON file changes,
      // not only when the number of quizzes changes.
      if (!current || JSON.stringify(current) !== JSON.stringify(quizzesJson)) {
        saveQuizzesData(quizzesJson);
      }
    },

    /**
     * Get all quizzes (optionally filtered by course).
     */
    getQuizzes: function (courseId) {
      if (config.MOCK_MODE) return mockGetQuizzes(courseId);
    },

    // ==================================================
    // AI TUTOR FUNCTIONS
    // ==================================================

    /**
     * Initialize AI tutor data from JSON file.
     * Call this on page load.
     */
    initTutorData: function (tutorJson) {
      if (tutorJson && (!loadTutorData() || loadTutorData().topics !== tutorJson.topics)) {
        saveTutorData(tutorJson);
      }
    },

    /**
     * Send a message to the AI tutor and get a reply.
     * Context may include: course, courseId, lesson, lessonTitle, action.
     */
    sendTutorMessage: function (message, context) {
      return mockSendTutorMessage(message, context);
    },

    /**
     * Get the suggested starter questions for the AI tutor.
     */
    getTutorSuggestions: function () {
      var data = loadTutorData();
      return data ? (data.suggestions || []) : [];
    },

    /**
     * Get the greeting message for the AI tutor, based on learning context.
     */
    getTutorGreeting: function (greetContext) {
      var data = loadTutorData();
      if (!data) return "Hi! I'm your AI Tutor. What would you like to learn today?";
      var ctx = greetContext || {};
      var tpl;
      if (ctx.lessonTitle) tpl = data.greetingWithLesson;
      else if (ctx.course) tpl = data.greetingWithContext;
      else tpl = data.greeting;
      if (!tpl) return data.greeting || "Hi! I'm your AI Tutor.";
      return tpl
        .replace("{course}", ctx.course ? ctx.course : "your course")
        .replace("{lesson}", ctx.lessonTitle ? ctx.lessonTitle : "this lesson");
    },

    /**
     * Get a single quiz by quiz ID.
     */
    getQuiz: function (quizId) {
      if (config.MOCK_MODE) return mockGetQuiz(quizId);
    },

    /**
     * Get a quiz connected to a specific course lesson.
     */
    getQuizForLesson: function (courseId, lessonId) {
      if (config.MOCK_MODE) return mockGetQuizForLesson(courseId, lessonId);
    },

    /**
     * Submit a quiz result for the current user.
     */
    submitQuizResult: function (result) {
      if (config.MOCK_MODE) return mockSubmitQuizResult(result);
    },

    /**
     * Get the latest quiz result for the current user.
     */
    getQuizResult: function (quizId) {
      if (config.MOCK_MODE) return mockGetQuizResult(quizId);
    },

    /**
     * Get all attempts for a quiz by the current user.
     */
    getQuizAttempts: function (quizId) {
      if (config.MOCK_MODE) return mockGetQuizAttempts(quizId);
    },

    /**
     * Get the best score for a quiz by the current user.
     */
    getQuizBestScore: function (quizId) {
      if (config.MOCK_MODE) return mockGetQuizBestScore(quizId);
    },

    /**
     * Get a specific quiz result for the current user by completion timestamp.
     */
    getQuizResultByTime: function (quizId, timestamp) {
      if (config.MOCK_MODE) return mockGetQuizResultByTime(quizId, timestamp);
    },

    /**
     * Initialize course data from JSON files.
     * Call this on page load.
     */
    initCourseData: function (coursesJson, lessonsJson) {
      if (coursesJson && (!loadCoursesData() || loadCoursesData().length !== coursesJson.length)) {
        saveCoursesData(coursesJson);
      }
      if (lessonsJson && (!loadLessonsData() || loadLessonsData().length !== lessonsJson.length)) {
        saveLessonsData(lessonsJson);
      }
    },

    // ==================================================
    // DASHBOARD FUNCTIONS
    // ==================================================

    /**
     * Initialize dashboard data from JSON file.
     */
    initDashboardData: function (dashboardJson) {
      if (config.MOCK_MODE) mockInitDashboardData(dashboardJson);
    },

    /**
     * Get the full dashboard data.
     */
    getDashboardData: function () {
      if (config.MOCK_MODE) return mockGetDashboardData();
    },

    /**
     * Get dashboard overview stats.
     */
    getDashboardOverview: function () {
      if (config.MOCK_MODE) return mockGetDashboardOverview();
    },

    /**
     * Get active (in-progress) courses.
     */
    getActiveCourses: function () {
      if (config.MOCK_MODE) return mockGetActiveCourses();
    },

    /**
     * Get completed courses.
     */
    getCompletedCourses: function () {
      if (config.MOCK_MODE) return mockGetCompletedCourses();
    },

    /**
     * Get saved/bookmarked courses.
     */
    getSavedCourses: function () {
      if (config.MOCK_MODE) return mockGetSavedCourses();
    },

    /**
     * Get recent activity.
     */
    getRecentActivity: function () {
      if (config.MOCK_MODE) return mockGetRecentActivity();
    },

    /**
     * Get daily goal data.
     */
    getDailyGoal: function () {
      if (config.MOCK_MODE) return mockGetDailyGoal();
    },

    /**
     * Get learning streak data.
     */
    getLearningStreak: function () {
      if (config.MOCK_MODE) return mockGetLearningStreak();
    },

    /**
     * Get recommended next step.
     */
    getRecommendedNextStep: function () {
      if (config.MOCK_MODE) return mockGetRecommendedNextStep();
    },

    // ==================================================
    // LEARNING PATH FUNCTIONS
    // ==================================================

    /**
     * Get the full learning path data for a course.
     */
    getLearningPathData: function (courseId) {
      if (config.MOCK_MODE) return mockGetLearningPathData(courseId);
    },

    /**
     * Get student mastery level for a course.
     */
    getStudentMastery: function (courseId) {
      if (config.MOCK_MODE) return mockGetStudentMastery(courseId);
    },

    /**
     * Get recommended next step for a specific course.
     */
    getRecommendedNextStepForCourse: function (courseId) {
      if (config.MOCK_MODE) return mockGetRecommendedNextStepForCourse(courseId);
    },

    /**
     * Get weak topics for a course.
     */
    getWeakTopics: function (courseId) {
      if (config.MOCK_MODE) return mockGetWeakTopics(courseId);
    },

    /**
     * Get strong topics for a course.
     */
    getStrongTopics: function (courseId) {
      if (config.MOCK_MODE) return mockGetStrongTopics(courseId);
    },

    // ==================================================
    // FLASHCARD FUNCTIONS
    // ==================================================

    /**
     * Initialize flashcard data from JSON file.
     * Call this on page load.
     */
    initFlashcardData: function (flashcardsJson) {
      if (flashcardsJson && flashcardsJson.length > 0 && (!loadFlashcardsData() || loadFlashcardsData().length !== flashcardsJson.length)) {
        saveFlashcardsData(flashcardsJson);
      }
    },

    /**
     * Get flashcards, optionally filtered by course.
     */
    getFlashcards: function (courseId) {
      if (config.MOCK_MODE) return mockGetFlashcards(courseId);
    },

    /**
     * Get flashcards that are due for review.
     * Returns enriched items: { card, progress, overdue, dueNow }.
     */
    getDueFlashcards: function (courseId) {
      if (config.MOCK_MODE) return mockGetDueFlashcards(courseId);
    },

    /**
     * Get flashcard progress statistics for a course.
     */
    getFlashcardProgress: function (courseId) {
      if (config.MOCK_MODE) return mockGetFlashcardProgress(courseId);
    },

    /**
     * Save a flashcard review and compute the next review date.
     * review: { card_id, rating }
     * rating must be "hard", "medium", or "easy".
     */
    saveFlashcardReview: function (review) {
      if (config.MOCK_MODE) return mockSaveFlashcardReview(review);
    },

    /**
     * Get a revision summary for a course, or across all courses
     * when courseId is not provided.
     */
    getRevisionSummary: function (courseId) {
      if (config.MOCK_MODE) return mockGetRevisionSummary(courseId);
    },

    /**
     * Describe a review timestamp in friendly terms.
     */
    describeNextReview: function (iso) {
      return mockDescribeNextReview(iso);
    },

    // ==================================================
    // ANALYTICS FUNCTIONS
    // ==================================================

    /**
     * Get all analytics data for the current student in one call.
     */
    getAnalytics: function () {
      if (config.MOCK_MODE) return mockGetAnalytics();
      // Future: Flask analytics endpoint
    },

    /**
     * Get course-wise progress analytics for enrolled courses.
     */
    getCourseAnalytics: function () {
      if (config.MOCK_MODE) return mockGetCourseAnalytics();
    },

    /**
     * Get quiz performance analytics.
     */
    getQuizAnalytics: function () {
      if (config.MOCK_MODE) return mockGetQuizAnalytics();
    },

    /**
     * Get topic mastery derived from quiz and lesson performance.
     */
    getTopicMastery: function () {
      if (config.MOCK_MODE) return mockGetTopicMastery();
    },

    /**
     * Get a recent learning activity feed built from stored data.
     */
    getLearningActivity: function () {
      if (config.MOCK_MODE) return mockGetLearningActivity();
    },

    /**
     * Get learning streak analytics computed from activity timestamps.
     */
    getStreakAnalytics: function () {
      if (config.MOCK_MODE) return mockGetLearningStreakAnalytics();
    },

    /**
     * Get revision (flashcard) analytics.
     */
    getRevisionAnalytics: function () {
      if (config.MOCK_MODE) return mockGetRevisionAnalytics();
    },

    /**
     * Get historical performance improvement comparisons (when available).
     */
    getLearningImprovement: function () {
      if (config.MOCK_MODE) return mockGetLearningImprovement();
    },

    /**
     * Get rule-based personalized learning insight (not AI).
     */
    getPersonalizedInsight: function () {
      if (config.MOCK_MODE) return mockGetPersonalizedInsight();
    },

    /**
     * Load the achievements definitions from achievements.json.
     */
    initAchievementsData: function (achievementsJson) {
      if (achievementsJson && Array.isArray(achievementsJson)) {
        _achievementsCache = achievementsJson;
      } else if (achievementsJson && Array.isArray(achievementsJson.achievements)) {
        _achievementsCache = achievementsJson.achievements;
      } else {
        _achievementsCache = [];
      }
      return _achievementsCache;
    },

    /**
     * Get the raw achievements definitions.
     */
    getAchievements: function () {
      return getAchievementDefinitions();
    },

    /**
     * Get the full gamification state (XP, level, achievement
     * progress, next achievement, recent unlocks and XP history).
     * Synchronizes XP and unlocks from real stored activity.
     */
    getAchievementProgress: function () {
      if (config.MOCK_MODE) return mockGetAchievementProgress();
    },

    /**
     * Get the current student's XP and level summary.
     */
    getUserXP: function () {
      if (config.MOCK_MODE) {
        var data = mockGetAchievementProgress();
        return {
          total: data.summary.totalXp,
          level: data.xp.level,
          nextLevelAt: data.xp.nextLevelAt,
          xpIntoLevel: data.xp.xpIntoLevel,
          levelPct: data.xp.levelPct,
          remaining: data.xp.remaining,
        };
      }
      return null;
    },

    /**
     * Get the XP history for the current student (newest first).
     */
    getXPHistory: function () {
      if (config.MOCK_MODE) {
        return mockGetAchievementProgress().xpHistory;
      }
      return [];
    },

    /**
     * Get the most recently unlocked achievements.
     */
    getRecentAchievements: function () {
      if (config.MOCK_MODE) {
        return mockGetAchievementProgress().recentUnlocked;
      }
      return [];
    },

    /**
     * Persist the unlock state for an achievement. Only succeeds
     * when the achievement's requirement is genuinely met.
     */
    saveAchievementState: function (achievementId) {
      if (config.MOCK_MODE) return mockSaveAchievementState(achievementId);
      return { success: false, message: "Not available." };
    },

    /**
     * Load DEMO leaderboard students from data/leaderboard.json.
     */
    initLeaderboardData: function (data) {
      initLeaderboardData(data);
    },

    /**
     * Get the full leaderboard board for a category
     * (overall | xp | quiz | streak | achievements).
     */
    getLeaderboard: function (category) {
      if (config.MOCK_MODE) return buildLeaderboardBoard(category || "overall");
      return null;
    },

    /**
     * Alias of getLeaderboard for category-based ranking.
     */
    getLeaderboardByCategory: function (category) {
      if (config.MOCK_MODE) return buildLeaderboardBoard(category || "overall");
      return null;
    },

    /**
     * Summary of the current student's rank and key stats.
     */
    getCurrentUserRank: function (category) {
      if (!config.MOCK_MODE) return null;
      var board = buildLeaderboardBoard(category || "overall");
      for (var i = 0; i < board.students.length; i++) {
        if (board.students[i].isCurrentUser) {
          var row = board.students[i];
          return {
            category: board.category,
            rank: Number(row.rank) || 0,
            total: board.total,
            xp: Number(row.xp) || 0,
            level: Number(row.level) || 1,
            currentStreak: Number(row.currentStreak) || 0,
            achievementsUnlocked: Number(row.achievementsUnlocked) || 0,
          };
        }
      }
      return null;
    },

    /**
     * The current student's position: rank, how many points
     * they are behind the student directly above them, and
     * the immediate neighbours above/below. atTop is true
     * when already ranked #1.
     */
    getLeaderboardPosition: function (category) {
      if (!config.MOCK_MODE) return null;
      var board = buildLeaderboardBoard(category || "overall");
      for (var i = 0; i < board.students.length; i++) {
        if (board.students[i].isCurrentUser) {
          var row = board.students[i];
          var above = i > 0 ? board.students[i - 1] : null;
          var below = i < board.students.length - 1 ? board.students[i + 1] : null;
          var scoreGap = above
            ? (Number(above.score) || 0) - (Number(row.score) || 0)
            : 0;
          var xpGap = above
            ? (Number(above.xp) || 0) - (Number(row.xp) || 0)
            : 0;
          return {
            category: board.category,
            rank: Number(row.rank) || 0,
            total: board.total,
            pointsBehind: scoreGap,
            xpGap: xpGap,
            atTop: !above,
            above: above,
            below: below,
          };
        }
      }
      return null;
    },

    /**
     * Get all study tasks for the current student, each
     * enriched with the derived status (pending, in progress,
     * completed or overdue), sorted by schedule.
     */
    getStudyTasks: function () {
      if (config.MOCK_MODE) return getStudyTasks();
      return [];
    },

    /**
     * Get a single study task by id (or null).
     */
    getStudyTask: function (id) {
      if (config.MOCK_MODE) return getStudyTask(id);
      return null;
    },

    /**
     * Create a study task. Requires title, date and time.
     */
    createStudyTask: function (task) {
      if (config.MOCK_MODE) return createStudyTask(task);
      return { success: false, message: "Not available." };
    },

    /**
     * Update an existing study task (partial fields allowed).
     */
    updateStudyTask: function (id, task) {
      if (config.MOCK_MODE) return updateStudyTask(id, task);
      return { success: false, message: "Not available." };
    },

    /**
     * Delete a study task.
     */
    deleteStudyTask: function (id) {
      if (config.MOCK_MODE) return deleteStudyTask(id);
      return { success: false, message: "Not available." };
    },

    /**
     * Mark a study task as completed (records completedAt).
     */
    completeStudyTask: function (id) {
      if (config.MOCK_MODE) return completeStudyTask(id);
      return { success: false, message: "Not available." };
    },

    /**
     * Save the current student's daily target in minutes.
     */
    saveDailyGoal: function (targetMinutes) {
      if (config.MOCK_MODE) return saveDailyGoal(targetMinutes);
      return { success: false, message: "Not available." };
    },

    /**
     * Combined daily goal for the planner: target, minutes
     * completed today (from completed study tasks) and progress.
     */
    getPlannerDailyGoal: function () {
      if (config.MOCK_MODE) return getPlannerDailyGoal();
      return null;
    },

    /**
     * Rule-based study suggestions built from real stored
     * activity (learning path, quiz results, flashcards, streaks).
     * Never labelled as AI.
     */
    getSuggestedStudyTasks: function () {
      if (config.MOCK_MODE) return getSuggestedStudyTasks();
      return [];
    },
  };
})();







