/* ============================================
   AI-Learning System - Navigation Module
   ============================================
   
   Handles navbar behavior, mobile menu,
   scroll effects, and authentication-aware UI.
   ============================================ */

var LearnSphereNav = (function () {
  "use strict";

  var auth = LearnSphereAuth;
  var config = LearnSphereConfig;

  function quoteAttr(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // ==================================================
  // INITIALIZATION
  // ==================================================

  function init() {
    setupNavbarScroll();
    setupMobileMenu();
    updateAuthUI();
    setupDropdowns();
    setupSearch();
    setupLogout();
    setupBackToTop();
  }

  // ==================================================
  // SCROLL EFFECTS
  // ==================================================

  function setupNavbarScroll() {
    var navbar = document.getElementById("navbar");
    if (!navbar) return;

    window.addEventListener("scroll", function () {
      if (window.scrollY > 10) {
        navbar.classList.add("scrolled");
      } else {
        navbar.classList.remove("scrolled");
      }
    });
  }

  // ==================================================
  // MOBILE MENU
  // ==================================================

  function setupMobileMenu() {
    var hamburger = document.getElementById("hamburger");
    var mobileMenu = document.getElementById("mobileMenu");

    if (!hamburger || !mobileMenu) return;

    function toggleMenu(open) {
      hamburger.classList.toggle("active", open);
      mobileMenu.classList.toggle("show", open);
      hamburger.setAttribute("aria-expanded", open ? "true" : "false");
      hamburger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.style.overflow = open ? "hidden" : "";
    }

    hamburger.addEventListener("click", function () {
      toggleMenu(!mobileMenu.classList.contains("show"));
    });

    // Close mobile menu when clicking a link
    var mobileLinks = mobileMenu.querySelectorAll(".mobile-menu-link");
    mobileLinks.forEach(function (link) {
      link.addEventListener("click", function () {
        toggleMenu(false);
      });
    });

    // Close the mobile menu with Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && mobileMenu.classList.contains("show")) {
        toggleMenu(false);
        hamburger.focus();
      }
    });
  }

  // ==================================================
  // AUTH-AWARE UI
  // ==================================================

  function updateAuthUI() {
    var isLoggedIn = auth.isLoggedIn();
    var user = auth.getCurrentStudent();

    var authGuest = document.getElementById("authGuest");
    var authUser = document.getElementById("authUser");
    var mobileAuthGuest = document.getElementById("mobileAuthGuest");
    var mobileAuthUser = document.getElementById("mobileAuthUser");

    // Desktop navbar
    if (authGuest) authGuest.style.display = isLoggedIn ? "none" : "flex";
    if (authUser) {
      authUser.style.display = isLoggedIn ? "flex" : "none";
      if (isLoggedIn && user) {
        var avatarEl = authUser.querySelector(".navbar-user-avatar");
        var nameEl = authUser.querySelector(".navbar-user-name");
        if (avatarEl && user.name) {
          var photo = user.profilePhoto;
          if (photo) {
            avatarEl.classList.add("has-photo");
            avatarEl.textContent = "";
            avatarEl.innerHTML =
              '<img src="' +
              quoteAttr(photo) +
              '" alt="' +
              quoteAttr(user.name) +
              ' profile photo">';
          } else {
            avatarEl.classList.remove("has-photo");
            avatarEl.innerHTML = "";
            avatarEl.textContent = user.name.charAt(0).toUpperCase();
          }
        }
        if (nameEl && user.name) {
          nameEl.textContent = user.name.split(" ")[0];
        }
      }
    }

    // Mobile menu
    if (mobileAuthGuest) mobileAuthGuest.style.display = isLoggedIn ? "none" : "flex";
    if (mobileAuthUser) {
      mobileAuthUser.style.display = isLoggedIn ? "flex" : "none";
      if (isLoggedIn && user) {
        var mobileNameEl = mobileAuthUser.querySelector(".mobile-user-name");
        if (mobileNameEl && user.name) {
          mobileNameEl.textContent = user.name;
        }
      }
    }
  }

  // ==================================================
  // DROPDOWN MENU
  // ==================================================

  function setupDropdowns() {
    var dropdownBtns = document.querySelectorAll(".navbar-user-btn");

    function closeDropdowns() {
      var openDropdowns = document.querySelectorAll(".navbar-dropdown.show");
      openDropdowns.forEach(function (dd) {
        dd.classList.remove("show");
      });
      var openMenus = document.querySelectorAll(
        ".navbar-user-menu.open"
      );
      openMenus.forEach(function (menu) {
        menu.classList.remove("open");
      });
      document.querySelectorAll(".navbar-user-btn").forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
      });
    }

    dropdownBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var dropdown = btn.nextElementSibling;
        var isOpen = dropdown && dropdown.classList.contains("show");
        closeDropdowns();
        if (!isOpen && dropdown) {
          dropdown.classList.add("show");
          btn.closest(".navbar-user-menu").classList.add("open");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener("click", function () {
      closeDropdowns();
    });

    // Close dropdowns with Escape and keep them keyboard-friendly
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        var openDd = document.querySelector(".navbar-dropdown.show");
        closeDropdowns();
        if (openDd && openDd.parentElement) {
          var trigger = openDd.parentElement.querySelector(
            ".navbar-user-btn"
          );
          if (trigger) trigger.focus();
        }
      }
    });
  }

  // ==================================================
  // BACK TO TOP BUTTON
  // ==================================================

  function setupBackToTop() {
    var btn = document.getElementById("backToTop");
    if (!btn) return;

    window.addEventListener("scroll", function () {
      if (window.scrollY > 500) {
        btn.classList.add("show");
      } else {
        btn.classList.remove("show");
      }
    });

    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ==================================================
  // SEARCH
  // ==================================================

  function setupSearch() {
    // Wire any element with data-search-url to its search page
    var searchTriggers = document.querySelectorAll("[data-search-url]");
    searchTriggers.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var target = btn.getAttribute("data-search-url");
        if (target) window.location.href = target;
      });
    });
  }

  // ==================================================
  // LOGOUT
  // ==================================================

  function setupLogout() {
    var logoutBtns = document.querySelectorAll("#navLogoutBtn, #mobileLogoutBtn");

    function doLogout() {
      auth.logoutUser();
      window.location.href = auth.getBasePath() + "/pages/login.html";
    }

    logoutBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        doLogout();
      });
      // Keyboard support for the menu-style logout item
      btn.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          doLogout();
        }
      });
    });
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: init,
    updateAuthUI: updateAuthUI,
  };
})();
