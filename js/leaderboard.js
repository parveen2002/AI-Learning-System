/* ============================================
   AI-Learning System - Student Leaderboard
   ============================================
   Renders the Leaderboard page: summary cards,
   top-3 podium, category tabs, search, time
   period filter, the ranked student board, "Your
   Position" and rule-based "Keep Going" insight.

   Every number shown comes from api.js (mock
   DEMO students merged with the current student's
   real stored XP / quiz / streak / achievements).
   Nothing here is faked and nothing relies on AI.
   ============================================ */

var LearnSphereLeaderboard = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var basePath = "";

  var TABS = [
    { key: "overall", label: "Overall" },
    { key: "xp", label: "XP" },
    { key: "quiz", label: "Quiz Performance" },
    { key: "streak", label: "Learning Streak" },
    { key: "achievements", label: "Achievements" },
  ];

  var currentCategory = "overall";
  var currentPeriod = "all";
  var searchQuery = "";

  // ==================================================
  // INIT
  // ==================================================

  function init() {
    basePath = detectBasePath();

    var student = api.getCurrentStudent();
    if (!student) {
      window.location.href = basePath + "/pages/login.html";
      return;
    }

    refresh();
  }

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/") !== -1) return "..";
    return ".";
  }

  // ==================================================
  // RENDER PIPELINE (single board per pass)
  // ==================================================

  function refresh() {
    var board = api.getLeaderboardByCategory(currentCategory);
    if (!board) {
      showFatal();
      return;
    }

    var me = null;
    for (var i = 0; i < board.students.length; i++) {
      if (board.students[i].isCurrentUser) {
        me = board.students[i];
        me.listIndex = i;
        break;
      }
    }

    var position = null;
    if (me) {
      var above = me.listIndex > 0 ? board.students[me.listIndex - 1] : null;
      var below = me.listIndex < board.students.length - 1 ? board.students[me.listIndex + 1] : null;
      position = {
        category: board.category,
        rank: me.rank,
        total: board.total,
        pointsBehind: above ? (Number(above.score) || 0) - (Number(me.score) || 0) : 0,
        xpGap: above ? (Number(above.xp) || 0) - (Number(me.xp) || 0) : 0,
        atTop: !above,
        above: above,
        below: below,
      };
    }

    renderSummary(me);
    renderPodium(board);
    renderTabs();
    renderBoard(board);
    renderPosition(me, position);
    renderInsight(me, position);
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

  function showFatal() {
    var main = document.querySelector(".lb-main");
    if (main) {
      main.innerHTML =
        '<div class="lb-fatal">' +
        '  <div class="lb-fatal-icon">&#9888;</div>' +
        '  <h3>Unable to load the leaderboard</h3>' +
        '  <p>Please try again later.</p>' +
        '  <a href="' + basePath + '/pages/dashboard.html" class="btn btn-primary btn-sm">Back to Dashboard</a>' +
        '</div>';
    }
  }

  // ==================================================
  // SUMMARY CARDS
  // ==================================================

  function renderSummary(me) {
    var container = el("lbSummary");
    if (!container) return;

    if (!me) {
      container.innerHTML =
        '<div class="lb-empty">' +
        '  <p class="lb-empty-title">You are not on the leaderboard yet</p>' +
        '  <p class="lb-empty-text">Earn XP and unlock achievements to get ranked.</p>' +
        '</div>';
      return;
    }

    var rankValue = "#" + me.rank;

    container.innerHTML =
      statCard("&#8470;", "Your Rank", rankValue) +
      statCard("&#9733;", "Your XP", formatNumber(me.xp)) +
      statCard("&#9650;", "Current Level", "Level " + me.level) +
      statCard("&#9729;", "Current Streak", me.currentStreak + " day" + (me.currentStreak === 1 ? "" : "s"));
  }

  function statCard(icon, label, value) {
    return (
      '<div class="lb-summary-card">' +
      '  <div class="lb-summary-icon" aria-hidden="true">' + icon + '</div>' +
      '  <div class="lb-summary-meta">' +
      '    <p class="lb-summary-label">' + escapeHtml(label) + '</p>' +
      '    <p class="lb-summary-value">' + escapeHtml(value) + '</p>' +
      '  </div>' +
      '</div>'
    );
  }

  // ==================================================
  // TOP 3 PODIUM
  // ==================================================

  function renderPodium(board) {
    var container = el("lbPodium");
    if (!container) return;

    var top = [];
    for (var i = 0; i < 3 && i < board.students.length; i++) {
      top.push(board.students[i]);
    }

    if (!top.length) {
      container.innerHTML = "";
      return;
    }

    var order = [1, 0, 2];
    var items = "";
    for (var j = 0; j < order.length; j++) {
      var idx = order[j];
      if (idx >= top.length) {
        items += '<div class="lb-podium-cell lb-podium-empty"></div>';
        continue;
      }
      var row = top[idx];
      var rankNum = idx + 1;
      var medal = rankNum === 1 ? "&#129351;" : rankNum === 2 ? "&#129352;" : "&#129353;";
      items +=
        '<div class="lb-podium-cell lb-podium-' + rankNum + '">' +
        '  <div class="lb-podium-medal" aria-hidden="true">' + medal + '</div>' +
        '  <div class="lb-podium-avatar" aria-hidden="true">' + escapeHtml(row.avatarInitial) + '</div>' +
        '  <p class="lb-podium-name">' + escapeHtml(row.displayName) + '</p>' +
        '  <p class="lb-podium-meta">Level ' + row.level + ' &middot; ' + formatNumber(row.xp) + ' XP</p>' +
        '</div>';
    }

    container.innerHTML = items;
  }

  // ==================================================
  // TABS
  // ==================================================

  function renderTabs() {
    var container = el("lbTabs");
    if (!container) return;

    var html = "";
    for (var i = 0; i < TABS.length; i++) {
      var tab = TABS[i];
      var selected = tab.key === currentCategory;
      html +=
        '<button type="button" class="lb-tab' + (selected ? " lb-tab-active" : "") + '"' +
        ' role="tab" data-category="' + tab.key + '"' +
        ' aria-selected="' + (selected ? "true" : "false") + '">' +
        escapeHtml(tab.label) +
        '</button>';
    }
    container.innerHTML = html;

    var buttons = container.querySelectorAll(".lb-tab");
    for (var j = 0; j < buttons.length; j++) {
      buttons[j].addEventListener("click", function () {
        currentCategory = this.getAttribute("data-category");
        refresh();
      });
    }
  }

  // ==================================================
  // BOARD
  // ==================================================

  function renderBoard(board) {
    var tbody = el("lbTbody");
    if (!tbody) return;

    var rows = board.students;
    var query = searchQuery.toLowerCase();
    if (query) {
      var filtered = [];
      for (var i = 0; i < board.students.length; i++) {
        if (board.students[i].displayName.toLowerCase().indexOf(query) !== -1) {
          filtered.push(board.students[i]);
        }
      }
      rows = filtered;
    }

    var html = "";
    if (!rows.length) {
      html =
        '<tr>' +
        '  <td colspan="7">' +
        '    <div class="lb-empty">' +
        '      <p class="lb-empty-title">No students found.</p>' +
        '      <p class="lb-empty-text">Try a different search or category.</p>' +
        '    </div>' +
        '  </td>' +
        '</tr>';
    } else {
      for (var r = 0; r < rows.length; r++) {
        html += buildRow(rows[r]);
      }
    }
    tbody.innerHTML = html;
  }

  function buildRow(row) {
    var rankNum = Number(row.rank) || 0;
    var medal = rankNum === 1 ? "&#129351;" : rankNum === 2 ? "&#129352;" : rankNum === 3 ? "&#129353;" : "";
    var youBadge = row.isCurrentUser ? '<span class="lb-you-badge">You</span>' : "";
    var streakLabel = row.currentStreak + " day" + (row.currentStreak === 1 ? "" : "s");
    var totalForLevel = (Number(row.xpIntoLevel) || 0) + (Number(row.remaining) || 0);

    return (
      '<tr class="' + (row.isCurrentUser ? "lb-row-you" : "") + '"' +
      (row.isCurrentUser ? ' aria-label="You are ranked #' + rankNum + '"' : "") + '>' +
      '  <td class="lb-cell-rank">' +
      '    <span class="lb-medal" aria-hidden="true">' + medal + '</span>' +
      '    <span class="lb-rank-num">' + rankNum + '</span>' +
      '  </td>' +
      '  <td>' +
      '    <div class="lb-student">' +
      '      <span class="lb-avatar" aria-hidden="true">' + escapeHtml(row.avatarInitial) + '</span>' +
      '      <span class="lb-student-name">' + escapeHtml(row.displayName) + ' ' + youBadge + '</span>' +
      '    </div>' +
      '  </td>' +
      '  <td class="lb-cell-level" data-label="Level">' + row.level + '</td>' +
      '  <td class="lb-cell-xp" data-label="XP">' + formatNumber(row.xp) + '</td>' +
      '  <td class="lb-cell-progress" data-label="Progress">' +
      '    <div class="lb-progress">' +
      '      <span class="lb-progress-track" role="progressbar" aria-valuenow="' + (Number(row.levelPct) || 0) + '"' +
      ' aria-valuemin="0" aria-valuemax="100" aria-label="XP progress for ' + escapeHtml(row.displayName) + '">' +
      '        <span class="lb-progress-fill" style="width:' + (Number(row.levelPct) || 0) + '%"></span>' +
      '      </span>' +
      '      <span class="lb-progress-text">' + formatNumber(row.xpIntoLevel) + " / " + formatNumber(totalForLevel) + ' XP</span>' +
      '    </div>' +
      '  </td>' +
      '  <td class="lb-cell-streak" data-label="Streak">' + streakLabel + '</td>' +
      '  <td class="lb-cell-ach" data-label="Achievements">' + row.achievementsUnlocked + '</td>' +
      '</tr>'
    );
  }

  // ==================================================
  // YOUR POSITION
  // ==================================================

  function renderPosition(me, position) {
    var container = el("lbPosition");
    if (!container) return;

    if (!me || !position) {
      container.innerHTML =
        '<p class="lb-muted">Complete a few activities to get ranked.</p>';
      return;
    }

    var gapLabel = currentCategory === "xp" ? "XP" : "pts";

    var peers = "";
    if (position.above) {
      peers +=
        '<div class="lb-peer lb-peer-above">' +
        '  <span class="lb-peer-avatar" aria-hidden="true">' + escapeHtml(position.above.avatarInitial) + '</span>' +
        '  <div class="lb-peer-info">' +
        '    <p class="lb-peer-role">Right above you &#9650;</p>' +
        '    <p class="lb-peer-name">' + escapeHtml(position.above.displayName) + ' &ndash; #' + position.above.rank + '</p>' +
        '  </div>' +
        '</div>';
    }
    if (position.below) {
      peers +=
        '<div class="lb-peer lb-peer-below">' +
        '  <span class="lb-peer-avatar" aria-hidden="true">' + escapeHtml(position.below.avatarInitial) + '</span>' +
        '  <div class="lb-peer-info">' +
        '    <p class="lb-peer-role">Right below you &#9660;</p>' +
        '    <p class="lb-peer-name">' + escapeHtml(position.below.displayName) + ' &ndash; #' + position.below.rank + '</p>' +
        '  </div>' +
        '</div>';
    }

    var headline;
    if (position.atTop) {
      headline = "You're currently at the top!";
    } else if (position.pointsBehind > 0) {
      headline = formatNumber(position.pointsBehind) + " " + gapLabel + " behind #" + position.above.rank;
    } else {
      headline = "Tied with the rank above - keep going to pull ahead.";
    }

    container.innerHTML =
      '<div class="lb-position-hero">' +
      '  <span class="lb-position-rank" aria-label="Your rank">#' + position.rank + '</span>' +
      '  <p class="lb-position-total">out of ' + position.total + ' students</p>' +
      '</div>' +
      '<p class="lb-position-gap">' + escapeHtml(headline) + '</p>' +
      '<div class="lb-peers">' + peers + '</div>';
  }

  // ==================================================
  // KEEP GOING (rule-based, not AI)
  // ==================================================

  function renderInsight(me, position) {
    var container = el("lbInsight");
    if (!container) return;

    if (!me || !position) {
      container.innerHTML =
        '<p class="lb-insight-text">Earn XP, complete quizzes and keep your streak going to start climbing the leaderboard.</p>';
      return;
    }

    var message = "";
    var quizAverage = Number(me.quizAverage) || 0;
    var streak = Number(me.currentStreak) || 0;
    var rank = Number(me.rank) || Number.MAX_VALUE;

    if (position.atTop) {
      message = "You are at the top of the leaderboard. Keep up the pace to stay there.";
    } else if (rank <= 3) {
      message = "You are currently in the top 3. Outstanding work - keep it up!";
    } else if (rank <= 10) {
      message = "You are currently in the top 10. Push a little more to climb higher.";
    } else if (position.pointsBehind > 0 && position.pointsBehind <= 150) {
      message = "You are close to reaching the next rank.";
    } else if (quizAverage > 0 && quizAverage < 80) {
      message = "Complete one more quiz to improve your position.";
    } else if (streak >= 1 && streak <= 6) {
      message = "Maintain your streak to stay competitive.";
    } else if (streak === 0) {
      message = "Start a learning streak today.";
    } else {
      message = "Keep learning daily to build consistency and hold your rank.";
    }

    container.innerHTML =
      '<div class="lb-insight-icon" aria-hidden="true">&#9654;</div>' +
      '<p class="lb-insight-text">' + escapeHtml(message) + '</p>';
  }

  // ==================================================
  // CONTROLS (search + period)
  // ==================================================

  function wireControls() {
    var search = el("lbSearch");
    if (search) {
      search.addEventListener("input", function () {
        searchQuery = this.value.trim();
        refresh();
      });
    }

    var period = el("lbPeriod");
    if (period) {
      period.addEventListener("change", function () {
        currentPeriod = this.value;
        var notice = el("lbPeriodNotice");
        if (notice) {
          if (currentPeriod !== "all") {
            notice.hidden = false;
            notice.setAttribute("aria-hidden", "false");
          } else {
            notice.hidden = true;
            notice.setAttribute("aria-hidden", "true");
          }
        }
      });
    }
  }

  // ==================================================
  // BIND CONTROLS + INIT
  // ==================================================

  document.addEventListener("DOMContentLoaded", function () {
    wireControls();
  });

  return {
    init: init,
  };
})();