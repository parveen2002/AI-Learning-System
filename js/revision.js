/* ============================================
   AI-Learning System - Revision Center Module
   ============================================

   Shows a summary of flashcard review progress,
   lists cards that are due today (grouped by
   topic with priorities), and links into
   revision study sessions on the flashcards
   page. All logic is rule-based and driven by
   api.js -> JSON + LocalStorage.

   (Future: api.js -> Flask REST API -> MySQL)
   ============================================ */

var LearnSphereRevision = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var auth = LearnSphereAuth;

  var basePath = "";
  var currentCourseId = null; // null = all courses

  // ==================================================
  // INIT
  // ==================================================

  function init() {
    basePath = detectBasePath();
    if (!requireLogin()) return;

    var params = getQueryParams();
    if (params.course) {
      var parsed = parseInt(params.course, 10);
      var course = api.getCourseById(parsed);
      if (course) currentCourseId = course.id;
      // Invalid course ids simply fall back to "All Courses".
    }

    buildCourseSelect();
    render();
  }

  function requireLogin() {
    if (auth.isLoggedIn()) return true;
    window.location.href = basePath + "/pages/login.html";
    return false;
  }

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/") !== -1) return "..";
    return ".";
  }

  function getQueryParams() {
    var params = {};
    var qs = window.location.search.substring(1);
    if (!qs) return params;
    var pairs = qs.split("&");
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split("=");
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || "");
    }
    return params;
  }

  // ==================================================
  // COURSE SCOPE SELECTOR
  // ==================================================

  function buildCourseSelect() {
    var select = document.getElementById("revCourseSelect");
    if (!select) return;

    var courses = api.getCourses() || [];
    var html = '<option value="">All Courses</option>';
    for (var i = 0; i < courses.length; i++) {
      html += '<option value="' + courses[i].id + '">' + escapeHtml(courses[i].title) + '</option>';
    }
    select.innerHTML = html;
    select.value = currentCourseId === null ? "" : String(currentCourseId);

    select.addEventListener("change", function () {
      var value = this.value;
      currentCourseId = value === "" ? null : parseInt(value, 10);
      if (currentCourseId === null) {
        window.history.replaceState(null, "", "revision.html");
      } else {
        window.history.replaceState(null, "", "revision.html?course=" + currentCourseId);
      }
      render();
    });
  }

  // ==================================================
  // MAIN RENDER
  // ==================================================

  function render() {
    var summary = api.getRevisionSummary(currentCourseId === null ? undefined : currentCourseId);
    if (!summary) {
      showError();
      return;
    }

    document.getElementById("revError").style.display = "none";

    if (!summary.hasActivity) {
      showEmptyState();
      return;
    }

    document.getElementById("revEmpty").style.display = "none";
    document.getElementById("revContent").style.display = "block";

    setText("revSubtitle", currentCourseId === null
      ? "Revisit cards at the right time so knowledge stays fresh in every course."
      : "Revision overview for this course.");

    renderStats(summary);

    if (summary.dueCount === 0) {
      showCaughtUp(summary);
    } else {
      showDueList(summary);
    }
  }

  // ==================================================
  // EMPTY STATE (no activity at all)
  // ==================================================

  function showEmptyState() {
    document.getElementById("revEmpty").style.display = "block";
    document.getElementById("revContent").style.display = "none";
    setText("revSubtitle", "Revisit cards at the right time so knowledge stays fresh.");
  }

  // ==================================================
  // SUMMARY STATS
  // ==================================================

  function renderStats(summary) {
    setText("revStatDue", String(summary.dueCount));
    setText("revStatReviewed", String(summary.reviewedToday));
    setText("revStatMastered", String(summary.masteredCount));
    setText("revStatNeed", String(summary.needReviewCount));
  }

  // ==================================================
  // ALL CAUGHT UP
  // ==================================================

  function showCaughtUp(summary) {
    document.getElementById("revCaughtUpStudyBtn").href =
      currentCourseId === null ? "flashcards.html" : "flashcards.html?course=" + currentCourseId;

    var nextEl = document.getElementById("revCaughtUpNext");
    if (nextEl) {
      nextEl.textContent = summary.nextReview
        ? "Next review: " + summary.nextReviewDescription + "."
        : "Schedule a study session to plan your next reviews.";
    }

    document.getElementById("revCaughtUp").style.display = "block";
    document.getElementById("revDueSection").style.display = "none";
  }

  // ==================================================
  // DUE LIST
  // ==================================================

  function showDueList(summary) {
    document.getElementById("revCaughtUp").style.display = "none";

    var courseCounts = {};
    for (var i = 0; i < summary.dueTopics.length; i++) {
      var key = String(summary.dueTopics[i].courseId);
      courseCounts[key] = (courseCounts[key] || 0) + summary.dueTopics[i].count;
    }
    var courseNames = Object.keys(courseCounts).length;
    setText("revDueSubtitle", summary.dueCount + " card" + (summary.dueCount === 1 ? " is" : "s are") +
      " due across " + courseNames + " course" + (courseNames === 1 ? "" : "s") + ".");

    var startAll = document.getElementById("revStartAllBtn");
    if (startAll) {
      if (currentCourseId === null) {
        startAll.href = "flashcards.html?mode=revision";
      } else {
        startAll.href = "flashcards.html?course=" + currentCourseId + "&mode=revision";
      }
    }

    var container = document.getElementById("revDueList");
    if (!container) return;

    var html = "";
    for (var t = 0; t < summary.dueTopics.length; t++) {
      var item = summary.dueTopics[t];
      var priorityLabel = capitalize(item.priority);
      var extra = "";
      if (item.overdueCount > 0) {
        extra = '<span class="rev-topic-extra rev-topic-overdue">' + item.overdueCount + ' overdue</span>';
      }
      if (item.hardCount > 0) {
        extra += '<span class="rev-topic-extra rev-topic-hard">' + item.hardCount + ' hard</span>';
      }

      var revisionUrl = "flashcards.html?course=" + item.courseId +
        "&mode=revision&topic=" + encodeURIComponent(item.topic);

      html += '<div class="rev-topic-item">';
      html += '  <div class="rev-topic-icon">&#128196;</div>';
      html += '  <div class="rev-topic-info">';
      html += '    <span class="rev-topic-title">' + escapeHtml(item.topic) + '</span>';
      html += '    <span class="rev-topic-course">' + escapeHtml(item.courseTitle || "Course") + '</span>';
      html += '    <div class="rev-topic-extras">';
      html += '      <span class="rev-topic-extra">' + item.count + ' card' + (item.count === 1 ? "" : "s") + '</span>' + extra;
      html += '    </div>';
      html += '  </div>';
      html += '  <div class="rev-topic-priority">';
      html += '    <span class="rev-priority rev-priority-' + item.priority + '">' + priorityLabel + '</span>';
      html += '    <a href="' + revisionUrl + '" class="btn btn-primary btn-sm">Start Revision</a>';
      html += '  </div>';
      html += '</div>';
    }

    container.innerHTML = html;
    document.getElementById("revDueSection").style.display = "block";
  }

  // ==================================================
  // ERROR
  // ==================================================

  function showError(message) {
    var err = document.getElementById("revError");
    if (!err) return;
    err.style.display = "block";
    err.innerHTML =
      '<div class="rev-state-icon">&#9888;</div>' +
      "<h2>Unable to Load Revision Center</h2>" +
      "<p>" + escapeHtml(message || "Your revision data could not be loaded. Please try again later.") + "</p>" +
      '<div class="rev-state-actions">' +
      '  <a href="flashcards.html" class="btn btn-primary">Flashcards</a>' +
      '  <a href="courses.html" class="btn btn-secondary">Browse Courses</a>' +
      "</div>";
    document.getElementById("revContent").style.display = "none";
    document.getElementById("revEmpty").style.display = "none";
  }

  // ==================================================
  // HELPERS
  // ==================================================

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function capitalize(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: init,
    showError: showError,
  };
})();