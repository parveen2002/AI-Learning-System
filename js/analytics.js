/* ============================================
   AI-Learning System - Student Analytics Module
   ============================================
   Renders the Learning Analytics dashboard from
   rule-based analytics computed by api.js from
   real JSON data + LocalStorage (lesson progress,
   quiz results, flashcard progress, activity).

   This module does NOT use any machine learning.
   ============================================ */

var LearnSphereAnalytics = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var basePath = "";

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

    var data = api.getAnalytics();
    if (!data) {
      showFatal();
      return;
    }

    renderKpis(data.kpis);
    renderOverall(data.overall);
    renderCourses(data.courses);
    renderQuiz(data.quiz);
    renderTopics(data.topics);
    renderStrengths(data.topics);
    renderWeak(data.topics);
    renderStreak(data.streak);
    renderRevision(data.revision);
    renderImprovement(data.improvement);
    renderInsight(data.insight);
    renderActivity(data.activity);
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

  function showFatal() {
    var main = document.querySelector(".analytics-main");
    if (main) {
      main.innerHTML =
        '<div class="an-fatal">' +
        '  <div class="an-fatal-icon">&#9888;</div>' +
        '  <h3>Unable to load analytics</h3>' +
        '  <p>Please try again later.</p>' +
        '  <a href="' + basePath + '/pages/dashboard.html" class="btn btn-primary btn-sm">Back to Dashboard</a>' +
        '</div>';
    }
  }

  function emptyState(icon, title, text, btnLabel, btnUrl) {
    if (btnLabel && btnUrl) {
      return '' +
        '<div class="an-empty">' +
        '  <div class="an-empty-icon" aria-hidden="true">' + icon + '</div>' +
        '  <h3 class="an-empty-title">' + title + '</h3>' +
        '  <p class="an-empty-text">' + text + '</p>' +
        '  <a href="' + btnUrl + '" class="btn btn-primary btn-sm">' + btnLabel + '</a>' +
        '</div>';
    }
    return '' +
      '<div class="an-empty">' +
      '  <div class="an-empty-icon" aria-hidden="true">' + icon + '</div>' +
      '  <h3 class="an-empty-title">' + title + '</h3>' +
      '  <p class="an-empty-text">' + text + '</p>' +
      '</div>';
  }

  function statTile(value, label) {
    return '' +
      '<div class="an-stat-tile">' +
      '  <div class="an-stat-value">' + value + '</div>' +
      '  <div class="an-stat-label">' + label + '</div>' +
      '</div>';
  }

  function getThumbColor(key) {
    var map = {
      dsa: "linear-gradient(135deg,#2563EB,#0891B2)",
      python: "linear-gradient(135deg,#059669,#06B6D4)",
      webdev: "linear-gradient(135deg,#2563EB,#7C3AED)",
      dbms: "linear-gradient(135deg,#D97706,#EA580C)",
      ai: "linear-gradient(135deg,#7C3AED,#2563EB)",
      excel: "linear-gradient(135deg,#059669,#10B981)",
      testing: "linear-gradient(135deg,#DC2626,#F59E0B)",
      java: "linear-gradient(135deg,#DC2626,#2563EB)",
      cyber: "linear-gradient(135deg,#0F766E,#06B6D4)"
    };
    return map[key] || "linear-gradient(135deg,#2563EB,#06B6D4)";
  }

  function getThumbIcon(key) {
    var map = {
      dsa: "&#128218;",
      python: "&#128013;",
      webdev: "&#127760;",
      dbms: "&#128451;",
      ai: "&#129302;",
      excel: "&#128202;",
      testing: "&#9989;",
      java: "&#9749;",
      cyber: "&#128272;"
    };
    return map[key] || "&#128218;";
  }

  var KPI_ICONS = {
    overall: "&#128200;",
    coursesEnrolled: "&#128218;",
    coursesCompleted: "&#127941;",
    lessons: "&#10004;",
    quizAvg: "&#127919;",
    streak: "&#128293;",
    flashcards: "&#127183;",
    topicsMastered: "&#11088;"
  };

  // ==================================================
  // KPI SUMMARY CARDS
  // ==================================================

  function renderKpis(kpis) {
    var container = el("analyticsKpis");
    if (!container) return;

    var html = "";
    for (var i = 0; i < kpis.length; i++) {
      var k = kpis[i];
      var hasBar = (k.progress !== null && k.progress !== undefined && k.progress !== false);
      html += '<section class="an-kpi-card">';
      html += '  <div class="an-kpi-icon" aria-hidden="true">' + (KPI_ICONS[k.id] || "&#10004;") + '</div>';
      html += '  <div class="an-kpi-content">';
      html += '    <h3 class="an-kpi-title">' + k.title + '</h3>';
      html += '    <div class="an-kpi-value">' + k.value + '</div>';
      html += '    <p class="an-kpi-support">' + k.supporting + '</p>';
      if (hasBar) {
        html += '    <div class="an-kpi-track" role="progressbar" aria-valuenow="' + k.progress +
          '" aria-valuemin="0" aria-valuemax="100" aria-label="' + k.title + ' progress">' +
          '      <span style="width:' + k.progress + '%"></span>' +
          '    </div>';
      }
      html += '  </div>';
      html += '</section>';
    }
    container.innerHTML = html;
  }

  // ==================================================
  // OVERALL LEARNING PROGRESS
  // ==================================================

  function renderOverall(overall) {
    var container = el("analyticsOverall");
    if (!container) return;

    if (!overall || overall.coursesEnrolled === 0) {
      container.innerHTML = emptyState(
        "&#128218;",
        "No courses yet",
        "Start a course to begin tracking your overall learning progress.",
        "Explore Courses",
        basePath + "/pages/courses.html"
      );
      return;
    }

    var pct = Math.max(0, Math.min(100, overall.percent));
    var circ = 2 * Math.PI * 52;
    var offset = circ - (circ * pct) / 100;

    var html = '';
    html += '<div class="an-overall">';
    html += '  <div class="an-ring-wrap">';
    html += '    <svg class="an-ring" viewBox="0 0 120 120" role="img" aria-label="Overall learning progress ' + pct + ' percent">';
    html += '      <circle class="an-ring-track" cx="60" cy="60" r="52"></circle>';
    html += '      <circle class="an-ring-value" cx="60" cy="60" r="52" stroke-dasharray="' + circ.toFixed(2) +
      '" stroke-dashoffset="' + offset.toFixed(2) + '"></circle>';
    html += '      <text x="60" y="63" text-anchor="middle" class="an-ring-text">' + pct + '%</text>';
    html += '    </svg>';
    html += '  </div>';
    html += '  <div class="an-overall-stats">';
    html += statTile(overall.lessonsDone + " / " + overall.lessonsTotal, "Lessons completed");
    html += statTile(overall.coursesCompleted + " / " + overall.coursesEnrolled, "Courses completed");
    html += '  </div>';
    html += '</div>';
    container.innerHTML = html;
  }

  // ==================================================
  // COURSE PROGRESS
  // ==================================================

  var COURSE_STATUS_LABEL = {
    not_started: "Not Started",
    in_progress: "In Progress",
    almost_complete: "Almost Complete",
    completed: "Completed"
  };

  var COURSE_STATUS_CLASS = {
    not_started: "an-status-none",
    in_progress: "an-status-wip",
    almost_complete: "an-status-soon",
    completed: "an-status-done"
  };

  function renderCourses(rows) {
    var container = el("analyticsCourses");
    if (!container) return;

    if (!rows || rows.length === 0) {
      container.innerHTML = emptyState(
        "&#128218;",
        "No enrolled courses",
        "Start a course to see your course-wise progress here.",
        "Explore Courses",
        basePath + "/pages/courses.html"
      );
      return;
    }

    var html = '<ul class="an-course-list">';
    for (var i = 0; i < rows.length; i++) {
      var c = rows[i];
      var cls = COURSE_STATUS_CLASS[c.status] || "an-status-none";
      var label = COURSE_STATUS_LABEL[c.status] || "Not Started";
      html += '<li class="an-course-item">';
      html += '  <div class="an-course-thumb" style="background:' + getThumbColor(c.thumbnail) + ';">';
      html += '    <span class="an-course-thumb-icon" aria-hidden="true">' + getThumbIcon(c.thumbnail) + '</span>';
      html += '  </div>';
      html += '  <div class="an-course-main">';
      html += '    <div class="an-course-top">';
      html += '      <h3 class="an-course-name">' + c.title + '</h3>';
      html += '      <span class="an-course-status ' + cls + '">' + label + '</span>';
      html += '    </div>';
      html += '    <p class="an-course-meta">' + c.category + (c.difficulty ? ' &middot; ' + c.difficulty : '') + '</p>';
      html += '    <div class="an-bar-track" role="progressbar" aria-valuenow="' + c.progressPercentage +
        '" aria-valuemin="0" aria-valuemax="100" aria-label="' + c.title + ' progress">' +
        '      <span style="width:' + c.progressPercentage + '%"></span>' +
        '    </div>';
      html += '    <p class="an-course-count">' + c.completedCount + ' of ' + c.totalCount +
        ' lessons completed &middot; ' + c.progressPercentage + '%</p>';
      html += '  </div>';
      html += '</li>';
    }
    html += '</ul>';
    container.innerHTML = html;
  }

  // ==================================================
  // QUIZ PERFORMANCE
  // ==================================================

  function renderQuiz(quiz) {
    var container = el("analyticsQuiz");
    if (!container) return;

    if (!quiz || !quiz.hasData) {
      container.innerHTML = emptyState(
        "&#128221;",
        "No quiz data available yet.",
        "Complete a quiz to start tracking your performance.",
        "Explore Courses",
        basePath + "/pages/courses.html"
      );
      return;
    }

    var html = '';
    html += '<div class="an-quiz-stats">';
    html += statTile(quiz.average + "%", "Average score");
    html += statTile(quiz.best + "%", "Best score");
    html += statTile(String(quiz.attempts), "Quizzes attempted");
    html += statTile(quiz.passed + " / " + quiz.failed, "Passed / failed");
    html += '</div>';

    if (quiz.trend && quiz.trend.length > 0) {
      html += '<div class="an-chart-wrap">';
      html += '<h3 class="an-chart-title">Score trend</h3>';
      html += buildQuizChart(quiz.trend);
      html += '</div>';
    }

    if (quiz.recent && quiz.recent.length > 0) {
      html += '<h3 class="an-chart-title">Recent results</h3>';
      html += '<ul class="an-recent-quiz">';
      for (var i = 0; i < quiz.recent.length; i++) {
        var r = quiz.recent[i];
        html += '<li class="an-recent-quiz-item">';
        html += '  <span class="an-recent-dot ' + (r.passed ? "passed" : "failed") + '" aria-hidden="true"></span>';
        html += '  <div class="an-recent-body">';
        html += '    <span class="an-recent-title">' + r.title + '</span>';
        html += '    <span class="an-recent-meta">' + r.score + '% &middot; ' + fmtDate(r.completedAt) + '</span>';
        html += '  </div>';
        html += '</li>';
      }
      html += '</ul>';
    }

    container.innerHTML = html;
  }

  function buildQuizChart(points) {
    var W = 360;
    var H = 150;
    var padL = 30;
    var padR = 10;
    var padT = 12;
    var padB = 22;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var n = points.length;
    var slice = points;
    if (n > 12) {
      slice = points.slice(n - 12);
      n = slice.length;
    }

    function xAt(i) {
      return n === 1 ? padL + innerW / 2 : padL + (i / (n - 1)) * innerW;
    }
    function yAt(score) {
      return padT + innerH - (Math.max(0, Math.min(100, score)) / 100) * innerH;
    }

    var svg = '';
    svg += '<svg class="an-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Quiz score trend chart">';
    svg += '  <desc>Line chart of quiz scores over recent attempts, 0 to 100 percent.</desc>';

    var gridValues = [0, 25, 50, 75, 100];
    for (var g = 0; g < gridValues.length; g++) {
      var y = yAt(gridValues[g]).toFixed(1);
      svg += '  <line class="an-chart-grid" x1="' + padL + '" y1="' + y + '" x2="' + (padL + innerW) + '" y2="' + y + '"></line>';
      svg += '  <text class="an-chart-ylabel" x="' + (padL - 6) + '" y="' + (parseFloat(y) + 3) + '">' + gridValues[g] + '</text>';
    }

    if (n > 1) {
      var pts = '';
      for (var p = 0; p < n; p++) {
        var x = xAt(p).toFixed(1);
        var yp = yAt(slice[p].score).toFixed(1);
        pts += (p === 0 ? "" : " ") + x + "," + yp;
      }
      svg += '  <polyline class="an-chart-line" points="' + pts + '"></polyline>';
    }

    for (var d = 0; d < n; d++) {
      var cx = xAt(d).toFixed(1);
      var cy = yAt(slice[d].score).toFixed(1);
      svg += '  <circle class="an-chart-dot ' + (slice[d].passed ? "passed" : "failed") +
        '" cx="' + cx + '" cy="' + cy + '" r="3.5"></circle>';
      svg += '  <text class="an-chart-xlabel" x="' + cx + '" y="' + (H - 6) + '">' + (d + 1) + '</text>';
    }

    svg += '</svg>';
    return svg;
  }

  // ==================================================
  // TOPIC MASTERY
  // ==================================================

  var LEVEL_LABEL = {
    mastered: "Mastered",
    proficient: "Proficient",
    developing: "Developing",
    needs_improvement: "Needs Improvement"
  };

  var LEVEL_CLASS = {
    mastered: "an-level-mastered",
    proficient: "an-level-proficient",
    developing: "an-level-developing",
    needs_improvement: "an-level-needs"
  };

  function renderTopics(topics) {
    var container = el("analyticsTopics");
    if (!container) return;

    if (!topics || topics.length === 0) {
      container.innerHTML = emptyState(
        "&#127919;",
        "No topic mastery data yet.",
        "Complete quizzes in your courses to build your topic mastery map.",
        "Explore Courses",
        basePath + "/pages/courses.html"
      );
      return;
    }

    var html = '<ul class="an-topic-list">';
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var levelCls = LEVEL_CLASS[t.level] || "an-level-needs";
      var levelLbl = LEVEL_LABEL[t.level] || "Needs Improvement";
      var meta = [];
      if (t.courseTitle) meta.push(t.courseTitle);
      if (t.attempts) meta.push(t.attempts + " attempt" + (t.attempts === 1 ? "" : "s"));
      html += '<li class="an-topic-item">';
      html += '  <div class="an-topic-top">';
      html += '    <span class="an-topic-name">' + t.topic + '</span>';
      html += '    <span class="an-topic-level ' + levelCls + '">' + levelLbl + '</span>';
      html += '  </div>';
      html += '  <p class="an-topic-meta">' + meta.join(" &middot; ") + '</p>';
      html += '  <div class="an-bar-track" role="progressbar" aria-valuenow="' + t.percent +
        '" aria-valuemin="0" aria-valuemax="100" aria-label="' + t.topic + ' mastery">' +
        '    <span style="width:' + t.percent + '%"></span>' +
        '  </div>';
      html += '  <p class="an-topic-pct">' + t.percent + '% mastery</p>';
      html += '</li>';
    }
    html += '</ul>';
    container.innerHTML = html;
  }

  function renderStrengths(topics) {
    var container = el("analyticsStrong");
    if (!container) return;

    if (!topics || topics.length < 2) {
      container.innerHTML = emptyState(
        "&#129300;",
        "Not enough data",
        "Complete more lessons and quizzes to identify your strongest and weakest areas."
      );
      return;
    }

    var strong = topics.slice(0, 3);
    container.innerHTML = renderRankedList(strong, true);
  }

  function renderWeak(topics) {
    var container = el("analyticsWeak");
    if (!container) return;

    if (!topics || topics.length < 2) {
      container.innerHTML = emptyState(
        "&#128200;",
        "Not enough data",
        "Complete more lessons and quizzes to identify your strongest and weakest areas."
      );
      return;
    }

    var weak = topics.slice(-3).reverse();
    container.innerHTML = renderRankedList(weak, false);
  }

  function renderRankedList(topics, isStrength) {
    var html = '<ul class="an-ranked-list">';
    for (var i = 0; i < topics.length; i++) {
      var t = topics[i];
      var levelLbl = LEVEL_LABEL[t.level] || "Needs Improvement";
      html += '<li class="an-ranked-item">';
      html += '  <span class="an-ranked-rank">' + (i + 1) + '</span>';
      html += '  <div class="an-ranked-body">';
      html += '    <span class="an-ranked-word">' + (isStrength ? "Strong" : "Needs practice") + '</span>';
      html += '    <span class="an-ranked-title">' + t.topic + '</span>';
      html += '    <span class="an-ranked-meta">' + t.percent + '% &middot; ' + levelLbl + '</span>';
      html += '  </div>';
      html += '</li>';
    }
    html += '</ul>';
    return html;
  }

  // ==================================================
  // LEARNING STREAK
  // ==================================================

  function renderStreak(streak) {
    var container = el("analyticsStreak");
    if (!container) return;

    if (!streak || !streak.hasData) {
      container.innerHTML = emptyState(
        "&#128293;",
        "Start learning today",
        "Complete a lesson, quiz or flashcard review to build your learning streak.",
        "Explore Courses",
        basePath + "/pages/courses.html"
      );
      return;
    }

    var html = '';
    html += '<div class="an-streak-stats">';
    html += statTile(streak.current + " days", "Current streak");
    html += statTile(streak.longest + " days", "Longest streak");
    html += statTile(String(streak.learningDays), "Learning days");
    html += '</div>';

    html += '<p class="an-streak-label">Last 7 days</p>';
    html += '<div class="an-week" role="img" aria-label="Learning activity for the last 7 days">';
    for (var i = 0; i < streak.week.length; i++) {
      var w = streak.week[i];
      var cls = "an-week-day";
      if (w.active) cls += " active";
      if (w.isToday) cls += " today";
      html += '<span class="' + cls + '" title="' + (w.active ? "Active" : "No activity") + '">' + w.label + '</span>';
    }
    html += '</div>';

    container.innerHTML = html;
  }

  // ==================================================
  // REVISION STATISTICS
  // ==================================================

  function renderRevision(rev) {
    var container = el("analyticsRevision");
    if (!container) return;

    if (!rev || !rev.hasData) {
      container.innerHTML = emptyState(
        "&#127183;",
        "No revision data available yet.",
        "Study flashcards and review cards on schedule to build your revision statistics.",
        "Study Flashcards",
        basePath + "/pages/flashcards.html"
      );
      return;
    }

    var html = '';
    html += '<div class="an-rev-stats">';
    html += statTile(String(rev.reviewed), "Cards reviewed");
    html += statTile(String(rev.due), rev.overdue > 0 ? "Due (incl. " + rev.overdue + " overdue)" : "Due for revision");
    html += statTile(String(rev.mastered), "Cards mastered");
    html += statTile(String(rev.newCards), "New cards");
    html += '</div>';

    html += '<p class="an-streak-label">Difficulty mix</p>';
    html += '<div class="an-rev-difficulty">';
    html += '  <span class="an-chip an-chip-easy">Easy: ' + rev.easy + '</span>';
    html += '  <span class="an-chip an-chip-medium">Medium: ' + rev.medium + '</span>';
    html += '  <span class="an-chip an-chip-hard">Hard: ' + rev.hard + '</span>';
    html += '</div>';

    var totalPriority = rev.priority.high + rev.priority.medium + rev.priority.low;
    html += '<p class="an-streak-label">Priority breakdown</p>';
    html += '<ul class="an-priority-list">';
    html += priorityRow("High", "var(--error)", rev.priority.high, totalPriority);
    html += priorityRow("Medium", "var(--primary)", rev.priority.medium, totalPriority);
    html += priorityRow("Low", "var(--text-secondary)", rev.priority.low, totalPriority);
    html += '</ul>';

    container.innerHTML = html;
  }

  function priorityRow(label, color, count, total) {
    var pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return '' +
      '<li class="an-priority-item">' +
      '  <span class="an-priority-label">' + label + '</span>' +
      '  <div class="an-priority-track">' +
      '    <span style="width:' + pct + '%;background:' + color + ';"></span>' +
      '  </div>' +
      '  <span class="an-priority-count">' + count + '</span>' +
      '</li>';
  }

  // ==================================================
  // LEARNING IMPROVEMENT
  // ==================================================

  function renderImprovement(imp) {
    var container = el("analyticsImprovement");
    if (!container) return;

    if (!imp || !imp.hasComparison || !imp.quiz) {
      container.innerHTML =
        '<div class="an-insight-note">' +
        '  <h3 class="an-insight-note-title">No comparison yet</h3>' +
        '  <p>' + (imp && imp.note ? imp.note : "Complete at least two quizzes to see how your performance changes over time.") + '</p>' +
        '</div>';
      return;
    }

    var q = imp.quiz;
    var label = "Stable";
    var cls = "an-imp-stable";
    if (q.status === "improving") {
      label = "Improving";
      cls = "an-imp-improving";
    } else if (q.status === "needs_attention") {
      label = "Needs Attention";
      cls = "an-imp-attention";
    }

    var html = '';
    html += '<div class="an-imp-row">';
    html += '  <div class="an-imp-label">Quiz average</div>';
    html += '  <div class="an-imp-compare">' + q.previous + '% &rarr; ' + q.current + '%</div>';
    html += '  <span class="an-imp-badge ' + cls + '">' + label + '</span>';
    html += '</div>';
    html += '<p class="an-imp-note">Compared across ' + q.sampleSize + ' quiz attempts. Course and revision trends appear once enough data is available.</p>';
    container.innerHTML = html;
  }

  // ==================================================
  // LEARNING INSIGHT
  // ==================================================

  function renderInsight(insights) {
    var container = el("analyticsInsight");
    if (!container) return;

    if (!insights || insights.length === 0) {
      container.innerHTML =
        '<div class="an-insight-note">' +
        '  <p>Start a course, complete lessons and quizzes to receive personalized learning insights.</p>' +
        '</div>';
      return;
    }

    var html = '<ul class="an-insight-list">';
    for (var i = 0; i < insights.length; i++) {
      html += '<li class="an-insight-item">';
      html += '  <span class="an-insight-icon" aria-hidden="true">&#128161;</span>';
      html += '  <p>' + insights[i] + '</p>';
      html += '</li>';
    }
    html += '</ul>';
    container.innerHTML = html;
  }

  // ==================================================
  // RECENT LEARNING ACTIVITY
  // ==================================================

  var ACTIVITY_ICONS = {
    lesson: "&#10004;",
    quiz: "&#11088;",
    course_start: "&#9654;",
    course_complete: "&#127941;",
    revision: "&#128260;",
    default: "&#10004;"
  };

  function renderActivity(items) {
    var container = el("analyticsActivity");
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = emptyState(
        "&#128337;",
        "No learning activity yet.",
        "Start a course or complete a lesson to see your recent activity here.",
        "Explore Courses",
        basePath + "/pages/courses.html"
      );
      return;
    }

    var html = '<ul class="an-activity-list">';
    for (var i = 0; i < items.length; i++) {
      var a = items[i];
      var icon = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.default;
      var meta = [];
      if (a.meta) meta.push(a.meta);
      if (a.detail) meta.push(a.detail);
      html += '<li class="an-activity-item">';
      html += '  <span class="an-activity-icon" aria-hidden="true">' + icon + '</span>';
      html += '  <div class="an-activity-body">';
      html += '    <span class="an-activity-title">' + a.title + '</span>';
      html += '    <span class="an-activity-meta">' + meta.join(" &middot; ") + '</span>';
      html += '  </div>';
      html += '  <span class="an-activity-time">' + relativeTime(a.timestamp) + '</span>';
      html += '</li>';
    }
    html += '</ul>';
    container.innerHTML = html;
  }

  function relativeTime(iso) {
    var then = Date.parse(iso);
    if (isNaN(then)) return "";
    var diff = Date.now() - then;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min" + (mins === 1 ? "" : "s") + " ago";
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + " hour" + (hrs === 1 ? "" : "s") + " ago";
    var days = Math.floor(hrs / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";
    return fmtDate(iso);
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  // ==================================================
  // PUBLIC
  // ==================================================

  return {
    init: init
  };
})();