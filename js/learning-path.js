/* ============================================
   AI-Learning System - Learning Path Module
   ============================================

   Personalized learning path with rule-based
   adaptive logic. No real AI — rules analyze
   quiz scores, lesson progress, and mastery.

   Data flow:
   learning-path.js -> api.js -> JSON + LocalStorage
   (Future: api.js -> Flask REST API -> MySQL)
   ============================================ */

var LearnSphereLearningPath = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var auth = LearnSphereAuth;

  var basePath = "";
  var coursesData = [];
  var recommendationsData = {};
  var currentCourseId = null;

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/") !== -1) return "..";
    return ".";
  }

  function requireLogin() {
    basePath = detectBasePath();
    if (auth.isLoggedIn()) return true;
    window.location.href = basePath + "/pages/login.html";
    return false;
  }

  // ==================================================
  // INIT
  // ==================================================

  function init(courses, recommendations) {
    if (!requireLogin()) return;

    coursesData = courses || [];
    recommendationsData = recommendations || {};

    var enrolledIds = getEnrolledCourseIds();

    if (enrolledIds.length === 0) {
      showEmptyState();
      return;
    }

    buildCourseSelector(enrolledIds);

    // Read URL param or use first enrolled course
    var params = getQueryParams();
    if (params.course) {
      var parsed = parseInt(params.course, 10);
      var found = false;
      for (var i = 0; i < enrolledIds.length; i++) {
        if (enrolledIds[i] === parsed) { found = true; break; }
      }
      currentCourseId = found ? parsed : enrolledIds[0];
    } else {
      currentCourseId = enrolledIds[0];
    }

    document.getElementById("lpCourseSelect").value = currentCourseId;
    updateTutorLink();
    renderPath(currentCourseId);
    document.getElementById("lpContent").style.display = "block";
  }

  // ==================================================
  // DATA HELPERS
  // ==================================================

  function getEnrolledCourseIds() {
    var enrolled = api.getEnrolledCourses();
    var ids = Array.isArray(enrolled) ? enrolled : [];
    var out = [];
    for (var i = 0; i < ids.length; i++) {
      // Only include courses that exist
      if (api.getCourseById(ids[i])) out.push(ids[i]);
    }
    return out;
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

  function getMasteryInfo(level) {
    var levels = recommendationsData.mastery_levels || {};
    return levels[level] || levels.needs_improvement || {
      label: level, description: "", message: ""
    };
  }

  function getRecommendation(key) {
    var recs = recommendationsData.recommendations || {};
    return recs[key] || recs.next_lesson || { title: "", message: "", actionLabel: "Continue" };
  }

  function getDifficultyInfo(level) {
    var diffs = recommendationsData.difficulty || {};
    return diffs[level] || diffs.standard || { label: level, description: "", message: "" };
  }

  function getMessage(key) {
    var msgs = recommendationsData.messages || {};
    return msgs[key] || "";
  }

  // ==================================================
  // EMPTY STATE
  // ==================================================

  function showEmptyState() {
    document.getElementById("lpEmpty").style.display = "block";
    document.getElementById("lpContent").style.display = "none";
  }

  function showError() {
    var errEl = document.getElementById("lpError");
    if (!errEl) return;
    errEl.style.display = "block";
    errEl.innerHTML =
      '<div class="lp-error-icon">&#128275;</div>' +
      "<h2>Unable to Load Learning Path</h2>" +
      "<p>We could not load your learning path data. Please try again later.</p>" +
      '<a href="courses.html" class="btn btn-primary">Browse Courses</a>';
    document.getElementById("lpContent").style.display = "none";
  }

  // ==================================================
  // COURSE SELECTOR
  // ==================================================

  function buildCourseSelector(enrolledIds) {
    var select = document.getElementById("lpCourseSelect");
    if (!select) return;
    var html = "";
    for (var i = 0; i < enrolledIds.length; i++) {
      var course = api.getCourseById(enrolledIds[i]);
      if (course) {
        html += '<option value="' + course.id + '">' + escapeHtml(course.title) + '</option>';
      }
    }
    select.innerHTML = html;

    select.addEventListener("change", function () {
      currentCourseId = parseInt(this.value, 10);
      renderPath(currentCourseId);
      updateTutorLink();
      window.history.replaceState(null, "", "learning-path.html?course=" + currentCourseId);
    });
  }

  function updateTutorLink() {
    var btn = document.getElementById("lpAskTutorBtn");
    if (!btn || !currentCourseId) return;
    btn.href = "ai-tutor.html?course=" + currentCourseId;
  }

  // ==================================================
  // MAIN RENDER
  // ==================================================

  function renderPath(courseId) {
    var data = api.getLearningPathData(courseId);
    if (!data) {
      showError();
      return;
    }

    document.getElementById("lpSubtitle").textContent =
      "Path for " + data.course.title;

    renderStats(data.stats);
    renderMessage(data);
    renderRecommendation(data);
    renderTimeline(data);
    renderWeakTopics(data.weakTopics);
    renderStrongTopics(data.strongTopics);
    renderDifficulty(data.mastery, data.stats);
    renderRevision(courseId);

    document.getElementById("lpContent").style.display = "block";
  }

  // ==================================================
  // STATS
  // ==================================================

  function renderStats(stats) {
    setText("lpStatProgress", stats.completionPct + "%");
    setText("lpStatQuiz", stats.latestQuizScore !== null ? stats.latestQuizScore + "%" : "--");
    setText("lpStatBest", stats.bestQuizScore !== null ? stats.bestQuizScore + "%" : "--");

    var masteryInfo = getMasteryInfo(stats.masteryLevel);
    setText("lpStatMastery", masteryInfo.label);
    setText("lpStatLessons", stats.completedLessons + " / " + stats.totalLessons);

    // Color-code mastery
    var masteryEl = document.getElementById("lpStatMastery");
    if (masteryEl) {
      masteryEl.className = "lp-stat-value lp-mastery-" + stats.masteryLevel;
    }
  }

  // ==================================================
  // PERSONALIZED MESSAGE
  // ==================================================

  function renderMessage(data) {
    var rec = data.recommendation;
    var stats = data.stats;
    var title = "";
    var text = "";
    var icon = "&#128161;";

    if (!data.hasActivity) {
      title = "Start Your Journey";
      text = getMessage("encouragement");
      icon = "&#127775;";
    } else if (stats.masteryLevel === "mastered") {
      title = "Excellent Work!";
      text = getMessage("excellent");
      icon = "&#127942;";
    } else if (rec && rec.type === "retry_quiz") {
      title = "Review Recommended";
      text = getMessage("needs_review");
      icon = "&#128218;";
    } else if (stats.completionPct >= 80) {
      title = "Almost There!";
      text = getMessage("milestone_reached");
      icon = "&#128640;";
    } else if (stats.completionPct > 0) {
      title = "Good Progress";
      text = getMessage("good_progress");
      icon = "&#128170;";
    } else {
      title = "Welcome Back";
      text = getMessage("welcome_back");
      icon = "&#128075;";
    }

    setText("lpMessageTitle", title);
    setText("lpMessageText", text);
    var iconEl = document.getElementById("lpMessageIcon");
    if (iconEl) iconEl.innerHTML = icon;
  }

  // ==================================================
  // RECOMMENDATION CARD
  // ==================================================

  function renderRecommendation(data) {
    var rec = data.recommendation;
    if (!rec) {
      document.getElementById("lpRecommendation").style.display = "none";
      return;
    }

    setText("lpRecTitle", rec.title || "Next Step");
    setText("lpRecText", rec.message || "");

    // Reason text
    var reason = "";
    if (rec.score !== undefined && rec.score !== null) {
      reason = "Your latest quiz score was " + rec.score + "%.";
    } else if (data.stats.completionPct > 0 && data.stats.completionPct < 100) {
      reason = "You have completed " + data.stats.completionPct + "% of this course so far.";
    }
    setText("lpRecReason", reason);

    // Badge
    var badge = document.getElementById("lpRecBadge");
    if (badge) {
      var priority = rec.priority || "medium";
      badge.className = "lp-recommendation-badge lp-rec-" + priority;
      badge.textContent = rec.type === "retry_quiz" ? "Needs Attention" :
        rec.type === "take_quiz" ? "Action Required" :
        rec.type === "course_completed" ? "Achievement" : "Recommended";
    }

    // Action buttons
    var actionBtn = document.getElementById("lpRecActionBtn");
    var secondaryBtn = document.getElementById("lpRecSecondaryBtn");

    if (actionBtn) {
      actionBtn.textContent = rec.actionLabel || "Continue";
      actionBtn.innerHTML = (rec.actionLabel || "Continue") + " &#8594;";

      if (rec.type === "retry_quiz" || rec.type === "take_quiz") {
        actionBtn.href = rec.quizUrl || "#";
      } else if (rec.type === "continue") {
        actionBtn.href = "lesson.html?courseId=" + data.course.id + "&lessonId=" + rec.lessonId;
      } else if (rec.type === "course_completed") {
        actionBtn.href = "courses.html";
      } else if (rec.type === "start") {
        actionBtn.href = "course-details.html?id=" + data.course.id;
      } else {
        actionBtn.href = "course-details.html?id=" + data.course.id;
      }
    }

    if (secondaryBtn) {
      if (rec.type === "retry_quiz" || rec.type === "take_quiz") {
        secondaryBtn.style.display = "inline-flex";
        secondaryBtn.href = "course-details.html?id=" + data.course.id;
        secondaryBtn.textContent = "View Course";
      } else {
        secondaryBtn.style.display = "none";
      }
    }
  }

  // ==================================================
  // TIMELINE
  // ==================================================

  function renderTimeline(data) {
    var container = document.getElementById("lpTimeline");
    if (!container) return;

    var timeline = data.timeline;
    if (!timeline || timeline.length === 0) {
      container.innerHTML = '<p class="lp-timeline-empty">No lessons in this course yet.</p>';
      return;
    }

    var html = "";
    var currentModuleId = "";

    for (var i = 0; i < timeline.length; i++) {
      var item = timeline[i];

      // Module separator
      if (item.moduleId !== currentModuleId) {
        currentModuleId = item.moduleId;
        html += '<div class="lp-timeline-module">';
        html += '  <span class="lp-timeline-module-label">' + escapeHtml(item.moduleTitle) + '</span>';
        html += '</div>';
      }

      // Status classes
      var statusClass = "lp-timeline-item";
      var statusIcon = "";
      var statusLabel = "";
      switch (item.status) {
        case "completed":
          statusClass += " completed";
          statusIcon = "&#10003;";
          statusLabel = "Completed";
          break;
        case "current":
          statusClass += " current";
          statusIcon = "&#9679;";
          statusLabel = "Current";
          break;
        case "needs_review":
          statusClass += " needs-review";
          statusIcon = "&#33;";
          statusLabel = "Needs Review";
          break;
        default:
          statusIcon = "&#9675;";
          statusLabel = "Upcoming";
      }

      // Type icon
      var typeIcon = "";
      switch (item.type) {
        case "video": typeIcon = "&#127909;"; break;
        case "reading": typeIcon = "&#128214;"; break;
        case "practice": typeIcon = "&#128736;"; break;
        case "quiz": typeIcon = "&#128221;"; break;
        default: typeIcon = "&#128214;";
      }

      // Build link
      var href = "#";
      if (item.type === "quiz") {
        var quizId = null;
        var quizzes = api.getQuizzes(data.course.id);
        if (quizzes) {
          for (var q = 0; q < quizzes.length; q++) {
            if (quizzes[q].lesson_id === item.lessonId) {
              quizId = quizzes[q].quiz_id;
              break;
            }
          }
        }
        if (quizId) {
          href = "quiz.html?course=" + data.course.id + "&lesson=" + item.lessonId + "&quiz=" + quizId;
        }
      } else {
        href = "lesson.html?courseId=" + data.course.id + "&lessonId=" + item.lessonId;
      }

      html += '<div class="' + statusClass + '">';
      html += '  <div class="lp-timeline-connector">';
      html += '    <span class="lp-timeline-dot">' + statusIcon + '</span>';
      html += '    <span class="lp-timeline-line"></span>';
      html += '  </div>';
      html += '  <div class="lp-timeline-content">';
      html += '    <a href="' + href + '" class="lp-timeline-link">';
      html += '      <span class="lp-timeline-type">' + typeIcon + '</span>';
      html += '      <div class="lp-timeline-info">';
      html += '        <span class="lp-timeline-title">' + escapeHtml(item.title) + '</span>';
      html += '        <span class="lp-timeline-meta">';
      html += '          <span class="lp-timeline-duration">' + escapeHtml(item.duration || "") + '</span>';
      if (item.score !== null && item.score !== undefined) {
        html += '          <span class="lp-timeline-score">Quiz: ' + item.score + '%</span>';
      }
      html += '        </span>';
      html += '      </div>';
      html += '      <span class="lp-timeline-status-label">' + statusLabel + '</span>';
      html += '    </a>';
      html += '  </div>';
      html += '</div>';
    }

    container.innerHTML = html;
  }

  // ==================================================
  // FLASHCARD REVIEW
  // ==================================================

  function renderRevision(courseId) {
    var container = document.getElementById("lpRevision");
    var card = document.getElementById("lpRevisionCard");
    if (!container) return;

    var summary = api.getRevisionSummary(courseId);
    if (!summary) {
      if (card) card.style.display = "none";
      return;
    }

    var html;
    if (!summary.hasActivity) {
      html =
        '<div class="lp-side-item">' +
        '  <div class="lp-side-item-info">' +
        '    <span class="lp-side-item-title">Build your memory schedule</span>' +
        '    <span class="lp-side-item-reason">Study flashcards after lessons and quizzes to remember what you learn.</span>' +
        '  </div>' +
        '  <div class="lp-side-item-action">' +
        '    <a href="flashcards.html?course=' + courseId + '" class="btn btn-sm btn-primary">Study Flashcards</a>' +
        '  </div>' +
        '</div>';
    } else if (summary.dueCount > 0) {
      var reason = summary.overdueCount > 0
        ? summary.overdueCount + " overdue. Review recommended today."
        : "These cards are due for review today.";
      html =
        '<div class="lp-side-item lp-weak-item">' +
        '  <div class="lp-side-item-info">' +
        '    <span class="lp-side-item-title">' + summary.dueCount + ' card' + (summary.dueCount === 1 ? "" : "s") + ' ready for review</span>' +
        '    <span class="lp-side-item-reason">' + reason + '</span>' +
        '  </div>' +
        '  <div class="lp-side-item-action">' +
        '    <a href="flashcards.html?course=' + courseId + '&mode=revision" class="btn btn-sm btn-primary">Start Revision</a>' +
        '  </div>' +
        '</div>';
    } else {
      html =
        '<div class="lp-side-item lp-strong-item">' +
        '  <div class="lp-side-item-info">' +
        '    <span class="lp-side-item-title">You\'re all caught up!</span>' +
        '    <span class="lp-side-item-reason">Next review: ' + (summary.nextReviewDescription || "not scheduled") + '.</span>' +
        '  </div>' +
        '  <div class="lp-side-item-action">' +
        '    <a href="flashcards.html?course=' + courseId + '" class="btn btn-sm btn-secondary">Study Flashcards</a>' +
        '  </div>' +
        '</div>';
    }

    container.innerHTML = html;
    if (card) card.style.display = "block";
  }

  // ==================================================
  // WEAK TOPICS
  // ==================================================

  function renderWeakTopics(topics) {
    var container = document.getElementById("lpWeakTopics");
    var card = document.getElementById("lpWeakCard");
    if (!container) return;

    if (!topics || topics.length === 0) {
      if (card) card.style.display = "none";
      return;
    }

    if (card) card.style.display = "block";

    var html = "";
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var href = "quiz.html?course=" + currentCourseId + "&lesson=" + t.lessonId + "&quiz=" + t.quizId;
      html += '<div class="lp-side-item lp-weak-item">';
      html += '  <div class="lp-side-item-info">';
      html += '    <span class="lp-side-item-title">' + escapeHtml(t.title) + '</span>';
      html += '    <span class="lp-side-item-reason">' + escapeHtml(t.reason) + '</span>';
      html += '  </div>';
      html += '  <div class="lp-side-item-action">';
      html += '    <span class="lp-side-item-score lp-score-low">' + t.score + '%</span>';
      html += '    <a href="' + href + '" class="btn btn-sm btn-secondary">Review</a>';
      html += '  </div>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  // ==================================================
  // STRONG TOPICS
  // ==================================================

  function renderStrongTopics(topics) {
    var container = document.getElementById("lpStrongTopics");
    var card = document.getElementById("lpStrongCard");
    if (!container) return;

    if (!topics || topics.length === 0) {
      if (card) card.style.display = "none";
      return;
    }

    if (card) card.style.display = "block";

    var html = "";
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var href = "quiz.html?course=" + currentCourseId + "&lesson=" + t.lessonId + "&quiz=" + t.quizId;
      html += '<div class="lp-side-item lp-strong-item">';
      html += '  <div class="lp-side-item-info">';
      html += '    <span class="lp-side-item-title">' + escapeHtml(t.title) + '</span>';
      html += '  </div>';
      html += '  <div class="lp-side-item-action">';
      html += '    <span class="lp-side-item-score lp-score-high">' + t.score + '%</span>';
      html += '  </div>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  // ==================================================
  // DIFFICULTY
  // ==================================================

  function renderDifficulty(mastery, stats) {
    var container = document.getElementById("lpDifficulty");
    if (!container) return;

    var diffLevel = "standard";
    if (stats.completionPct === 0 && stats.latestQuizScore === null) {
      diffLevel = "standard";
    } else if (stats.latestQuizScore !== null && stats.latestQuizScore < 50) {
      diffLevel = "foundational";
    } else if (stats.masteryLevel === "mastered" || (stats.latestQuizScore !== null && stats.latestQuizScore >= 90)) {
      diffLevel = "advanced";
    }

    var info = getDifficultyInfo(diffLevel);

    var html = '';
    html += '<div class="lp-diff-badge lp-diff-' + diffLevel + '">' + escapeHtml(info.label) + '</div>';
    html += '<p class="lp-diff-description">' + escapeHtml(info.description) + '</p>';
    html += '<p class="lp-diff-message">' + escapeHtml(info.message) + '</p>';

    container.innerHTML = html;
  }

  // ==================================================
  // HELPERS
  // ==================================================

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
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