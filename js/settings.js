/* ============================================
   AI-Learning System - Settings Module
   ============================================
   Appearance, learning preferences, notification
   preferences, account, security and privacy.
   All data flows through api.js.
   ============================================ */

var LearnSphereSettings = (function () {
  "use strict";

  var auth = LearnSphereAuth;
  var api = LearnSphereAPI;
  var theme = LearnSphereTheme;

  var prefsSnapshot = null;
  var notifSnapshot = null;
  var toastTimer = null;

  function init() {
    if (!auth.isLoggedIn()) {
      var current = window.location.href;
      window.location.href =
        "login.html" + (current ? "?redirect=" + encodeURIComponent(current) : "");
      return;
    }
    bindControls();
    loadSettings();
  }

  function showLoading() {
    var loading = document.getElementById("stLoading");
    var errorBox = document.getElementById("stError");
    var content = document.getElementById("stContent");
    if (loading) loading.style.display = "block";
    if (errorBox) errorBox.style.display = "none";
    if (content) content.style.display = "none";
  }

  function loadSettings() {
    showLoading();
    try {
      var profileResult = api.getUserProfile();
      var prefsResult = api.getUserPreferences();
      var notifResult = api.getNotificationPreferences();

      if (!profileResult || !profileResult.success) {
        showError();
        return;
      }

      populateAccount(profileResult.profile);
      populatePrefs(prefsResult && prefsResult.success ? prefsResult.preferences : {});
      populateNotif(notifResult && notifResult.success ? notifResult.preferences : {});
      syncThemeButtons();

      var loading = document.getElementById("stLoading");
      var errorBox = document.getElementById("stError");
      var content = document.getElementById("stContent");
      if (loading) loading.style.display = "none";
      if (errorBox) errorBox.style.display = "none";
      if (content) content.style.display = "block";
    } catch (e) {
      showError();
    }
  }

  function showError() {
    var loading = document.getElementById("stLoading");
    var errorBox = document.getElementById("stError");
    if (loading) loading.style.display = "none";
    if (errorBox) {
      errorBox.style.display = "block";
      var content = document.getElementById("stContent");
      if (content) content.style.display = "none";
    }
  }

  // ==================================================
  // POPULATE SECTIONS
  // ==================================================

  function populateAccount(user) {
    var emailEl = document.getElementById("stAccountEmail");
    var statusEl = document.getElementById("stAccountStatus");
    if (emailEl) emailEl.textContent = user.email || "-";
    if (statusEl) statusEl.textContent = "Active";
  }

  function populatePrefs(prefs) {
    setValue("stLearningLevel", prefs.learningLevel || "");
    setValue("stPreferredFormat", prefs.preferredFormat || "");
    setValue("stLearningGoal", prefs.learningGoal || "");

    var dailyMinutes = prefs.dailyGoal || "";
    var goalSelect = document.getElementById("stDailyGoal");
    var customWrap = document.getElementById("stCustomGoalWrap");

    var isCustom = false;
    if (dailyMinutes) {
      var known = ["15", "30", "45", "60", "90", "120"];
      isCustom = known.indexOf(String(dailyMinutes)) === -1;
      setValue("stDailyGoal", isCustom ? "custom" : String(dailyMinutes));
      setValue("stCustomGoal", isCustom ? String(dailyMinutes) : "");
    } else {
      setValue("stDailyGoal", "");
      setValue("stCustomGoal", "");
    }
    if (customWrap) customWrap.style.display = isCustom ? "block" : "none";

    prefsSnapshot = {
      learningLevel: prefs.learningLevel || "",
      preferredFormat: prefs.preferredFormat || "",
      learningGoal: prefs.learningGoal || "",
      dailyGoalValue: goalValue(),
    };
    updateDirtyState();
  }

  function populateNotif(prefs) {
    setChecked("stStudyReminders", prefs.studyReminders !== false);
    setChecked("stRevisionReminders", prefs.revisionReminders !== false);
    setChecked("stQuizReminders", prefs.quizReminders !== false);
    setChecked("stAchievementNotifications", prefs.achievementNotifications !== false);
    notifSnapshot = {
      studyReminders: isChecked("stStudyReminders"),
      revisionReminders: isChecked("stRevisionReminders"),
      quizReminders: isChecked("stQuizReminders"),
      achievementNotifications: isChecked("stAchievementNotifications"),
    };
    updateDirtyState();
  }

  function setValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value === undefined || value === null ? "" : String(value);
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  function setChecked(id, checked) {
    var el = document.getElementById(id);
    if (el) el.checked = !!checked;
  }

  function isChecked(id) {
    var el = document.getElementById(id);
    return el ? !!el.checked : false;
  }

  function goalValue() {
    var select = getValue("stDailyGoal");
    if (select === "custom") {
      return "custom:" + (getValue("stCustomGoal").trim() || "");
    }
    return select;
  }

  // ==================================================
  // DIRTY-STATE TRACKING (§24)
  // ==================================================

  function prefsDirty() {
    if (!prefsSnapshot) return false;
    return (
      getValue("stLearningLevel") !== prefsSnapshot.learningLevel ||
      getValue("stPreferredFormat") !== prefsSnapshot.preferredFormat ||
      getValue("stLearningGoal") !== prefsSnapshot.learningGoal ||
      goalValue() !== prefsSnapshot.dailyGoalValue
    );
  }

  function notifDirty() {
    if (!notifSnapshot) return false;
    return (
      isChecked("stStudyReminders") !== notifSnapshot.studyReminders ||
      isChecked("stRevisionReminders") !== notifSnapshot.revisionReminders ||
      isChecked("stQuizReminders") !== notifSnapshot.quizReminders ||
      isChecked("stAchievementNotifications") !== notifSnapshot.achievementNotifications
    );
  }

  function updateDirtyState() {
    var prefsBtn = document.getElementById("stSavePrefsBtn");
    var prefsTag = document.getElementById("stPrefsDirty");
    var notifBtn = document.getElementById("stSaveNotifBtn");
    var notifTag = document.getElementById("stNotifDirty");

    var pd = prefsSnapshot ? prefsDirty() : false;
    var nd = notifSnapshot ? notifDirty() : false;

    if (prefsBtn) prefsBtn.disabled = !pd;
    if (prefsTag) prefsTag.style.display = pd ? "" : "none";
    if (notifBtn) notifBtn.disabled = !nd;
    if (notifTag) notifTag.style.display = nd ? "" : "none";
  }

  // ==================================================
  // APPEARANCE
  // ==================================================

  function syncThemeButtons() {
    var current = theme.getTheme();
    var lightBtn = document.getElementById("themeLightBtn");
    var darkBtn = document.getElementById("themeDarkBtn");
    if (lightBtn) {
      lightBtn.classList.toggle("active", current === "light");
      lightBtn.setAttribute("aria-checked", current === "light" ? "true" : "false");
    }
    if (darkBtn) {
      darkBtn.classList.toggle("active", current === "dark");
      darkBtn.setAttribute("aria-checked", current === "dark" ? "true" : "false");
    }
  }

  // ==================================================
  // SAVE: LEARNING PREFERENCES
  // ==================================================

  function savePrefs() {
    var goalError = document.getElementById("stGoalError");
    var minutesError = document.getElementById("stGoalMinutesError");
    if (goalError) { goalError.textContent = ""; goalError.classList.remove("show"); }
    if (minutesError) { minutesError.textContent = ""; minutesError.classList.remove("show"); }

    var learningGoal = getValue("stLearningGoal");
    if (!learningGoal) {
      if (goalError) {
        goalError.textContent = "Please select a learning goal.";
        goalError.classList.add("show");
      }
      return;
    }

    var minutes = resolveDailyMinutes();
    if (minutes === null) {
      if (minutesError) {
        minutesError.textContent = "Daily goal must be between 5 and 480 minutes.";
        minutesError.classList.add("show");
      }
      return;
    }

    var prefsResult = api.updateUserPreferences({
      learningLevel: getValue("stLearningLevel"),
      preferredFormat: getValue("stPreferredFormat"),
      learningGoal: learningGoal,
      dailyGoal: minutes || "",
    });

    if (minutes) {
      api.saveDailyGoal(minutes);
    }

    var prefix = "Settings saved successfully.";
    if (prefsResult && !prefsResult.success) {
      prefix = prefsResult.message || prefix;
    }

    populatePrefs(api.getUserPreferences().preferences);
    toast(prefix);
  }

  function resolveDailyMinutes() {
    var select = getValue("stDailyGoal");
    if (!select) return null;
    if (select !== "custom") return Number(select);
    var raw = getValue("stCustomGoal").trim();
    if (!raw) return null;
    var num = Number(raw);
    if (isNaN(num) || num < 5 || num > 480) return null;
    return Math.round(num);
  }

  function resetPrefsDraft() {
    if (prefsSnapshot) {
      setValue("stLearningLevel", prefsSnapshot.learningLevel);
      setValue("stPreferredFormat", prefsSnapshot.preferredFormat);
      setValue("stLearningGoal", prefsSnapshot.learningGoal);
      var savedGoal = prefsSnapshot.dailyGoalValue;
      if (savedGoal && savedGoal.indexOf("custom:") === 0) {
        setValue("stDailyGoal", "custom");
        setValue("stCustomGoal", savedGoal.split(":").slice(1).join(":"));
        var wrap = document.getElementById("stCustomGoalWrap");
        if (wrap) wrap.style.display = "block";
      } else {
        setValue("stDailyGoal", savedGoal || "");
        setValue("stCustomGoal", "");
        var wrap2 = document.getElementById("stCustomGoalWrap");
        if (wrap2) wrap2.style.display = "none";
      }
      updateDirtyState();
      toast("Changes discarded. Previous values restored.");
    }
  }

  // ==================================================
  // SAVE: NOTIFICATIONS
  // ==================================================

  function saveNotif() {
    var result = api.updateNotificationPreferences({
      studyReminders: isChecked("stStudyReminders"),
      revisionReminders: isChecked("stRevisionReminders"),
      quizReminders: isChecked("stQuizReminders"),
      achievementNotifications: isChecked("stAchievementNotifications"),
    });

    var prefix = "Settings saved successfully.";
    if (result && !result.success) {
      prefix = result.message || prefix;
    }

    populateNotif(api.getNotificationPreferences().preferences);
    toast(prefix);
  }

  // ==================================================
  // SECURITY: CHANGE PASSWORD (validation UI only)
  // ==================================================

  function clearPwdErrors() {
    var ids = ["stCurrentPwdError", "stNewPwdError", "stConfirmPwdError"];
    for (var i = 0; i < ids.length; i++) {
      var el = document.getElementById(ids[i]);
      if (el) {
        el.textContent = "";
        el.classList.remove("show");
      }
    }
  }

  function showFieldError(id, message) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = message || "";
      el.classList.add("show");
    }
  }

  function changePassword() {
    clearPwdErrors();
    var current = getValue("stCurrentPassword");
    var next = getValue("stNewPassword");
    var confirm = getValue("stConfirmPassword");

    var valid = true;
    if (!current) {
      showFieldError("stCurrentPwdError", "Current password is required.");
      valid = false;
    }
    if (!next) {
      showFieldError("stNewPwdError", "New password is required.");
      valid = false;
    } else if (next.length < 6) {
      showFieldError("stNewPwdError", "Password must be at least 6 characters.");
      valid = false;
    }
    if (!confirm) {
      showFieldError("stConfirmPwdError", "Please confirm your new password.");
      valid = false;
    } else if (next && confirm !== next) {
      showFieldError("stConfirmPwdError", "Passwords do not match.");
      valid = false;
    }
    if (next && current && next === current) {
      showFieldError("stNewPwdError", "New password must be different from the current password.");
      valid = false;
    }
    if (!valid) return;

    setValue("stCurrentPassword", "");
    setValue("stNewPassword", "");
    setValue("stConfirmPassword", "");

    var note = document.getElementById("stPwdNote");
    if (note) {
      note.classList.remove("alert-info");
      note.classList.add("alert-success");
      note.textContent = "Password change will be available when the backend authentication system is connected.";
    }
    toast("Password change will be available when the backend authentication system is connected.");
  }

  function setupPasswordToggles() {
    var toggles = document.querySelectorAll(".password-toggle[data-pwd]");
    for (var i = 0; i < toggles.length; i++) {
      toggles[i].addEventListener("click", function () {
        var target = document.getElementById(this.getAttribute("data-pwd"));
        if (!target) return;
        var isPassword = target.type === "password";
        target.type = isPassword ? "text" : "password";
        this.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
      });
    }
  }

  // ==================================================
  // PRIVACY: RESET PREFERENCES
  // ==================================================

  function showResetConfirm() {
    var confirmBox = document.getElementById("stResetConfirm");
    var resetBtn = document.getElementById("stResetBtn");
    if (confirmBox) confirmBox.style.display = "block";
    if (resetBtn) resetBtn.style.display = "none";
  }

  function hideResetConfirm() {
    var confirmBox = document.getElementById("stResetConfirm");
    var resetBtn = document.getElementById("stResetBtn");
    if (confirmBox) confirmBox.style.display = "none";
    if (resetBtn) resetBtn.style.display = "";
  }

  function resetPreferences() {
    var result = api.resetUserPreferences();
    var message = result && result.success ? result.message : "We couldn't reset your preferences right now.";
    hideResetConfirm();
    populatePrefs(api.getUserPreferences().preferences);
    populateNotif(api.getNotificationPreferences().preferences);
    toast(message);
  }

  // ==================================================
  // ACCOUNT: LOGOUT
  // ==================================================

  function logout() {
    auth.logoutUser();
    window.location.href = "login.html";
  }

  // ==================================================
  // TOAST
  // ==================================================

  function toast(message) {
    var el = document.getElementById("stToast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("show");
    }, 2600);
  }

  // ==================================================
  // BIND CONTROLS
  // ==================================================

  function bindControls() {
    var retry = document.getElementById("stRetryBtn");
    if (retry) retry.addEventListener("click", loadSettings);

    var lightBtn = document.getElementById("themeLightBtn");
    var darkBtn = document.getElementById("themeDarkBtn");
    if (lightBtn) {
      lightBtn.addEventListener("click", function () {
        theme.setTheme("light");
        syncThemeButtons();
      });
    }
    if (darkBtn) {
      darkBtn.addEventListener("click", function () {
        theme.setTheme("dark");
        syncThemeButtons();
      });
    }

    var prefsFields = ["stLearningLevel", "stPreferredFormat", "stLearningGoal", "stDailyGoal"];
    for (var i = 0; i < prefsFields.length; i++) {
      var field = document.getElementById(prefsFields[i]);
      if (field) {
        field.addEventListener("change", function () {
          updateDirtyState();
          if (this.id === "stDailyGoal") {
            var wrap = document.getElementById("stCustomGoalWrap");
            if (wrap) wrap.style.display = this.value === "custom" ? "block" : "none";
          }
        });
      }
    }
    var customGoal = document.getElementById("stCustomGoal");
    if (customGoal) customGoal.addEventListener("input", updateDirtyState);

    var savePrefsBtn = document.getElementById("stSavePrefsBtn");
    if (savePrefsBtn) savePrefsBtn.addEventListener("click", savePrefs);

    var resetDraftBtn = document.getElementById("stResetPrefsDraftBtn");
    if (resetDraftBtn) resetDraftBtn.addEventListener("click", resetPrefsDraft);

    var notifToggles = ["stStudyReminders", "stRevisionReminders", "stQuizReminders", "stAchievementNotifications"];
    for (var t = 0; t < notifToggles.length; t++) {
      var toggle = document.getElementById(notifToggles[t]);
      if (toggle) toggle.addEventListener("change", updateDirtyState);
    }

    var saveNotifBtn = document.getElementById("stSaveNotifBtn");
    if (saveNotifBtn) saveNotifBtn.addEventListener("click", saveNotif);

    var changePwdBtn = document.getElementById("stChangePwdBtn");
    if (changePwdBtn) changePwdBtn.addEventListener("click", changePassword);

    setupPasswordToggles();

    var resetBtn = document.getElementById("stResetBtn");
    if (resetBtn) resetBtn.addEventListener("click", showResetConfirm);

    var resetConfirmBtn = document.getElementById("stResetConfirmBtn");
    if (resetConfirmBtn) resetConfirmBtn.addEventListener("click", resetPreferences);

    var resetCancelBtn = document.getElementById("stResetCancelBtn");
    if (resetCancelBtn) resetCancelBtn.addEventListener("click", hideResetConfirm);

    var logoutBtn = document.getElementById("settingsLogoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: init,
    loadSettings: loadSettings,
    savePrefs: savePrefs,
    saveNotif: saveNotif,
    resolveDailyMinutes: resolveDailyMinutes,
  };
})();