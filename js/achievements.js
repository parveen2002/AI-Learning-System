/* ============================================
   AI-Learning System - Achievements & Gamification
   ============================================
   Renders the Achievements page: XP + level hero,
   gamification summary, category filters, the
   achievement grid, next achievement, recently
   unlocked and the XP history.

   XP and unlock state are computed by api.js from
   real JSON data + LocalStorage. Nothing here is
   faked and nothing relies on AI.
   ============================================ */

var LearnSphereAchievements = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var basePath = "";

  var FILTER_CATEGORIES = [
    "All",
    "Learning",
    "Quizzes",
    "Courses",
    "Revision",
    "Consistency",
    "Milestones",
  ];

  var currentFilter = "All";
  var pendingUnlocks = [];
  var modalReady = false;

  // ==================================================
  // INIT
  // ==================================================

  function init() {
    basePath = detectBasePath();
    setupModal();

    var student = api.getCurrentStudent();
    if (!student) {
      window.location.href = basePath + "/pages/login.html";
      return;
    }

    var data = api.getAchievementProgress();
    if (!data) {
      showFatal();
      return;
    }

    renderXpHero(data.xp);
    renderSummary(data.summary);
    renderFilters(data.achievements);
    renderGrid(data.achievements, currentFilter);
    renderNext(data.nextAchievement);
    renderRecent(data.recentUnlocked);
    renderHistory(data.xpHistory);

    if (data.newlyUnlocked && data.newlyUnlocked.length) {
      pendingUnlocks = data.newlyUnlocked.slice(0);
      showNextUnlock();
    }
  }

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/") !== -1) return "..";
    return ".";
  }

  // ==================================================
  // SHARED HELPERS
  // ==================================================

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value) {
    var n = Number(value) || 0;
    return n.toLocaleString("en-US");
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    var month = d.toLocaleString("en-US", { month: "short" });
    return month + " " + d.getDate() + ", " + d.getFullYear();
  }

  function emptyState(icon, title, text) {
    return (
      '<div class="ach-empty">' +
      '  <div class="ach-empty-icon" aria-hidden="true">' + icon + '</div>' +
      '  <p class="ach-empty-title">' + escapeHtml(title) + '</p>' +
      '  <p class="ach-empty-text">' + escapeHtml(text) + '</p>' +
      '</div>'
    );
  }

  function showFatal() {
    var main = document.querySelector(".achievements-main");
    if (main) {
      main.innerHTML =
        '<div class="ach-fatal">' +
        '  <div class="ach-fatal-icon">&#9888;</div>' +
        '  <h3>Unable to load achievements</h3>' +
        '  <p>Please try again later.</p>' +
        '  <a href="' + basePath + '/pages/dashboard.html" class="btn btn-primary btn-sm">Back to Dashboard</a>' +
        '</div>';
    }
  }

  // ==================================================
  // XP HERO
  // ==================================================

  function renderXpHero(xp) {
    var container = el("achXpHero");
    if (!container || !xp) return;

    var pct = xp.levelPct || 0;
    var remaining = xp.remaining || 0;

    container.innerHTML =
      '<div class="ach-xp-left">' +
      '  <div class="ach-level-badge">' +
      '    <span class="ach-level-num">' + xp.level + '</span>' +
      '    <span class="ach-level-label">Level</span>' +
      '  </div>' +
      '</div>' +
      '<div class="ach-xp-right">' +
      '  <div class="ach-xp-top">' +
      '    <div class="ach-xp-total">' + formatNumber(xp.floor + xp.xpIntoLevel) + ' XP</div>' +
      '    <div class="ach-xp-next">' + formatNumber(remaining) + ' XP to Level ' + (xp.level + 1) + '</div>' +
      '  </div>' +
      '  <div class="ach-xp-track" role="img" aria-label="Level progress ' + pct + '%">' +
      '    <div class="ach-xp-fill" style="width:' + pct + '%;"></div>' +
      '  </div>' +
      '  <div class="ach-xp-range">' +
      '    <span>' + formatNumber(xp.floor) + ' XP</span>' +
      '    <span>' + pct + '%</span>' +
      '    <span>' + formatNumber(xp.nextLevelAt) + ' XP</span>' +
      '  </div>' +
      '</div>';
  }

  // ==================================================
  // GAMIFICATION SUMMARY
  // ==================================================

  function renderSummary(summary) {
    var container = el("achSummary");
    if (!container || !summary) {
      if (container) container.innerHTML = emptyState("&#9888;", "No data yet", "Your gamification summary will appear here.");
      return;
    }

    var tiles = [
      { icon: "&#9889;", value: formatNumber(summary.totalXp) + " XP", label: "Total XP" },
      { icon: "&#127942;", value: "Level " + summary.level, label: "Current Level" },
      { icon: "&#127941;", value: summary.achievementsUnlocked + " / " + summary.achievementsTotal, label: "Achievements Unlocked" },
      { icon: "&#127919;", value: summary.achievementsRemaining, label: "Achievements Remaining" },
      { icon: "&#128293;", value: summary.currentStreak + " days", label: "Current Streak" },
      { icon: "&#128640;", value: summary.longestStreak + " days", label: "Longest Streak" },
    ];

    var html = "";
    for (var i = 0; i < tiles.length; i++) {
      html += '<div class="ach-kpi-tile">';
      html += '  <span class="ach-kpi-icon" aria-hidden="true">' + tiles[i].icon + '</span>';
      html += '  <span class="ach-kpi-value">' + escapeHtml(tiles[i].value) + '</span>';
      html += '  <span class="ach-kpi-label">' + escapeHtml(tiles[i].label) + '</span>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  // ==================================================
  // FILTERS
  // ==================================================

  function renderFilters(achievements) {
    var container = el("achFilters");
    if (!container) return;

    var counts = {};
    for (var i = 0; i < achievements.length; i++) {
      var cat = achievements[i].category || "Other";
      if (!counts[cat]) counts[cat] = 0;
      counts[cat]++;
    }

    var html = "";
    for (var f = 0; f < FILTER_CATEGORIES.length; f++) {
      var catName = FILTER_CATEGORIES[f];
      var count = catName === "All" ? achievements.length : (counts[catName] || 0);
      var cls = "ach-filter";
      if (catName === currentFilter) cls += " active";
      html += '<button type="button" class="' + cls + '" data-category="' + escapeHtml(catName) + '" aria-pressed="' +
        (catName === currentFilter ? "true" : "false") + '">' +
        escapeHtml(catName) + ' <span class="ach-filter-count">' + count + '</span>' +
        '</button>';
    }
    container.innerHTML = html;

    var buttons = container.querySelectorAll(".ach-filter");
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener("click", function () {
        currentFilter = this.getAttribute("data-category");
        renderFilters(achievements);
        renderGrid(achievements, currentFilter);
      });
    }
  }

  // ==================================================
  // ACHIEVEMENT GRID
  // ==================================================

  function renderGrid(achievements, filter) {
    var container = el("achGrid");
    if (!container) return;

    if (!achievements || !achievements.length) {
      container.innerHTML = emptyState("&#127942;", "No achievements available", "Achievements will appear here soon.");
      return;
    }

    var items = [];
    for (var i = 0; i < achievements.length; i++) {
      if (filter === "All" || achievements[i].category === filter) {
        items.push(achievements[i]);
      }
    }

    if (!items.length) {
      container.innerHTML = emptyState("&#128269;", "Nothing in this category yet", "Keep learning to fill this category.");
      return;
    }

    var html = "";
    for (var a = 0; a < items.length; a++) {
      html += buildCard(items[a]);
    }
    container.innerHTML = html;
  }

  function buildCard(ach) {
    var statusCls = ach.unlocked ? "ach-card-unlocked" : "ach-card-locked";
    var badgeCls = ach.unlocked ? "ach-badge-unlocked" : "ach-badge-locked";
    var badgeText = ach.unlocked ? "&#128275;&nbsp; Unlocked" : "&#128274;&nbsp; Locked";
    var dateText = ach.unlocked
      ? "Unlocked " + formatDate(ach.unlockDate)
      : (ach.remainingText || ach.progressText);

    return (
      '<article class="ach-card ' + statusCls + '">' +
      '  <div class="ach-card-head">' +
      '    <div class="ach-card-icon" aria-hidden="true">' + escapeHtml(ach.icon) + '</div>' +
      '    <div class="ach-card-head-info">' +
      '      <h3 class="ach-card-name">' + escapeHtml(ach.name) + '</h3>' +
      '      <span class="ach-card-category">' + escapeHtml(ach.category) + '</span>' +
      '    </div>' +
      '    <span class="ach-status-badge ' + badgeCls + '">' + badgeText + '</span>' +
      '  </div>' +
      '  <div class="ach-card-inner">' +
      '    <p class="ach-card-desc">' + escapeHtml(ach.description) + '</p>' +
      '    <p class="ach-card-req">' + escapeHtml(ach.requirement) + '</p>' +
      '    <div class="ach-progress">' +
      '      <div class="ach-progress-track" role="progressbar" aria-valuenow="' + ach.progressPercentage +
      '" aria-valuemin="0" aria-valuemax="100" aria-label="' + escapeHtml(ach.progressText) + '">' +
      '        <div class="ach-progress-fill" style="width:' + ach.progressPercentage + '%;"></div>' +
      '      </div>' +
      '      <span class="ach-progress-text">' + escapeHtml(ach.progressText) + '</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="ach-card-foot">' +
      '    <span class="ach-xp-chip">+' + ach.xp + ' XP</span>' +
      '    <span class="ach-card-foot-note">' + escapeHtml(dateText) + '</span>' +
      '  </div>' +
      '</article>'
    );
  }

  // ==================================================
  // NEXT ACHIEVEMENT
  // ==================================================

  function renderNext(next) {
    var container = el("achNext");
    if (!container) return;

    if (!next) {
      container.innerHTML = emptyState("&#127881;", "All achievements unlocked!", "You have unlocked every achievement available right now.");
      return;
    }

    var pct = next.progressPercentage || 0;
    var remaining = next.target - next.value;
    if (remaining < 0) remaining = 0;

    container.innerHTML =
      '<div class="ach-next-head">' +
      '  <div class="ach-card-icon ach-next-icon" aria-hidden="true">' + escapeHtml(next.icon) + '</div>' +
      '  <div class="ach-next-info">' +
      '    <h3 class="ach-next-name">' + escapeHtml(next.name) + '</h3>' +
      '    <p class="ach-next-desc">' + escapeHtml(next.description) + '</p>' +
      '  </div>' +
      '</div>' +
      '<div class="ach-progress">' +
      '  <div class="ach-progress-track" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="' + escapeHtml(next.progressText) + '">' +
      '    <div class="ach-progress-fill" style="width:' + pct + '%;"></div>' +
      '  </div>' +
      '  <span class="ach-progress-text">' + escapeHtml(next.progressText) + '</span>' +
      '</div>' +
      '<p class="ach-next-remaining">' + escapeHtml(next.remainingText) + '</p>' +
      '<div class="ach-next-reward"><span class="ach-xp-chip-large">+' + next.xp + ' XP</span></div>';
  }

  // ==================================================
  // RECENTLY UNLOCKED
  // ==================================================

  function renderRecent(recent) {
    var container = el("achRecent");
    if (!container) return;

    if (!recent || !recent.length) {
      container.innerHTML = emptyState(
        "&#127942;",
        "No achievements yet",
        "Complete your first lesson to unlock your first achievement."
      );
      return;
    }

    var html = '<ul class="ach-recent-list">';
    for (var i = 0; i < recent.length; i++) {
      var r = recent[i];
      html += '<li class="ach-recent-item">';
      html += '  <span class="ach-recent-icon" aria-hidden="true">' + escapeHtml(r.icon) + '</span>';
      html += '  <div class="ach-recent-info">';
      html += '    <span class="ach-recent-name">' + escapeHtml(r.name) + '</span>';
      html += '    <span class="ach-recent-date">' + formatDate(r.unlockDate) + '</span>';
      html += '  </div>';
      html += '  <span class="ach-recent-xp">+' + r.xp + ' XP</span>';
      html += '</li>';
    }
    html += '</ul>';
    container.innerHTML = html;
  }

  // ==================================================
  // XP HISTORY
  // ==================================================

  function renderHistory(history) {
    var container = el("achHistory");
    if (!container) return;

    if (!history || !history.length) {
      container.innerHTML = emptyState("&#9889;", "No XP earned yet", "Complete lessons, quizzes and flashcards to start earning XP.");
      return;
    }

    var cap = history.length <= 30 ? history.length : 30;
    var html = '<ul class="ach-history-list">';
    for (var i = 0; i < cap; i++) {
      var h = history[i];
      var amount = "+" + formatNumber(h.amount) + " XP";
      var isAch = h.label === "Achievement unlocked";
      html += '<li class="ach-history-item">';
      html += '  <span class="ach-history-amount">' + escapeHtml(amount) + '</span>';
      html += '  <div class="ach-history-body">';
      html += '    <span class="ach-history-label">' + escapeHtml(h.label) + '</span>';
      if (h.meta) {
        html += '    <span class="ach-history-meta">' + escapeHtml(h.meta) + '</span>';
      }
      html += '  </div>';
      html += '  <span class="ach-history-date">' + formatDate(h.date) + '</span>';
      html += '</li>';
    }
    html += '</ul>';
    if (history.length > cap) {
      html += '<p class="ach-history-more">Showing the latest ' + cap + ' of ' + history.length + ' XP entries.</p>';
    }
    container.innerHTML = html;
  }

  // ==================================================
  // UNLOCK NOTIFICATION MODAL
  // ==================================================

  function showNextUnlock() {
    var overlay = el("achModalOverlay");
    if (!overlay) return;

    var next = pendingUnlocks.shift();
    if (!next) {
      hideUnlockModal();
      return;
    }

    var iconEl = el("achModalIcon");
    var nameEl = el("achModalName");
    var xpEl = el("achModalXp");
    if (iconEl) iconEl.textContent = next.icon || "\uD83C\uDF96";
    if (nameEl) nameEl.textContent = next.name || "Achievement";
    if (xpEl) xpEl.textContent = "+" + (next.xp || 0) + " XP";

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");

    var action = el("achModalAction");
    if (action) action.focus();
  }

  function hideUnlockModal() {
    var overlay = el("achModalOverlay");
    if (!overlay) return;
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }

  function setupModal() {
    var overlay = el("achModalOverlay");
    if (!overlay || modalReady) return;
    modalReady = true;

    var action = el("achModalAction");
    var close = el("achModalClose");

    function advance() {
      if (pendingUnlocks.length) {
        showNextUnlock();
      } else {
        hideUnlockModal();
      }
    }

    if (action) {
      action.addEventListener("click", advance);
    }
    if (close) {
      close.addEventListener("click", advance);
    }
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) advance();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) advance();
    });
  }

  // ==================================================
  // PUBLIC
  // ==================================================

  return {
    init: init,
  };
})();