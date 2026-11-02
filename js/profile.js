/* ============================================
   AI-Learning System - Profile Module
   ============================================
   Renders and edits the signed-in student's
   profile. All data flows through api.js
   (LocalStorage now, Flask + MySQL later).

   Profile photos are stored on the existing
   user object (profilePhoto field) as a data
   URL, so they persist after refresh and can
   later be moved to backend/cloud storage.
   ============================================ */

var LearnSphereProfile = (function () {
  "use strict";

  var auth = LearnSphereAuth;
  var api = LearnSphereAPI;

  var AVATAR_COLORS = {
    blue: "linear-gradient(135deg, #2563EB, #06B6D4)",
    green: "linear-gradient(135deg, #10B981, #34D399)",
    orange: "linear-gradient(135deg, #F59E0B, #F97316)",
    rose: "linear-gradient(135deg, #F43F5E, #FB7185)",
    violet: "linear-gradient(135deg, #8B5CF6, #A78BFA)",
    slate: "linear-gradient(135deg, #475569, #94A3B8)"
  };
  var AVATAR_KEYS = ["blue", "green", "orange", "rose", "violet", "slate"];

  // Seed values for role/college shown on the mock student profile until the
  // user edits (and thereby persists) them on their own user object.
  var PROFILE_DEFAULTS = {
    role: "MCA Student",
    college: "Chandigarh University"
  };

  var PHOTO_MAX_BYTES = 1024 * 1024; // 1 MB
  var PHOTO_ALLOWED = {
    "image/jpeg": true,
    "image/jpg": true,
    "image/png": true,
    "image/webp": true
  };

  var profile = null;
  var snapshot = null;
  var toastTimer = null;

  function init() {
    if (!auth.isLoggedIn()) {
      var current = window.location.href;
      window.location.href =
        "login.html" + (current ? "?redirect=" + encodeURIComponent(current) : "");
      return;
    }
    bindControls();
    loadProfile();
  }

  function showLoading() {
    var loading = document.getElementById("pfLoading");
    var errorBox = document.getElementById("pfError");
    var content = document.getElementById("pfContent");
    if (loading) loading.style.display = "block";
    if (errorBox) errorBox.style.display = "none";
    if (content) content.style.display = "none";
  }

  function loadProfile() {
    showLoading();
    try {
      var result = api.getUserProfile();
      if (!result || !result.success || !result.profile) {
        showError();
        return;
      }
      profile = result.profile;
      renderProfile();
    } catch (e) {
      showError();
    }
  }

  function showError() {
    var loading = document.getElementById("pfLoading");
    var errorBox = document.getElementById("pfError");
    if (loading) loading.style.display = "none";
    if (errorBox) {
      errorBox.style.display = "block";
      var content = document.getElementById("pfContent");
      if (content) content.style.display = "none";
    }
  }

  function renderProfile() {
    var loading = document.getElementById("pfLoading");
    var errorBox = document.getElementById("pfError");
    var content = document.getElementById("pfContent");
    if (loading) loading.style.display = "none";
    if (errorBox) errorBox.style.display = "none";
    if (content) content.style.display = "block";

    var name = profile.name || "";
    var email = profile.email || "";
    var role = effectiveValue(profile.role, PROFILE_DEFAULTS.role) || "Not set";
    var college = effectiveValue(profile.college, PROFILE_DEFAULTS.college) || "Not set";

    renderAvatar(name, profile.avatarColor);
    setText("pfName", name || "-");
    setText("pfRole", role);
    setText("pfEmail", email || "-");

    var memberSince = profile.createdAt ? formatMemberSince(profile.createdAt) : "";
    var memberEl = document.getElementById("pfMemberSince");
    if (memberEl) {
      if (memberSince) {
        memberEl.textContent = "Member since " + memberSince;
        memberEl.style.display = "";
      } else {
        memberEl.style.display = "none";
      }
    }

    setText("pfInfoName", name || "Not set");
    setText("pfInfoEmail", email || "Not set");
    setText("pfInfoRole", role);
    setText("pfInfoCollege", college);
    setText("pfInfoEducation", profile.educationLevel || "Not set");
    setText("pfInfoGoal", profile.learningGoal || "Add your learning goal");
    setText("pfInfoFormat", profile.preferredFormat || "Not set");

    var dailyGoal = currentDailyGoal();
    setText("pfInfoDailyGoal", dailyGoal ? dailyGoal + " minutes" : "Not set");

    syncPalette(profile.avatarColor || "");
  }

  function effectiveValue(value, fallback) {
    if (value === undefined || value === null) return fallback;
    return value;
  }

  // ==================================================
  // PROFILE PHOTO
  // ==================================================

  function hasPhoto() {
    return !!(profile && profile.profilePhoto);
  }

  /**
   * Validate a selected photo file.
   * Returns an empty string when valid, otherwise a friendly message.
   */
  function validatePhoto(file) {
    if (!file) return "Please choose an image file.";
    var type = String(file.type || "").toLowerCase();
    if (!PHOTO_ALLOWED[type]) {
      return "Please choose a JPG, PNG, or WEBP image.";
    }
    if (file.size > PHOTO_MAX_BYTES) {
      return "Image must be 1 MB or smaller.";
    }
    return "";
  }

  function pickPhoto() {
    var input = document.getElementById("pfPhotoInput");
    if (input) input.click();
  }

  function onPhotoSelected() {
    var input = document.getElementById("pfPhotoInput");
    var file = input && input.files && input.files.length ? input.files[0] : null;
    if (!file) return;
    var error = validatePhoto(file);
    if (error) {
      input.value = "";
      toast(error);
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      applyPhoto(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  function applyPhoto(dataUrl) {
    if (!dataUrl) return;
    profile.profilePhoto = dataUrl;
    var result = api.updateUserProfile({ profilePhoto: dataUrl });
    renderAvatar(profile.name || "", profile.avatarColor);
    if (result && result.success) {
      toast("Profile photo updated.");
      syncNavbar();
    } else {
      toast("We couldn't update your profile photo right now.");
    }
  }

  function removePhoto() {
    if (!hasPhoto()) return;
    profile.profilePhoto = "";
    var result = api.updateUserProfile({ profilePhoto: "" });
    renderAvatar(profile.name || "", profile.avatarColor);
    if (result && result.success) {
      toast("Profile photo removed.");
      syncNavbar();
    } else {
      toast("We couldn't remove your profile photo right now.");
    }
  }

  function renderAvatar(name, colorKey) {
    var avatarEl = document.getElementById("pfAvatar");
    var removeBtn = document.getElementById("pfRemovePhotoBtn");
    if (!avatarEl) return;

    if (hasPhoto()) {
      avatarEl.classList.add("with-photo");
      avatarEl.style.background = "";
      avatarEl.textContent = "";
      avatarEl.innerHTML =
        '<img class="pf-avatar-img" src="' + quoteAttr(profile.profilePhoto) + '" alt="Profile photo">';
      if (removeBtn) removeBtn.style.display = "";
    } else {
      avatarEl.classList.remove("with-photo");
      avatarEl.innerHTML = "";
      avatarEl.textContent = initials(name);
      var color = AVATAR_COLORS[colorKey];
      if (!color) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
          hash = (hash * 31 + name.charCodeAt(i)) % 100000;
        }
        color = AVATAR_COLORS[AVATAR_KEYS[hash % AVATAR_KEYS.length]];
      }
      avatarEl.style.background = color;
      if (removeBtn) removeBtn.style.display = "none";
    }
  }

  function quoteAttr(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /**
   * Refresh the navbar avatar from the saved profile photo
   * so upload/change/remove shows everywhere without a page reload.
   */
  function syncNavbar() {
    if (typeof LearnSphereNav !== "undefined" && LearnSphereNav.updateAuthUI) {
      LearnSphereNav.updateAuthUI();
    }
  }

  function syncPalette(activeColor) {
    var swatches = document.querySelectorAll(".pf-swatch");
    for (var i = 0; i < swatches.length; i++) {
      var active = swatches[i].getAttribute("data-color") === activeColor;
      swatches[i].classList.toggle("active", active);
      swatches[i].setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  function initials(name) {
    if (!name) return "?";
    var parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function minutesFrom(value) {
    if (value === undefined || value === null || value === "") return "";
    var num = Number(value);
    if (!isNaN(num) && num > 0) return Math.round(num);
    var match = /(\d+)/.exec(String(value).trim());
    if (match) return Math.round(Number(match[1]));
    return "";
  }

  function currentDailyGoal() {
    try {
      var prefs = api.getUserPreferences && api.getUserPreferences();
      if (
        prefs &&
        prefs.success &&
        prefs.preferences &&
        prefs.preferences.dailyGoal
      ) {
        return String(prefs.preferences.dailyGoal);
      }
    } catch (e) {}
    return String(minutesFrom(profile && profile.dailyGoal));
  }

  function formatMemberSince(iso) {
    if (!iso) return "";
    var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
    if (!match) return "";
    var months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    var y = Number(match[1]);
    var m = Number(match[2]);
    var d = Number(match[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) return "";
    return d + " " + months[m - 1] + " " + y;
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  // ==================================================
  // EDIT PROFILE
  // ==================================================

  function openEdit() {
    if (!profile) return;
    snapshot = {
      name: profile.name || "",
      role: effectiveValue(profile.role, PROFILE_DEFAULTS.role) || "",
      college: effectiveValue(profile.college, PROFILE_DEFAULTS.college) || "",
      educationLevel: profile.educationLevel || "",
      learningGoal: profile.learningGoal || "",
      preferredFormat: profile.preferredFormat || ""
    };
    setValue("pfEditName", snapshot.name);
    setValue("pfEditEmail", profile.email || "");
    setValue("pfEditRole", snapshot.role);
    setValue("pfEditCollege", snapshot.college);
    setValue("pfEditEducation", snapshot.educationLevel);
    setValue("pfEditGoal", snapshot.learningGoal);
    setValue("pfEditFormat", snapshot.preferredFormat);
    setValue("pfEditDailyGoal", currentDailyGoal());
    clearErrors();
    var card = document.getElementById("pfEditCard");
    var editBtn = document.getElementById("pfEditBtn");
    if (card) card.style.display = "block";
    if (editBtn) editBtn.style.display = "none";
    var nameInput = document.getElementById("pfEditName");
    if (nameInput) nameInput.focus();
  }

  function closeEdit() {
    var card = document.getElementById("pfEditCard");
    var editBtn = document.getElementById("pfEditBtn");
    if (card) card.style.display = "none";
    if (editBtn) editBtn.style.display = "";
    clearErrors();
  }

  function setValue(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value === undefined || value === null ? "" : String(value);
  }

  function showFieldError(id, message) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = message || "";
      el.classList.add("show");
    }
  }

  function clearErrors() {
    var errors = document.querySelectorAll("#pfEditCard .form-error");
    for (var i = 0; i < errors.length; i++) {
      errors[i].textContent = "";
      errors[i].classList.remove("show");
    }
  }

  function saveProfile() {
    var nameInput = document.getElementById("pfEditName");
    var name = nameInput ? nameInput.value.trim() : "";
    clearErrors();

    var valid = true;
    if (!name) {
      showFieldError("pfNameError", "Full name is required.");
      valid = false;
    } else if (name.length < 2) {
      showFieldError("pfNameError", "Name must be at least 2 characters.");
      valid = false;
    }

    var educationLevel = getValue("pfEditEducation");
    var learningGoal = getValue("pfEditGoal");
    var preferredFormat = getValue("pfEditFormat");
    var dailyGoal = getValue("pfEditDailyGoal");

    if (!educationLevel) {
      showFieldError("pfEducationError", "Please select your education level.");
      valid = false;
    }
    if (!learningGoal) {
      showFieldError("pfGoalError", "Please select a learning goal.");
      valid = false;
    }
    if (!preferredFormat) {
      showFieldError("pfFormatError", "Please select a preferred format.");
      valid = false;
    }
    if (!dailyGoal) {
      showFieldError("pfDailyGoalError", "Please set a daily learning goal.");
      valid = false;
    }
    if (!valid) return;

    var role = getValue("pfEditRole").trim();
    var college = getValue("pfEditCollege").trim();

    var result = api.updateUserProfile({
      name: name,
      role: role,
      college: college,
      educationLevel: educationLevel,
      learningGoal: learningGoal,
      preferredFormat: preferredFormat
    });

    if (api.updateUserPreferences) {
      api.updateUserPreferences({ dailyGoal: dailyGoal });
    }

    if (result && result.success) {
      if (result.user) {
        profile = result.user;
      } else {
        profile.name = name;
        profile.role = role;
        profile.college = college;
        profile.educationLevel = educationLevel;
        profile.learningGoal = learningGoal;
        profile.preferredFormat = preferredFormat;
      }
      renderProfile();
      closeEdit();
      syncNavbar();
      toast("Profile updated successfully.");
    } else {
      toast((result && result.message) || "We couldn't update your profile right now.");
    }
  }

  function cancelEdit() {
    if (snapshot && profile) {
      profile.name = snapshot.name;
      profile.role = snapshot.role;
      profile.college = snapshot.college;
      profile.educationLevel = snapshot.educationLevel;
      profile.learningGoal = snapshot.learningGoal;
      profile.preferredFormat = snapshot.preferredFormat;
      renderProfile();
    }
    closeEdit();
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : "";
  }

  // ==================================================
  // AVATAR COLOR
  // ==================================================

  function changeAvatarColor(color) {
    renderAvatar(profile ? profile.name : "", color);
    syncPalette(color);
    var result = api.updateUserProfile({ avatarColor: color });
    if (result && result.success && profile) {
      profile.avatarColor = color;
      toast("Profile updated successfully.");
    } else {
      toast("We couldn't update your avatar right now.");
    }
  }

  // ==================================================
  // TOAST
  // ==================================================

  function toast(message) {
    var el = document.getElementById("pfToast");
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
    var retry = document.getElementById("pfRetryBtn");
    if (retry) {
      retry.addEventListener("click", loadProfile);
    }

    var editBtn = document.getElementById("pfEditBtn");
    if (editBtn) {
      editBtn.addEventListener("click", openEdit);
    }

    var saveBtn = document.getElementById("pfSaveBtn");
    if (saveBtn) {
      saveBtn.addEventListener("click", saveProfile);
    }

    var cancelBtn = document.getElementById("pfCancelBtn");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", cancelEdit);
    }

    var avatarEl = document.getElementById("pfAvatar");
    if (avatarEl) {
      avatarEl.addEventListener("click", pickPhoto);
      avatarEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          pickPhoto();
        }
      });
    }

    var avatarEditBtn = document.getElementById("pfAvatarEditBtn");
    if (avatarEditBtn) {
      avatarEditBtn.addEventListener("click", pickPhoto);
    }

    var changePhotoBtn = document.getElementById("pfChangePhotoBtn");
    if (changePhotoBtn) {
      changePhotoBtn.addEventListener("click", pickPhoto);
    }

    var removePhotoBtn = document.getElementById("pfRemovePhotoBtn");
    if (removePhotoBtn) {
      removePhotoBtn.addEventListener("click", removePhoto);
    }

    var photoInput = document.getElementById("pfPhotoInput");
    if (photoInput) {
      photoInput.addEventListener("change", onPhotoSelected);
    }

    var palette = document.getElementById("pfPalette");
    if (palette) {
      palette.addEventListener("click", function (e) {
        var swatch = e.target;
        if (!swatch || swatch.nodeName !== "BUTTON") return;
        var color = swatch.getAttribute("data-color");
        if (color) changeAvatarColor(color);
      });
    }

    var nameInput = document.getElementById("pfEditName");
    if (nameInput) {
      nameInput.addEventListener("input", function () {
        var err = document.getElementById("pfNameError");
        if (err && err.classList.contains("show")) {
          err.textContent = "";
          err.classList.remove("show");
          nameInput.classList.remove("error");
        }
      });
    }
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: init,
    loadProfile: loadProfile,
    openEdit: openEdit,
    closeEdit: closeEdit,
    saveProfile: saveProfile,
    initials: initials,
    pickPhoto: pickPhoto,
    applyPhoto: applyPhoto,
    removePhoto: removePhoto,
    validatePhoto: validatePhoto
  };
})();