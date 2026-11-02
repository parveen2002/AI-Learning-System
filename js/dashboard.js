/* ============================================
   AI-Learning System - Dashboard Module
   ============================================
   Handles the student dashboard: overview,
   continue learning, daily goal, streak,
   recommendations, activity, and quick actions.
   ============================================ */

var LearnSphereDashboard = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var basePath = "";

  // ==================================================
  // INIT
  // ==================================================

  function init(dashboardJson) {
    api.initDashboardData(dashboardJson);
    basePath = detectBasePath();

    var student = api.getCurrentStudent();
    if (!student) {
      window.location.href = basePath + "/pages/login.html";
      return;
    }

    renderWelcome(student);
    renderOverview();
    renderContinueLearning();
    renderMyLearning();
    renderDailyGoal();
    renderLearningStreak();
    renderRecommendedNextStep();
    renderRevision();
    renderRecentActivity();
    renderQuickActions();
    renderLeaderboard();
    renderPlanner();
    renderBookmarks();
  }

  // ==================================================
  // BASE PATH HELPER
  // ==================================================

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/LearnSphere-AI/pages/") !== -1) return "..";
    if (path.indexOf("/pages/") !== -1) return "..";
    if (path.indexOf("/LearnSphere-AI/") !== -1) return ".";
    return ".";
  }

  // ==================================================
  // WELCOME
  // ==================================================

  function renderWelcome(student) {
    var el = document.getElementById("dashWelcome");
    if (el) {
      el.textContent =  (student.name ? student.name.split(" ")[0] : "Student");
    }
  }

  // ==================================================
  // OVERVIEW CARDS
  // ==================================================

  function renderOverview() {
    var overview = api.getDashboardOverview();
    if (!overview) return;

    var items = [
      { id: "overviewProgress", value: overview.progress + "%", label: "Learning Progress", icon: "&#128200;" },
      { id: "overviewQuiz", value: overview.quizAccuracy + "%", label: "Quiz Accuracy", icon: "&#9989;" },
      { id: "overviewStreak", value: overview.studyStreak + " Days", label: "Study Streak", icon: "&#128293;" },
      { id: "overviewTopics", value: overview.topicsMastered, label: "Topics Mastered", icon: "&#128218;" }
    ];

    var container = document.getElementById("dashOverview");
    if (!container) return;

    var html = "";
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      html += '<div class="dash-stat-card">';
      html += '  <div class="dash-stat-icon">' + item.icon + '</div>';
      html += '  <div class="dash-stat-value">' + item.value + '</div>';
      html += '  <div class="dash-stat-label">' + item.label + '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  // ==================================================
  // CONTINUE LEARNING
  // ==================================================

  function renderContinueLearning() {
    var container = document.getElementById("dashContinueLearning");
    if (!container) return;

    var active = api.getActiveCourses() || [];
    var completed = api.getCompletedCourses() || [];

    if (active.length === 0 && completed.length === 0) {
      container.innerHTML =
        '<div class="dash-empty">' +
        '  <div class="dash-empty-icon">&#128218;</div>' +
        '  <p>Start your learning journey by picking a course that interests you.</p>' +
        '  <a href="' + basePath + '/pages/courses.html" class="btn btn-primary btn-sm">Explore Courses</a>' +
        '</div>';
      return;
    }

    var primary = null;
    var rest = [];
    if (active.length > 0) {
      orderActiveCourses(active);
      primary = active[0];
      for (var i = 1; i < active.length; i++) rest.push(active[i]);
    } else {
      orderCompletedCourses(completed);
      primary = completed[0];
    }

    var html = renderFeaturedCard(primary);
    for (var j = 0; j < rest.length; j++) {
      html += renderCompactCourse(rest[j]);
    }
    container.innerHTML = html;
    bindBookmarkToggles(container);
  }

  // Delegate bookmark toggles to the bookmarks API and update the button.
  function bindBookmarkToggles(container) {
    container.addEventListener("click", function (event) {
      var el = event.target;
      var btn = null;
      while (el && el !== container) {
        if (el.getAttribute && el.getAttribute("data-course-id") !== null) {
          btn = el;
          break;
        }
        el = el.parentNode;
      }
      if (!btn) return;
      var courseId = Number(btn.getAttribute("data-course-id"));
      if (!courseId) return;
      var result = api.bookmarkCourse(courseId);
      var on = !!(result && result.bookmarked);
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.innerHTML = on ? "&#9733;" : "&#9734;";
      btn.setAttribute("aria-label", on ? "Remove from bookmarks" : "Save to bookmarks");
    });
  }

  // Most recently active course first: a course the student has already
  // worked on ranks above a freshly enrolled one; ties break by start date.
  function orderActiveCourses(list) {
    list.sort(function (a, b) {
      var aBusy = hasActivity(a.progress) ? 0 : 1;
      var bBusy = hasActivity(b.progress) ? 0 : 1;
      if (aBusy !== bBusy) return aBusy - bBusy;
      return compareDates(b.progress.startedAt, a.progress.startedAt);
    });
  }

  function orderCompletedCourses(list) {
    list.sort(function (a, b) {
      return compareDates(b.progress.startedAt, a.progress.startedAt);
    });
  }

  function hasActivity(progress) {
    if (!progress) return false;
    if (progress.lastLessonId) return true;
    return countCompleted(progress) > 0;
  }

  function compareDates(a, b) {
    var ta = a ? Date.parse(a) : 0;
    var tb = b ? Date.parse(b) : 0;
    if (!ta && !tb) return 0;
    if (!tb) return -1;
    if (!ta) return 1;
    if (ta === tb) return 0;
    return ta > tb ? 1 : -1;
  }

  // The primary "hero" card for the single most relevant course.
  function renderFeaturedCard(item) {
    var course = item.course;
    var progress = item.progress;
    var lessons = getFlatLessons(course);
    var step = buildNextStep(course, progress, lessons);
    var pct = step.complete ? 100 : progressPercent(progress, lessons.length);
    var thumbColor = getThumbColor(course.thumbnail);
    var bookmarked = !!api.isBookmarked(course.id, "course");

    var html = "";
    html += '<div class="cl-featured">';
    html += '  <div class="cl-featured-thumb" style="background:' + thumbColor + ';">';
    html += '    <span class="cl-featured-icon">' + getThumbIcon(course.thumbnail) + '</span>';
    html += '  </div>';
    html += '  <div class="cl-featured-body">';
    html += '    <div class="cl-featured-head">';
    html += '      <div class="cl-title-wrap">';
    html += '        <h4 class="cl-course-title">' + escHtml(course.title) + '</h4>';
    html += '        <div class="cl-chips">' + chip(course.category) + chip(course.level) + '</div>';
    html += '      </div>';
    html += '      <button type="button" class="cl-bookmark' + (bookmarked ? " active" : "") +
      '" data-course-id="' + course.id + '" aria-pressed="' + (bookmarked ? "true" : "false") +
      '" aria-label="' + (bookmarked ? "Remove from bookmarks" : "Save to bookmarks") +
      '" title="Save to bookmarks">' + (bookmarked ? "&#9733;" : "&#9734;") + '</button>';
    html += '    </div>';

    if (step.complete) {
      html += '    <p class="cl-next cl-next-done">Course completed. Keep your notes fresh by reviewing the material.</p>';
    } else {
      html += '    <p class="cl-next"><span class="cl-next-label">' + step.verb + ':</span> ' + escHtml(step.lessonTitle) + '</p>';
    }

    html += '    <div class="cl-progress">';
    html += '      <div class="dash-progress-bar cl-progress-bar"><div class="dash-progress-fill" style="width:' + pct + '%;"></div></div>';
    html += '      <span class="cl-progress-pct">' + pct + '%</span>';
    html += '    </div>';

    html += '    <div class="cl-stats">';
    html += '      <span class="cl-stat">' + countCompleted(progress) + ' / ' + lessonTotal(progress, lessons.length) + ' lessons</span>';
    html += remainingStat(lessons, progress);
    html += lastActivityStat(course, progress, lessons);
    html += '    </div>';

    html += '    <div class="cl-actions">';
    html += '      <a href="' + step.url + '" class="btn btn-primary btn-sm">' + step.label + '</a>';
    html += '      <a href="' + courseUrl(course.id) + '" class="btn btn-ghost btn-sm" aria-label="Open ' + escHtml(course.title) + ' details">Open Course</a>';
    html += '    </div>';
    html += '  </div>';
    html += '</div>';
    return html;
  }

  // Compact secondary rows for the remaining in-progress courses.
  function renderCompactCourse(item) {
    var course = item.course;
    var progress = item.progress;
    var lessons = getFlatLessons(course);
    var step = buildNextStep(course, progress, lessons);
    var pct = progressPercent(progress, lessons.length);
    var label = step.complete ? "Review" : (step.verb === "Start" ? "Start" : "Continue");

    var html = "";
    html += '<div class="cl-row">';
    html += '  <span class="cl-row-thumb" style="background:' + getThumbColor(course.thumbnail) + ';">' + getThumbIcon(course.thumbnail) + '</span>';
    html += '  <div class="cl-row-body">';
    html += '    <div class="cl-row-title">' + escHtml(course.title) + '</div>';
    html += '    <div class="cl-row-meta">' + countCompleted(progress) + ' / ' + lessonTotal(progress, lessons.length) + ' lessons</div>';
    html += '    <div class="dash-progress-bar cl-row-bar"><div class="dash-progress-fill" style="width:' + pct + '%;"></div></div>';
    html += '  </div>';
    html += '  <a href="' + step.url + '" class="cl-row-link">' + label + ' &rarr;</a>';
    html += '</div>';
    return html;
  }

  // Decide where the student should go next: the first uncompleted,
  // non-quiz lesson in curriculum order (deterministic), falling back to
  // the API's smart recommendation when only quiz work remains.
  function buildNextStep(course, progress, lessons) {
    var complete = isCourseComplete(progress);
    if (complete) {
      return {
        complete: true,
        label: "Review Course",
        verb: "Review",
        lessonTitle: course.title,
        url: courseUrl(course.id)
      };
    }

    var next = nextLesson(lessons, progress);
    if (next) {
      var started = countCompleted(progress) > 0;
      return {
        complete: false,
        label: started ? "Continue Learning" : "Start Learning",
        verb: started ? "Continue" : "Start",
        lessonTitle: next.title,
        url: lessonUrl(course.id, next.id)
      };
    }

    var rec = api.getRecommendedNextStepForCourse(course.id);
    if (rec && (rec.type === "retry_quiz" || rec.type === "take_quiz") && rec.quizUrl) {
      return {
        complete: false,
        label: rec.actionLabel || "Take Quiz",
        verb: "Continue",
        lessonTitle: rec.title,
        url: basePath + "/pages/" + rec.quizUrl
      };
    }

    return {
      complete: true,
      label: "Review Course",
      verb: "Review",
      lessonTitle: course.title,
      url: courseUrl(course.id)
    };
  }

  // ---- Shared helpers for the Continue Learning card ----

  function getFlatLessons(course) {
    var out = [];
    var curriculum = course && course.curriculum;
    if (!curriculum) return out;
    for (var m = 0; m < curriculum.length; m++) {
      var mod = curriculum[m];
      if (!mod || !mod.lessons) continue;
      for (var l = 0; l < mod.lessons.length; l++) {
        out.push(mod.lessons[l]);
      }
    }
    return out;
  }

  function countCompleted(progress) {
    if (!progress) return 0;
    if (progress.completedLessons && progress.completedLessons.length) {
      return progress.completedLessons.length;
    }
    return progress.completedCount || 0;
  }

  function lessonTotal(progress, fallback) {
    if (progress && progress.totalCount) return progress.totalCount;
    return fallback;
  }

  function isCourseComplete(progress) {
    if (!progress) return false;
    var done = countCompleted(progress);
    var total = progress.totalCount ? progress.totalCount : 0;
    if (total > 0 && done >= total) return true;
    return Number(progress.progressPercentage) >= 100;
  }

  function progressPercent(progress, lessonCount) {
    var pct = parseInt(progress && progress.progressPercentage, 10);
    if (isNaN(pct)) {
      var done = countCompleted(progress);
      var total = lessonTotal(progress, lessonCount);
      pct = total > 0 ? Math.round((done / total) * 100) : 0;
    }
    if (isCourseComplete(progress)) pct = 100;
    if (pct < 0) pct = 0;
    if (pct > 100) pct = 100;
    return pct;
  }

  // Next uncompleted, non-quiz lesson in curriculum order.
  function nextLesson(lessons, progress) {
    var done = progress && progress.completedLessons ? progress.completedLessons : [];
    for (var i = 0; i < lessons.length; i++) {
      var lesson = lessons[i];
      if (lesson.type === "quiz") continue;
      if (!isCompleted(done, lesson.id)) return lesson;
    }
    return null;
  }

  function isCompleted(completed, id) {
    for (var i = 0; i < completed.length; i++) {
      if (String(completed[i]) === String(id)) return true;
    }
    return false;
  }

  function remainingStat(lessons, progress) {
    var mins = remainingMinutes(lessons, progress);
    if (mins === null) return "";
    if (mins <= 0) return "";
    return '<span class="cl-stat">Est. ' + formatMinutes(mins) + ' left</span>';
  }

  function remainingMinutes(lessons, progress) {
    var done = progress && progress.completedLessons ? progress.completedLessons : [];
    var total = 0;
    var have = false;
    for (var i = 0; i < lessons.length; i++) {
      var m = lessonMinutes(lessons[i].duration);
      if (m !== null) have = true;
      if (isCompleted(done, lessons[i].id)) continue;
      if (m !== null) total += m;
    }
    return have ? total : null;
  }

  function lessonMinutes(duration) {
    if (!duration) return null;
    var m = parseInt(duration, 10);
    if (isNaN(m)) return null;
    return m;
  }

  function formatMinutes(min) {
    if (min >= 60) {
      var h = Math.floor(min / 60);
      var r = min % 60;
      return r > 0 ? h + "h " + r + "m" : h + "h";
    }
    return min + "m";
  }

  function lastActivityStat(course, progress, lessons) {
    if (progress && progress.lastLessonId) {
      for (var i = 0; i < lessons.length; i++) {
        if (String(lessons[i].id) === String(progress.lastLessonId)) {
          return '<span class="cl-stat">Last lesson: ' + escHtml(lessons[i].title) + '</span>';
        }
      }
    }
    if (progress && progress.startedAt) {
      return '<span class="cl-stat">Started ' + timeAgo(progress.startedAt) + '</span>';
    }
    return "";
  }

  function timeAgo(iso) {
    var t = Date.parse(iso);
    if (!t) return "";
    var days = Math.floor((Date.now() - t) / 86400000);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 7) return days + " days ago";
    if (days < 30) return Math.floor(days / 7) + " weeks ago";
    return "a while ago";
  }

  function chip(text) {
    if (!text) return "";
    return '<span class="cl-chip">' + escHtml(text) + '</span>';
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function lessonUrl(courseId, lessonId) {
    return basePath + "/pages/lesson.html?courseId=" + courseId + "&lessonId=" + encodeURIComponent(lessonId);
  }

  function courseUrl(courseId) {
    return basePath + "/pages/course-details.html?id=" + courseId;
  }

  // ==================================================
  // MY LEARNING (Tabs)
  // ==================================================

  function renderMyLearning() {
    var container = document.getElementById("dashMyLearning");
    if (!container) return;

    var activeCourses = api.getActiveCourses();
    var completedCourses = api.getCompletedCourses();
    var savedCourses = api.getSavedCourses();

    var tabsHtml =
      '<div class="dash-tabs">' +
      '  <button class="dash-tab active" data-tab="active">Active (' + activeCourses.length + ')</button>' +
      '  <button class="dash-tab" data-tab="completed">Completed (' + completedCourses.length + ')</button>' +
      '  <button class="dash-tab" data-tab="saved">Saved (' + savedCourses.length + ')</button>' +
      '</div>';

    var contentHtml =
      '<div class="dash-tab-content" id="dashTabActive">' + renderMyLearningList(activeCourses, "active") + '</div>' +
      '<div class="dash-tab-content" id="dashTabCompleted" style="display:none;">' + renderMyLearningList(completedCourses, "completed") + '</div>' +
      '<div class="dash-tab-content" id="dashTabSaved" style="display:none;">' + renderSavedList(savedCourses) + '</div>';

    container.innerHTML = tabsHtml + contentHtml;
    setupTabs();
  }

  function renderMyLearningList(courses, type) {
    if (courses.length === 0) {
      var msg = type === "active" ? "No active courses." : "No completed courses yet.";
      return '<div class="dash-empty-inline"><p>' + msg + '</p></div>';
    }

    var html = '<div class="dash-learning-list">';
    for (var i = 0; i < courses.length; i++) {
      var item = courses[i];
      var course = item.course;
      var progress = item.progress;
      var pct = progress.progressPercentage;

      html += '<div class="dash-learning-item">';
      html += '  <div class="dash-learning-info">';
      html += '    <h4>' + course.title + '</h4>';
      html += '    <span>' + progress.completedCount + ' / ' + progress.totalCount + ' lessons &middot; ' + pct + '%</span>';
      html += '  </div>';
      html += '  <div class="dash-learning-actions">';
      html += '    <a href="' + basePath + '/pages/course-details.html?id=' + course.id + '" class="btn btn-primary btn-sm">';
      html += type === "active" ? "Continue" : "Review";
      html += '    </a>';
      html += '  </div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderSavedList(courses) {
    if (courses.length === 0) {
      return '<div class="dash-empty-inline"><p>No saved courses.</p></div>';
    }

    var html = '<div class="dash-learning-list">';
    for (var i = 0; i < courses.length; i++) {
      var course = courses[i];

      html += '<div class="dash-learning-item">';
      html += '  <div class="dash-learning-info">';
      html += '    <h4>' + course.title + '</h4>';
      html += '    <span>' + course.category + ' &middot; ' + course.level + '</span>';
      html += '  </div>';
      html += '  <div class="dash-learning-actions">';
      html += '    <a href="' + basePath + '/pages/course-details.html?id=' + course.id + '" class="btn btn-primary btn-sm">View</a>';
      html += '  </div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function setupTabs() {
    var tabs = document.querySelectorAll(".dash-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");

        var allContents = document.querySelectorAll(".dash-tab-content");
        allContents.forEach(function (c) { c.style.display = "none"; });

        var targetId = "dashTab" + capitalize(tab.getAttribute("data-tab"));
        var target = document.getElementById(targetId);
        if (target) target.style.display = "block";
      });
    });
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ==================================================
  // DAILY GOAL
  // ==================================================

  function renderDailyGoal() {
    var container = document.getElementById("dashDailyGoal");
    if (!container) return;

    var goal = api.getDailyGoal();
    if (!goal) return;

    var pct = Math.round((goal.todayMinutes / goal.targetMinutes) * 100);
    if (pct > 100) pct = 100;

    var circumference = 2 * Math.PI * 45;
    var offset = circumference - (pct / 100) * circumference;

    var html =
      '<div class="dash-goal-inner">' +
      '  <div class="dash-goal-circle">' +
      '    <svg viewBox="0 0 100 100" class="dash-goal-svg">' +
      '      <circle cx="50" cy="50" r="45" class="dash-goal-track" />' +
      '      <circle cx="50" cy="50" r="45" class="dash-goal-ring" style="stroke-dasharray:' + circumference + ';stroke-dashoffset:' + offset + ';" />' +
      '    </svg>' +
      '    <div class="dash-goal-center">' +
      '      <span class="dash-goal-pct">' + pct + '%</span>' +
      '    </div>' +
      '  </div>' +
      '  <div class="dash-goal-details">' +
      '    <div class="dash-goal-row"><span class="dash-goal-label">Daily Goal</span><span class="dash-goal-val">' + goal.targetMinutes + ' minutes</span></div>' +
      '    <div class="dash-goal-row"><span class="dash-goal-label">Today</span><span class="dash-goal-val">' + goal.todayMinutes + ' minutes</span></div>' +
      '    <div class="dash-goal-row"><span class="dash-goal-label">Progress</span><span class="dash-goal-val dash-goal-accent">' + pct + '%</span></div>' +
      '  </div>' +
      '</div>';

    container.innerHTML = html;
  }

  // ==================================================
  // LEARNING STREAK
  // ==================================================

  function renderLearningStreak() {
    var container = document.getElementById("dashStreak");
    if (!container) return;

    var streak = api.getLearningStreak();
    if (!streak) return;

    var html =
      '<div class="dash-streak-header">' +
      '  <span class="dash-streak-fire">&#128293; ' + streak.current + ' Days</span>' +
      '  <p class="dash-streak-sub">Keep learning every day to maintain your streak.</p>' +
      '</div>' +
      '<div class="dash-week">';

    for (var i = 0; i < streak.week.length; i++) {
      var day = streak.week[i];
      var cls = "dash-day";
      if (day.completed) cls += " completed";
      else if (day.isToday) cls += " today";
      else cls += " upcoming";

      html += '<div class="' + cls + '">';
      html += '  <span class="dash-day-label">' + day.day + '</span>';
      html += '  <span class="dash-day-dot"></span>';
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
  }

  // ==================================================
  // RECOMMENDED NEXT STEP
  // ==================================================

  function renderRecommendedNextStep() {
    var container = document.getElementById("dashRecommended");
    if (!container) return;

    // Use personalized learning path logic when the student is enrolled
    var active = api.getActiveCourses();
    var lpRec = null;
    if (active.length > 0) {
      lpRec = api.getRecommendedNextStepForCourse(active[0].course.id);
    }

    if (!lpRec) {
      var fallback = api.getRecommendedNextStep();
      if (fallback) {
        var fbUrl = basePath + "/pages/course-details.html?id=" + fallback.courseId;
        container.innerHTML =
          '<div class="dash-rec-content">' +
          '  <div class="dash-rec-icon">&#128161;</div>' +
          '  <div class="dash-rec-text">' +
          '    <h4 class="dash-rec-title">Continue with ' + fallback.lessonTitle + '</h4>' +
          '    <p class="dash-rec-course">' + fallback.courseTitle + '</p>' +
          '    <p class="dash-rec-reason">' + fallback.reason + '</p>' +
          '  </div>' +
          '</div>' +
          '<a href="' + fbUrl + '" class="btn btn-primary btn-sm dash-rec-btn">Continue Learning</a>';
        return;
      }
      container.innerHTML = '<div class="dash-empty-inline"><p>No recommendations yet. Start a course to get personalized suggestions.</p></div>';
      return;
    }

    var courseTitle = "";
    var course = api.getCourseById(active[0].course.id);
    if (course) courseTitle = course.title;

    var url;
    var btnLabel = lpRec.actionLabel || "Continue Learning";
    if (lpRec.quizUrl) {
      url = basePath + "/pages/" + lpRec.quizUrl;
    } else if (lpRec.lessonId) {
      url = basePath + "/pages/lesson.html?courseId=" + active[0].course.id + "&lessonId=" + lpRec.lessonId;
    } else {
      url = basePath + "/pages/course-details.html?id=" + active[0].course.id;
    }

    var html =
      '<div class="dash-rec-content">' +
      '  <div class="dash-rec-icon">&#128161;</div>' +
      '  <div class="dash-rec-text">' +
      '    <h4 class="dash-rec-title">' + lpRec.title + '</h4>' +
      '    <p class="dash-rec-course">' + courseTitle + '</p>' +
      '    <p class="dash-rec-reason">' + lpRec.message + '</p>' +
      '  </div>' +
      '</div>' +
      '<div class="dash-rec-actions">' +
      '  <a href="' + url + '" class="btn btn-primary btn-sm dash-rec-btn">' + btnLabel + '</a>' +
      '  <a href="' + basePath + '/pages/learning-path.html?course=' + active[0].course.id + '" class="btn btn-ghost btn-sm">Learning Path</a>' +
      '</div>';

    container.innerHTML = html;
  }

  // ==================================================
  // TODAY'S REVISION
  // ==================================================

  function renderRevision() {
    var container = document.getElementById("dashRevision");
    if (!container) return;

    var summary = api.getRevisionSummary();
    if (!summary) {
      container.innerHTML = '<div class="dash-empty-inline"><p>Revision data unavailable.</p></div>';
      return;
    }

    function content(icon, title, text, btnLabel, btnUrl, btnClass) {
      return (
        '<div class="dash-rec-content">' +
        '  <div class="dash-rec-icon">' + icon + '</div>' +
        '  <div class="dash-rec-text">' +
        '    <h4 class="dash-rec-title">' + title + '</h4>' +
        '    <p class="dash-rec-reason">' + text + '</p>' +
        '  </div>' +
        '</div>' +
        '<a href="' + btnUrl + '" class="btn ' + btnClass + ' btn-sm dash-rec-btn">' + btnLabel + '</a>'
      );
    }

    if (!summary.hasActivity) {
      container.innerHTML = content(
        "&#128218;",
        "Ready to review?",
        "Start reviewing flashcards to build your memory schedule.",
        "Start Learning",
        basePath + "/pages/flashcards.html",
        "btn-primary"
      );
      return;
    }

    if (summary.dueCount > 0) {
      var text = summary.dueCount + " card" + (summary.dueCount === 1 ? " is" : "s are") +
        " ready for review today.";
      if (summary.overdueCount > 0) {
        text += " " + summary.overdueCount + " overdue.";
      }
      container.innerHTML = content(
        "&#128337;",
        "Today's Revision",
        text,
        "Start Revision",
        basePath + "/pages/flashcards.html?mode=revision",
        "btn-primary"
      ) +
      '<a href="' + basePath + '/pages/revision.html" class="btn btn-ghost btn-sm dash-rec-btn">Open Revision Center</a>';
      return;
    }

    container.innerHTML = content(
      "&#127881;",
      "You're all caught up!",
      "No cards are due right now. Check the Revision Center for upcoming reviews.",
      "Revision Center",
      basePath + "/pages/revision.html",
      "btn-ghost"
    );
  }

  // ==================================================
  // RECENT ACTIVITY
  // ==================================================

  function renderRecentActivity() {
    var container = document.getElementById("dashActivity");
    if (!container) return;

    var activity = api.getRecentActivity();

    if (!activity || activity.length === 0) {
      container.innerHTML = '<div class="dash-empty-inline"><p>No recent activity.</p></div>';
      return;
    }

    var html = '<div class="dash-activity-list">';
    for (var i = 0; i < activity.length; i++) {
      var act = activity[i];
      html += '<div class="dash-activity-item">';
      html += '  <span class="dash-activity-icon">' + act.icon + '</span>';
      html += '  <div class="dash-activity-body">';
      html += '    <span class="dash-activity-text">' + act.text + '</span>';
      html += '    <span class="dash-activity-date">' + act.date + '</span>';
      html += '  </div>';
      html += '</div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  // ==================================================
  // QUICK ACTIONS
  // ==================================================

  function renderQuickActions() {
    var container = document.getElementById("dashQuickActions");
    if (!container) return;

    var actions = [
      { label: "Continue Learning", url: getContinueUrl(), icon: "&#9654;" },
      { label: "Explore Courses", url: basePath + "/pages/courses.html", icon: "&#128218;" },
      { label: "Learning Path", url: basePath + "/pages/learning-path.html", icon: "&#128200;" },
      { label: "AI Tutor", url: basePath + "/pages/ai-tutor.html", icon: "&#129302;" },
      { label: "Analytics", url: basePath + "/pages/analytics.html", icon: "&#128200;" },
      { label: "Achievements", url: basePath + "/pages/achievements.html", icon: "&#127942;" },
      { label: "Profile", url: basePath + "/pages/profile.html", icon: "&#128100;" },
      { label: "Settings", url: basePath + "/pages/settings.html", icon: "&#9881;" }
    ];

    var html = '<div class="dash-actions-grid">';
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i];
      html += '<a href="' + a.url + '" class="dash-action-btn">';
      html += '  <span class="dash-action-icon">' + a.icon + '</span>';
      html += '  <span class="dash-action-label">' + a.label + '</span>';
      html += '</a>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function getContinueUrl() {
    var active = api.getActiveCourses();
    if (active.length > 0) {
      return basePath + "/pages/course-details.html?id=" + active[0].course.id;
    }
    return basePath + "/pages/courses.html";
  }

  // ==================================================
  // LEADERBOARD CARD
  // ==================================================

  function renderLeaderboard() {
    var container = document.getElementById("dashLeaderboard");
    if (!container) return;

    var board = api.getLeaderboard("overall");
    if (!board || !board.students || board.students.length < 2) {
      container.innerHTML =
        '<div class="lb-dash lb-dash-empty">' +
        '  <p class="lb-dash-label">Keep climbing</p>' +
        '  <p class="lb-dash-sub">Not enough ranking data yet. Keep learning to get on the board.</p>' +
        '  <a href="' + basePath + '/pages/leaderboard.html" class="btn btn-ghost btn-sm lb-dash-cta">View Leaderboard &rarr;</a>' +
        '</div>';
      return;
    }

    var me = null;
    var i;
    for (i = 0; i < board.students.length; i++) {
      if (board.students[i].isCurrentUser) {
        me = board.students[i];
        break;
      }
    }
    if (!me) return;

    container.innerHTML =
      '<div class="lb-dash">' +
      '  <div class="lb-dash-head">' +
      '    <span class="lb-dash-rank">#' + me.rank + '</span>' +
      '    <div>' +
      '      <p class="lb-dash-label">Your Leaderboard Rank</p>' +
      '      <p class="lb-dash-sub">across ' + board.total + ' students</p>' +
      '    </div>' +
      '  </div>' +
      '  <div class="lb-dash-stats">' +
      '    <div class="lb-dash-stat"><span class="lb-dash-stat-value">' + Number(me.xp).toLocaleString("en-US") + '</span><span class="lb-dash-stat-label">XP</span></div>' +
      '    <div class="lb-dash-stat"><span class="lb-dash-stat-value">' + me.level + '</span><span class="lb-dash-stat-label">Level</span></div>' +
      '    <div class="lb-dash-stat"><span class="lb-dash-stat-value">' + me.currentStreak + '</span><span class="lb-dash-stat-label">Day Streak</span></div>' +
      '  </div>' +
      '  <a href="' + basePath + '/pages/leaderboard.html" class="btn btn-primary btn-sm lb-dash-cta">View Leaderboard &rarr;</a>' +
      '</div>';
  }

  // ==================================================
  // STUDY PLANNER CARD
  // ==================================================

  function dashPlannerEscape(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderPlanner() {
    var container = document.getElementById("dashPlanner");
    if (!container) return;

    try {
      var goal = api.getPlannerDailyGoal();
      var tasks = api.getStudyTasks();
      var tasksList = Array.isArray(tasks) ? tasks : [];

      var now = new Date();
      var todayKey = now.getFullYear() + "-" + pad2(now.getMonth() + 1) + "-" + pad2(now.getDate());
      var remainingToday = 0;
      var nextTask = null;
      for (var i = 0; i < tasksList.length; i++) {
        var t = tasksList[i];
        if (t.date === todayKey && t.effectiveStatus !== "completed") remainingToday++;
        if ((t.effectiveStatus === "pending" || t.effectiveStatus === "in progress") && !nextTask) {
          nextTask = t;
        }
      }

      var remaining = goal ? Math.max(0, goal.targetMinutes - goal.completedMinutes) : null;
      var pct = goal ? goal.percent : 0;
      var nextTitle = nextTask ? dashPlannerEscape(nextTask.title) : "No tasks planned yet";

      container.innerHTML =
        '<div class="sp-dash">' +
        '  <div class="sp-dash-head">' +
        '    <span class="sp-dash-icon">&#128197;</span>' +
        '    <div>' +
        '      <p class="sp-dash-label">Your Study Schedule</p>' +
        '      <p class="sp-dash-sub">' + (goal ? remaining + ' min left to reach your daily goal' : 'Daily goal is not available yet') + '</p>' +
        '    </div>' +
        '  </div>' +
        '  <div class="sp-dash-progress"><div class="sp-dash-progress-bar" style="width:' + pct + '%"></div></div>' +
        '  <div class="sp-dash-stats">' +
        '    <div class="sp-dash-stat"><span class="sp-dash-stat-value">' + remainingToday + '</span><span class="sp-dash-stat-label">Tasks Today</span></div>' +
        '    <div class="sp-dash-stat"><span class="sp-dash-stat-value">' + (remaining === null ? "&ndash;" : remaining + "m") + '</span><span class="sp-dash-stat-label">Goal Left</span></div>' +
        '    <div class="sp-dash-stat" style="grid-column:1 / span 2;"><span class="sp-dash-stat-value">' + nextTitle + '</span><span class="sp-dash-stat-label">Next Task</span></div>' +
        '  </div>' +
        '  <a href="' + basePath + '/pages/study-planner.html" class="btn btn-primary btn-sm lb-dash-cta">Open Planner &rarr;</a>' +
        '</div>';
    } catch (e) {
      container.innerHTML =
        '<div class="sp-dash sp-dash-empty">' +
        '  <p class="sp-dash-label">Study Planner</p>' +
        '  <a href="' + basePath + '/pages/study-planner.html" class="btn btn-ghost btn-sm lb-dash-cta">Open Planner &rarr;</a>' +
        '</div>';
    }
  }

  function renderBookmarks() {
    var container = document.getElementById("dashBookmarks");
    if (!container) return;

    try {
      var count = api.getBookmarkCount() || 0;
      container.innerHTML =
        '<div class="sp-dash">' +
        '  <div class="sp-dash-head">' +
        '    <span class="sp-dash-icon">&#128278;</span>' +
        '    <div>' +
        '      <p class="sp-dash-label">Saved Learning</p>' +
        '      <p class="sp-dash-sub">' + count + ' item' + (count === 1 ? "" : "s") + " saved</p>" +
        "    </div>" +
        "  </div>" +
        '  <a href="' + basePath + '/pages/bookmarks.html" class="btn btn-primary btn-sm lb-dash-cta">View Bookmarks &rarr;</a>' +
        "</div>";
    } catch (e) {
      container.innerHTML =
        '<div class="sp-dash sp-dash-empty">' +
        '  <p class="sp-dash-label">Saved Learning</p>' +
        '  <a href="' + basePath + '/pages/bookmarks.html" class="btn btn-ghost btn-sm lb-dash-cta">View Bookmarks &rarr;</a>' +
        "</div>";
    }
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  // ==================================================
  // THUMBNAIL HELPERS
  // ==================================================

  function getThumbColor(key) {
    var map = {
      dsa: "linear-gradient(135deg,#2563EB,#0891B2)",
      python: "linear-gradient(135deg,#059669,#06B6D4)",
      webdev: "linear-gradient(135deg,#2563EB,#7C3AED)",
      dbms: "linear-gradient(135deg,#D97706,#EA580C)",
      ai: "linear-gradient(135deg,#7C3AED,#2563EB)",
      excel: "linear-gradient(135deg,#059669,#10B981)",
      testing: "linear-gradient(135deg,#DC2626,#F59E0B)",
      java: "linear-gradient(135deg,#DC2626,#2563EB)"
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
      java: "&#9749;"
    };
    return map[key] || "&#128218;";
  }

  // ==================================================
  // PUBLIC
  // ==================================================

  return {
    init: init,
    renderContinueLearning: renderContinueLearning,
    renderLeaderboard: renderLeaderboard,
    renderPlanner: renderPlanner,
    renderBookmarks: renderBookmarks
  };
})();

