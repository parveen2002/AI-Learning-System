/* ============================================
   AI-Learning System - Theme Module
   ============================================
   
   Handles dark/light mode toggling with:
   - System preference detection
   - LocalStorage persistence
   - Smooth transitions
   ============================================ */

var LearnSphereTheme = (function () {
  "use strict";

  var config = LearnSphereConfig;
  var STORAGE_KEY = config.STORAGE_KEYS.THEME;

  // ==================================================
  // INITIALIZATION
  // ==================================================

  function init() {
    var savedTheme = localStorage.getItem(STORAGE_KEY);

    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Detect system preference
      var prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setTheme(prefersDark ? "dark" : "light");
    }

    setupToggleButtons();
    setupSystemPreferenceListener();
  }

  // ==================================================
  // SET THEME
  // ==================================================

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(STORAGE_KEY, theme);
    updateToggleIcons(theme);
  }

  // ==================================================
  // TOGGLE THEME
  // ==================================================

  function toggleTheme() {
    var current = document.documentElement.getAttribute("data-theme");
    var next = current === "dark" ? "light" : "dark";
    setTheme(next);
  }

  // ==================================================
  // UPDATE TOGGLE ICONS
  // ==================================================

  function updateToggleIcons(theme) {
    var toggleBtns = document.querySelectorAll(".theme-toggle");
    toggleBtns.forEach(function (btn) {
      btn.innerHTML = theme === "dark" ? "&#9788;" : "&#9790;";
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
    });
  }

  // ==================================================
  // SETUP TOGGLE BUTTONS
  // ==================================================

  function setupToggleButtons() {
    var toggleBtns = document.querySelectorAll(".theme-toggle");
    toggleBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        toggleTheme();
      });
    });

    // Set initial icons
    var current = document.documentElement.getAttribute("data-theme") || "light";
    updateToggleIcons(current);
  }

  // ==================================================
  // LISTEN FOR SYSTEM PREFERENCE CHANGES
  // ==================================================

  function setupSystemPreferenceListener() {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", function (e) {
        // Only follow system if user hasn't manually set a preference
        var savedTheme = localStorage.getItem(STORAGE_KEY);
        if (!savedTheme) {
          setTheme(e.matches ? "dark" : "light");
        }
      });
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: init,
    toggleTheme: toggleTheme,
    setTheme: setTheme,
    getTheme: function () {
      return document.documentElement.getAttribute("data-theme") || "light";
    },
  };
})();
