/* ============================================
   AI-Learning System - Google Sign-In (Demo)
   ============================================

   The project runs fully in mock mode and has no Google OAuth
   client ID or backend. This module makes "Continue with Google"
   work immediately by showing a Google-style account chooser:

   - Pick the demo account, or enter any email address.
   - The account is created locally on first use and logged in
     through LearnSphereAPI.loginWithGoogle().
   - No request is sent to Google and no Google data is read.

   When real OAuth is available, replace completeSignIn() with the
   Google Identity Services credential flow.
   ============================================ */

var LearnSphereGoogleAuth = (function () {
  "use strict";

  var api = typeof LearnSphereAPI !== "undefined" ? LearnSphereAPI : null;

  var overlay = null;
  var card = null;
  var accountsView = null;
  var formView = null;
  var form = null;
  var nameInput = null;
  var nameGroup = null;
  var emailInput = null;
  var errorEl = null;
  var continueBtn = null;
  var mode = "login";
  var lastFocused = null;
  var busy = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function isSignupPage() {
    return /signup\.html$/i.test(window.location.pathname);
  }

  function getRedirectUrl() {
    try {
      var raw = new URLSearchParams(window.location.search).get("redirect");
      if (raw) {
        var target = new URL(raw, window.location.href);
        if (target.origin === window.location.origin) return target.href;
      }
    } catch (e) {}
    return "../pages/dashboard.html";
  }

  function googleLogo() {
    return (
      '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>' +
      '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
      '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>' +
      '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
      "</svg>"
    );
  }

  function buildModal() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "gauth-overlay";
    overlay.id = "googleAuthOverlay";
    overlay.hidden = true;

    overlay.innerHTML =
      '<div class="gauth-card" role="dialog" aria-modal="true" aria-labelledby="gauthTitle">' +
      '  <div class="gauth-topbar">' +
      '    <span class="gauth-logo">' + googleLogo() + "</span>" +
      '    <button type="button" class="gauth-close" id="gauthClose" aria-label="Close Google sign-in">&#10005;</button>' +
      "  </div>" +
      '  <h2 class="gauth-title" id="gauthTitle">Choose an account</h2>' +
      '  <p class="gauth-subtitle">to continue to <strong>AI-Learning System</strong></p>' +
      '  <div class="gauth-accounts" id="gauthAccounts">' +      '    <button type="button" class="gauth-account" id="gauthDemoAccount">' +
      '      <span class="gauth-avatar" aria-hidden="true">D</span>' +
      '      <span class="gauth-account-copy">' +
      '        <span class="gauth-account-name">Demo Student</span>' +
      '        <span class="gauth-account-email">demo.student@gmail.com</span>' +
      "      </span>" +
      "    </button>" +
      '    <button type="button" class="gauth-account" id="gauthOtherAccount">' +
      '      <span class="gauth-avatar gauth-avatar-add" aria-hidden="true">+</span>' +
      '      <span class="gauth-account-copy">' +
      '        <span class="gauth-account-name">Use another account</span>' +
      "      </span>" +
      "    </button>" +
      "  </div>" +
      '  <form class="gauth-form" id="gauthForm" hidden novalidate>' +
      '    <div class="gauth-field" id="gauthNameGroup">' +
      '      <label class="gauth-label" for="gauthName">Full name</label>' +
      '      <input class="gauth-input" id="gauthName" type="text" autocomplete="name" placeholder="Your name">' +
      "    </div>" +
      '    <div class="gauth-field">' +
      '      <label class="gauth-label" for="gauthEmail">Email address</label>' +
      '      <input class="gauth-input" id="gauthEmail" type="email" autocomplete="email" placeholder="you@gmail.com" required>' +
      "    </div>" +
      '    <div class="gauth-actions">' +
      '      <button type="button" class="gauth-link" id="gauthBack">Back</button>' +
      '      <button type="submit" class="gauth-continue" id="gauthContinue">Continue</button>' +
      "    </div>" +
      "  </form>" +
      '  <p class="gauth-error" id="gauthError" role="alert"></p>' +
      '  <p class="gauth-note">Demo sign-in: your account is stored only in this browser. No data is sent to Google.</p>' +
      "</div>";

    document.body.appendChild(overlay);

    card = overlay.querySelector(".gauth-card");
    accountsView = byId("gauthAccounts");
    formView = byId("gauthForm");
    form = byId("gauthForm");
    nameInput = byId("gauthName");
    nameGroup = byId("gauthNameGroup");
    emailInput = byId("gauthEmail");
    errorEl = byId("gauthError");
    continueBtn = byId("gauthContinue");

    byId("gauthClose").addEventListener("click", close);
    byId("gauthDemoAccount").addEventListener("click", function () {
      completeSignIn({ name: "Demo Student", email: "demo.student@gmail.com" });
    });
    byId("gauthOtherAccount").addEventListener("click", showForm);
    byId("gauthBack").addEventListener("click", showAccounts);
    form.addEventListener("submit", submitCustomAccount);

    overlay.addEventListener("mousedown", function (e) {
      if (e.target === overlay) close();
    });

    document.addEventListener("keydown", function (e) {
      if (overlay.hidden) return;
      if (e.key === "Escape") close();
      if (e.key === "Tab") trapFocus(e);
    });
  }

  function trapFocus(e) {
    var focusable = card.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), [href]'
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function setModeText() {
    var title = byId("gauthTitle");
    if (!title) return;
    title.textContent = mode === "signup" ? "Sign up with Google" : "Sign in with Google";
    nameGroup.hidden = mode !== "signup";
    nameInput.required = mode === "signup";
  }

  function open() {
    if (!api || typeof api.loginWithGoogle !== "function") {
      window.alert("Google sign-in is not available right now. Please try again.");
      return;
    }
    buildModal();
    lastFocused = document.activeElement;
    busy = false;
    continueBtn.disabled = false;
    continueBtn.textContent = "Continue";
    setModeText();
    showAccounts();
    errorEl.textContent = "";
    overlay.hidden = false;
    document.body.classList.add("gauth-open");
    byId("gauthDemoAccount").focus();
  }

  function close() {
    if (!overlay) return;
    if (busy) return;
    overlay.hidden = true;
    document.body.classList.remove("gauth-open");
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
  }

  function showAccounts() {
    accountsView.hidden = false;
    formView.hidden = true;
    errorEl.textContent = "";
    emailInput.value = "";
    nameInput.value = "";
  }

  function showForm() {
    accountsView.hidden = true;
    formView.hidden = false;
    errorEl.textContent = "";
    emailInput.focus();
  }

  function submitCustomAccount(e) {
    e.preventDefault();
    if (busy) return;

    var email = emailInput.value.trim();
    var name = nameInput.value.trim();

    if (!email) {
      errorEl.textContent = "Email address is required.";
      emailInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errorEl.textContent = "Please enter a valid email address.";
      emailInput.focus();
      return;
    }
    if (mode === "signup" && name.length < 2) {
      errorEl.textContent = "Please enter your full name.";
      nameInput.focus();
      return;
    }

    completeSignIn({ name: name, email: email });
  }

  function completeSignIn(profile) {
    if (busy) return;
    busy = true;
    errorEl.textContent = "";
    continueBtn.disabled = true;
    continueBtn.textContent = "Signing in...";

    var result;
    try {
      result = api.loginWithGoogle(profile);
    } catch (err) {
      console.error("Google sign-in error:", err);
      result = { success: false, message: "Google sign-in failed. Please try again." };
    }

    Promise.resolve(result)
      .then(function (res) {
        if (res && res.success) {
          window.setTimeout(function () {
            window.location.href = getRedirectUrl();
          }, 350);
          return;
        }
        busy = false;
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue";
        errorEl.textContent =
          (res && res.message) || "Google sign-in failed. Please try again.";
      })
      .catch(function (err) {
        console.error("Google sign-in error:", err);
        busy = false;
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue";
        errorEl.textContent = "Google sign-in failed. Please try again.";
      });
  }

  function init() {
    var isSignup = isSignupPage();
    mode = isSignup ? "signup" : "login";
    var button = byId(isSignup ? "googleSignupBtn" : "googleLoginBtn");
    if (!button) return;
    button.addEventListener("click", function (e) {
      e.preventDefault();
      open();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    open: open,
    close: close,
  };
})();
