/* ============================================
   AI-Learning System - Flashcards Module
   ============================================

   Flashcard study sessions with a simple,
   explainable spaced repetition schedule:
   - Hard   -> review again after 1 day
   - Medium -> review again after 3 days
   - Easy   -> 7, then 14, then 30 days for
               consecutive Easy ratings
   - Mastered -> after 3 consecutive Easy ratings

   This is a rule-based system, NOT a machine
   learning model.

   Data flow:
   flashcards.js -> api.js -> JSON + LocalStorage
   (Future: api.js -> Flask REST API -> MySQL)
   ============================================ */

var LearnSphereFlashcards = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var auth = LearnSphereAuth;

  var basePath = "";
  var state = {
    courseId: null,
    course: null,
    mode: null, // "revision" or null
    topic: null,
    session: [], // { card, progress }
    index: 0,
    ratings: { easy: 0, medium: 0, hard: 0 },
    nextReview: null, // earliest next review ISO from this session
    revealed: false,
  };

  // ==================================================
  // INIT
  // ==================================================

  function init() {
    basePath = detectBasePath();
    if (!requireLogin()) return;

    var params = getQueryParams();

    if (params.course) {
      var course = resolveCourse(params.course);
      if (course) {
        state.mode = params.mode === "revision" ? "revision" : null;
        state.topic = params.topic || null;
        enterCourse(course);
        return;
      }
      showError("Course not found. Choose a course below to start studying.");
    }

    if (params.mode === "revision") {
      // Revision Center "Start All" can arrive without a course id.
      // Start with the first course that has due cards.
      var suggested = suggestRevisionCourse();
      if (suggested) {
        state.mode = "revision";
        state.topic = params.topic || null;
        enterCourse(suggested);
        return;
      }
    }

    showCourseSelection();
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

  function resolveCourse(value) {
    var courses = api.getCourses() || [];
    var parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      for (var i = 0; i < courses.length; i++) {
        if (courses[i].id === parsed) return courses[i];
      }
    }
    for (var j = 0; j < courses.length; j++) {
      if (courses[j].slug === value) return courses[j];
    }
    return null;
  }

  function suggestRevisionCourse() {
    var courses = api.getCourses() || [];
    for (var i = 0; i < courses.length; i++) {
      if (api.getDueFlashcards(courses[i].id).length > 0) return courses[i];
    }
    return null;
  }

  // ==================================================
  // COURSE ENTRY + SESSION BUILD
  // ==================================================

  function enterCourse(course) {
    state.courseId = course.id;
    state.course = course;

    document.getElementById("fcCourseSection").style.display = "none";
    document.getElementById("fcError").style.display = "none";
    document.getElementById("fcComplete").style.display = "none";
    document.getElementById("fcEmpty").style.display = "none";

    buildCourseSelect(course.id);
    setSessionSubtitle(course);
    setupToolbarMode();

    buildSession();

    if (state.session.length === 0) {
      showNoCards();
    } else {
      document.getElementById("fcSessionSection").style.display = "block";
      showCard();
    }
  }

  function buildCourseSelect(selectedId) {
    var select = document.getElementById("fcCourseSelect");
    if (!select) return;
    var courses = api.getCourses() || [];
    var html = "";
    for (var i = 0; i < courses.length; i++) {
      html += '<option value="' + courses[i].id + '">' + escapeHtml(courses[i].title) + '</option>';
    }
    select.innerHTML = html;
    select.value = String(selectedId);

    select.addEventListener("change", function () {
      var url = "flashcards.html?course=" + parseInt(this.value, 10);
      if (state.mode === "revision") url += "&mode=revision";
      window.location.href = url;
    });
  }

  function setSessionSubtitle(course) {
    var subtitle = document.getElementById("fcSubtitle");
    if (!subtitle) return;
    subtitle.textContent =
      (state.mode === "revision" ? "Revision session for " : "Study flashcards for ") +
      course.title;
  }

  function setupToolbarMode() {
    var badge = document.getElementById("fcModeBadge");
    if (badge) {
      if (state.mode === "revision") {
        badge.style.display = "inline-flex";
        badge.textContent = "Revision Mode";
      } else {
        badge.style.display = "none";
      }
    }
  }

  function buildSession() {
    var courseId = state.courseId;
    var progress = api.getFlashcardProgress(courseId).map || {};
    var due = api.getDueFlashcards(courseId);
    var session = [];

    if (state.mode === "revision") {
      for (var i = 0; i < due.length; i++) {
        session.push(due[i]);
      }
      if (state.topic) {
        session = session.filter(function (item) {
          return item.card.topic === state.topic;
        });
      }
    } else {
      var cards = api.getFlashcards(courseId) || [];
      var dueIds = {};
      for (var d = 0; d < due.length; d++) {
        dueIds[due[d].card.card_id] = true;
      }
      for (var c = 0; c < cards.length; c++) {
        var record = progress[cards[c].card_id];
        if (record && record.mastered) continue;
        session.push({ card: cards[c], progress: record || null });
      }
      session.sort(function (a, b) {
        var aDue = !!dueIds[a.card.card_id];
        var bDue = !!dueIds[b.card.card_id];
        if (aDue !== bDue) return aDue ? -1 : 1;
        var aNew = !a.progress;
        var bNew = !b.progress;
        if (aNew !== bNew) return aNew ? -1 : 1;
        var an = a.progress ? Date.parse(a.progress.next_review) : Infinity;
        var bn = b.progress ? Date.parse(b.progress.next_review) : Infinity;
        return an - bn;
      });
    }

    state.session = session;
    state.index = 0;
    state.ratings = { easy: 0, medium: 0, hard: 0 };
    state.nextReview = null;
    state.revealed = false;
  }

  // ==================================================
  // CARD RENDERING
  // ==================================================

  function showCard() {
    var item = state.session[state.index];
    transparentRating("none");

    state.revealed = false;
    document.getElementById("fcAnswerPanel").style.display = "none";
    document.getElementById("fcMasteredNote").style.display = "none";
    document.getElementById("fcEmpty").style.display = "none";
    document.getElementById("fcComplete").style.display = "none";

    var card = item.card;
    setText("fcTopicBadge", card.topic);
    setText("fcCourseBadge", state.course ? state.course.title : "");
    setText("fcQuestion", card.question);
    setText("fcAnswerText", card.answer);
    setText("fcExplanationText", card.explanation);

    var showBtn = document.getElementById("fcShowAnswerBtn");
    if (showBtn) {
      showBtn.style.display = "inline-flex";
      showBtn.focus();
    }

    updateProgress();
  }

  function revealAnswer() {
    if (state.revealed) return;
    state.revealed = true;

    var showBtn = document.getElementById("fcShowAnswerBtn");
    if (showBtn) showBtn.style.display = "none";
    document.getElementById("fcAnswerPanel").style.display = "block";
    transparentRating("block");

    var ratingRow = document.getElementById("fcRatingRow");
    if (ratingRow) {
      var buttons = ratingRow.querySelectorAll("button");
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].focus();
        break;
      }
    }
  }

  function transparentRating(display) {
    var panel = document.getElementById("fcAnswerPanel");
    if (!panel) return;
    var rating = panel.querySelector(".fc-rating");
    if (rating) {
      // "none" hides ratings while the answer is hidden,
      // "block" shows them once the answer is revealed.
      rating.style.display = display === "block" ? "block" : "none";
    }
  }

  function rate(ratingValue) {
    if (!state.revealed) return;

    var item = state.session[state.index];
    var result = api.saveFlashcardReview({
      card_id: item.card.card_id,
      course_id: state.courseId,
      rating: ratingValue,
    });

    if (result && result.success) {
      state.ratings[ratingValue] = (state.ratings[ratingValue] || 0) + 1;
      var reviewTime = result.record.next_review;
      if (!state.nextReview || Date.parse(reviewTime) < Date.parse(state.nextReview)) {
        state.nextReview = reviewTime;
      }

      var note = document.getElementById("fcMasteredNote");
      if (note) note.style.display = result.masteredNow ? "block" : "none";

      state.index++;

      if (state.index >= state.session.length) {
        showCompletion();
      } else {
        showCard();
      }
    }
  }

  function updateProgress() {
    var total = state.session.length;
    var done = state.index;
    var label = "Card " + (Math.min(done, total) + (done < total ? 1 : 0)) + " of " + total;
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;

    setText("fcProgressText", label);
    setText("fcProgressPct", pct + "%");

    var fill = document.getElementById("fcProgressFill");
    if (fill) fill.style.width = pct + "%";
    var bar = document.getElementById("fcProgressBar");
    if (bar) bar.setAttribute("aria-valuenow", String(pct));
  }

  // ==================================================
  // COMPLETION / NO CARDS
  // ==================================================

  function showCompletion() {
    transparentRating("none");
    document.getElementById("fcSessionSection").style.display = "none";
    document.getElementById("fcEmpty").style.display = "none";

    setText("fcCompEasy", String(state.ratings.easy || 0));
    setText("fcCompMedium", String(state.ratings.medium || 0));
    setText("fcCompHard", String(state.ratings.hard || 0));

    var nextDesc = state.nextReview ? api.describeNextReview(state.nextReview) : "Not scheduled";
    setText("fcCompleteNextReview", "Next review: " + nextDesc + ".");

    document.getElementById("fcComplete").style.display = "block";

    var contBtn = document.getElementById("fcCompContinueBtn");
    if (contBtn) {
      contBtn.href = "course-details.html?id=" + state.courseId;
    }
  }

  function showNoCards() {
    document.getElementById("fcSessionSection").style.display = "none";
    document.getElementById("fcComplete").style.display = "none";

    var summary = api.getRevisionSummary(state.courseId);
    var noActivity = summary && summary.reviewedCount === 0;

    var icon = document.getElementById("fcEmptyIcon");
    var title = document.getElementById("fcEmptyTitle");
    var text = document.getElementById("fcEmptyText");
    var nextReview = document.getElementById("fcEmptyNextReview");
    var studyBtn = document.getElementById("fcEmptyStudyBtn");

    if (noActivity) {
      if (icon) icon.innerHTML = "&#128218;";
      if (title) title.textContent = "Start reviewing to build your memory schedule.";
      if (text) text.textContent = "Study the flashcards in this course, then rate how well you remembered each answer.";
      if (nextReview) nextReview.textContent = "";
    } else {
      if (icon) icon.innerHTML = "&#127881;";
      if (title) title.textContent = "You're all caught up!";
      if (text) text.textContent =
        state.mode === "revision"
          ? "There are no cards due for review in this course right now."
          : "There are no new cards left to study in this course.";
      if (nextReview) {
        var desc = summary && summary.nextReview
          ? api.describeNextReview(summary.nextReview)
          : "Not scheduled";
        nextReview.textContent = summary && summary.reviewedCount > 0
          ? "Next review: " + desc + "."
          : "";
      }
    }

    if (studyBtn) {
      studyBtn.textContent = noActivity ? "Study New Cards" : "Study New Cards";
      studyBtn.href = "flashcards.html?course=" + state.courseId;
    }

    document.getElementById("fcEmpty").style.display = "block";

    var revBtn = document.getElementById("fcEmptyRevisionBtn");
    if (revBtn) revBtn.href = "revision.html?course=" + state.courseId;
  }

  // ==================================================
  // COURSE SELECTION GRID
  // ==================================================

  function showCourseSelection() {
    document.getElementById("fcError").style.display = "none";
    document.getElementById("fcSessionSection").style.display = "none";
    document.getElementById("fcEmpty").style.display = "none";
    document.getElementById("fcComplete").style.display = "none";

    var container = document.getElementById("fcCourseGrid");
    if (!container) return;

    var courses = api.getCourses() || [];
    var html = "";

    for (var i = 0; i < courses.length; i++) {
      var course = courses[i];
      var flashcards = api.getFlashcards(course.id) || [];
      var progress = api.getFlashcardProgress(course.id);
      var dueCount = progress.dueCount;

      html += '<div class="fc-course-card">';
      html += '  <div class="fc-course-card-top">';
      html += '    <span class="fc-course-icon">' + getCourseIcon(course) + '</span>';
      html += '    <span class="fc-course-level">' + escapeHtml(course.level) + '</span>';
      html += '  </div>';
      html += '  <h3 class="fc-course-card-title">' + escapeHtml(course.title) + '</h3>';
      html += '  <div class="fc-course-card-meta">';
      html += '    <span>' + flashcards.length + ' flashcards</span>';
      html += '    <span class="fc-due-count">Due today: ' + dueCount + '</span>';
      html += '  </div>';
      html += '  <div class="fc-course-card-actions">';
      html += '    <a href="flashcards.html?course=' + course.id + '" class="btn btn-primary btn-sm">Study</a>';
      if (dueCount > 0) {
        html += '    <a href="flashcards.html?course=' + course.id + '&mode=revision" class="btn btn-secondary btn-sm">Review</a>';
      }
      html += '  </div>';
      html += '</div>';
    }

    container.innerHTML = html;
    document.getElementById("fcCourseSection").style.display = "block";
  }

  function getCourseIcon(course) {
    var map = {
      "dsa": "&#128218;",
      "python": "&#128013;",
      "webdev": "&#127760;",
      "dbms": "&#128451;",
      "ai": "&#129302;",
      "excel": "&#128202;",
      "testing": "&#9989;",
      "java": "&#9749;",
      "cyber": "&#128274;"
    };
    return map[course.thumbnail] || "&#128218;";
  }

  // ==================================================
  // KEYBOARD SUPPORT
  // ==================================================

  function setupKeyboard() {
    document.addEventListener("keydown", function (e) {
      if (document.getElementById("fcSessionSection").style.display === "none") {
        return;
      }
      var tag = (e.target && e.target.tagName) ? e.target.tagName : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (!state.revealed) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          revealAnswer();
        }
        return;
      }

      if (e.key === "1") rate("hard");
      else if (e.key === "2") rate("medium");
      else if (e.key === "3") rate("easy");
    });
  }

  // ==================================================
  // EVENT BINDING
  // ==================================================

  function setupEventHandlers() {
    var showBtn = document.getElementById("fcShowAnswerBtn");
    if (showBtn) {
      showBtn.addEventListener("click", revealAnswer);
    }

    var ratingRow = document.getElementById("fcRatingRow");
    if (ratingRow) {
      ratingRow.addEventListener("click", function (e) {
        var btn = e.target.closest ? e.target.closest("[data-rating]") : null;
        if (btn && btn.getAttribute("data-rating")) {
          rate(btn.getAttribute("data-rating"));
        }
      });
    }
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
  // DOM READY
  // ==================================================

  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", setupListeners);
    } else {
      setupListeners();
    }
  }

  function setupListeners() {
    setupEventHandlers();
    setupKeyboard();
  }

  function showError(message) {
    var err = document.getElementById("fcError");
    if (!err) return;
    err.style.display = "block";
    err.innerHTML =
      '<div class="fc-state-icon">&#9888;</div>' +
      "<h2>Unable to Load Flashcards</h2>" +
      "<p>" + escapeHtml(message || "Flashcards could not be loaded. Please try again later.") + "</p>" +
      '<div class="fc-state-actions">' +
      '  <a href="courses.html" class="btn btn-primary">Browse Courses</a>' +
      '  <a href="revision.html" class="btn btn-secondary">Revision Center</a>' +
      "</div>";
    document.getElementById("fcCourseSection").style.display = "none";
    document.getElementById("fcSessionSection").style.display = "none";
  }

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: function () {
      boot();
      init();
    },
    showError: showError,
  };
})();