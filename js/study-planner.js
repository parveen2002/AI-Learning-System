/* ============================================
   AI-Learning System - Study Planner
   ============================================
   Personal study planner & daily learning
   schedule. Lists tasks (lessons, quizzes,
   revision, flashcards, practice, custom),
   a daily goal with progress, study streak,
   flashcard due-revisions, weekly overview,
   a month calendar, needs-attention handling,
   and rule-based suggested tasks built from
   real stored activity (never labelled as AI).

   Every value comes from api.js (mock storage
   in LocalStorage, isolated per student).
   ============================================ */

var LearnSphereStudyPlanner = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var basePath = "";

  var VIEW_STORAGE_KEY = "ai_learning_planner_view";

  var state = {
    view: "list",
    statusTab: "all",
    typeFilter: "all",
    priorityFilter: "all",
    courseFilter: "all",
    search: "",
    focusDate: null,
    calYear: 0,
    calMonth: 0,
    editingId: null,
    reschedule: false,
    deletingId: null,
    courses: [],
    lessons: {},
  };

  var STATUS_TABS = [
    { key: "all", label: "All" },
    { key: "today", label: "Today" },
    { key: "upcoming", label: "Upcoming" },
    { key: "completed", label: "Completed" },
    { key: "overdue", label: "Overdue" },
  ];

  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  var toastTimer = null;

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

    var savedView = null;
    try { savedView = localStorage.getItem(VIEW_STORAGE_KEY); } catch (e) {}
    if (savedView === "calendar" || savedView === "list") state.view = savedView;

    loadCourses();
    buildStatusTabs();
    bindControls();
    bindModals();
    bindActions();
    refresh();
  }

  function detectBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/pages/") !== -1) return "..";
    return ".";
  }

  // ==================================================
  // HELPERS
  // ==================================================

  function el(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function jsonAttr(obj) {
    return JSON.stringify(obj).replace(/'/g, "&#39;");
  }

  function ymd(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }

  function parseYmd(str) {
    if (!str) return null;
    var parts = String(str).split("-");
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }

  function todayYmd() {
    return ymd(new Date());
  }

  function displayDate(dateStr) {
    var d = parseYmd(dateStr);
    if (!d) return "";
    return WEEKDAYS[d.getDay()] + ", " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate();
  }

  function displayTime(timeStr) {
    if (!timeStr) return "";
    var t = String(timeStr).split(":");
    var h = Number(t[0]);
    var m = t.length > 1 ? Number(t[1]) : 0;
    var ampm = h >= 12 ? "PM" : "AM";
    var hh = h % 12;
    if (hh === 0) hh = 12;
    return hh + ":" + pad2(m) + " " + ampm;
  }

  function readTasks() {
    var tasks = api.getStudyTasks();
    return Array.isArray(tasks) ? tasks : [];
  }

  function toast(message) {
    var node = el("spToast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove("show");
    }, 2600);
  }

  // ==================================================
  // COURSE / LESSON DATA
  // ==================================================

  function loadCourses() {
    var courses = api.getCourses();
    state.courses = Array.isArray(courses) ? courses : [];
    state.lessons = {};
    for (var i = 0; i < state.courses.length; i++) {
      var course = state.courses[i];
      var list = [];
      if (course && course.curriculum) {
        for (var m = 0; m < course.curriculum.length; m++) {
          var mod = course.curriculum[m];
          if (!mod || !mod.lessons) continue;
          for (var l = 0; l < mod.lessons.length; l++) {
            list.push(mod.lessons[l]);
          }
        }
      }
      state.lessons[String(course.id)] = list;
    }
  }

  function courseTitle(courseId) {
    if (courseId === undefined || courseId === null) return "";
    for (var i = 0; i < state.courses.length; i++) {
      if (String(state.courses[i].id) === String(courseId)) return state.courses[i].title;
    }
    return "";
  }

  function lessonTitle(courseId, lessonId) {
    if (lessonId === undefined || lessonId === null) return "";
    var list = state.lessons[String(courseId)] || [];
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(lessonId)) return list[i].title;
    }
    return "";
  }

  // ==================================================
  // UI BUILDERS
  // ==================================================

  function buildStatusTabs() {
    var container = el("spStatusTabs");
    if (!container) return;
    var html = "";
    for (var i = 0; i < STATUS_TABS.length; i++) {
      html += '<button type="button" class="sp-status-tab' +
        (state.statusTab === STATUS_TABS[i].key && !state.focusDate ? " active" : "") +
        '" data-status="' + STATUS_TABS[i].key + '">' + STATUS_TABS[i].label + "</button>";
    }
    container.innerHTML = html;
  }

  function populateCourseFilter() {
    var sel = el("spCourseFilter");
    if (!sel) return;
    var html = '<option value="all">All Courses</option>';
    for (var i = 0; i < state.courses.length; i++) {
      html += '<option value="' + escapeHtml(state.courses[i].id) + '">' + escapeHtml(state.courses[i].title) + "</option>";
    }
    sel.innerHTML = html;
    sel.value = state.courseFilter;
  }

  function populateCourseSelects() {
    var courseSel = el("spTaskCourse");
    var lessonSel = el("spTaskLesson");
    if (!courseSel || !lessonSel) return;
    var html = '<option value="">-- No course --</option>';
    for (var i = 0; i < state.courses.length; i++) {
      html += '<option value="' + escapeHtml(state.courses[i].id) + '">' + escapeHtml(state.courses[i].title) + "</option>";
    }
    courseSel.innerHTML = html;
    lessonSel.innerHTML = '<option value="">-- No lesson --</option>';
  }

  function fillLessonOptions(courseId) {
    var lessonSel = el("spTaskLesson");
    if (!lessonSel) return;
    var list = state.lessons[String(courseId)] || [];
    var html = '<option value="">-- No lesson --</option>';
    for (var i = 0; i < list.length; i++) {
      html += '<option value="' + escapeHtml(list[i].id) + '">' + escapeHtml(list[i].title) + "</option>";
    }
    lessonSel.innerHTML = html;
  }

  // ==================================================
  // FILTERING
  // ==================================================

  function matchesFilters(task) {
    if (state.search) {
      var q = state.search.toLowerCase();
      var hay = (task.title + " " + (task.topic || "")).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    if (state.typeFilter !== "all" && task.type !== state.typeFilter) return false;
    if (state.priorityFilter !== "all" && task.priority !== state.priorityFilter) return false;
    if (state.courseFilter !== "all" && String(task.courseId) !== String(state.courseFilter)) return false;

    if (state.focusDate) {
      return task.date === state.focusDate;
    }

    if (state.statusTab === "all") return true;
    if (state.statusTab === "today") return task.date === todayYmd();
    if (state.statusTab === "completed") return task.effectiveStatus === "completed";
    if (state.statusTab === "overdue") return task.effectiveStatus === "overdue";
    if (state.statusTab === "upcoming") {
      return task.effectiveStatus === "pending" || task.effectiveStatus === "in progress";
    }
    return true;
  }

  function filteredTasks() {
    var all = readTasks();
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (matchesFilters(all[i])) out.push(all[i]);
    }
    return out;
  }

  // ==================================================
  // REFRESH PIPELINE
  // ==================================================

  function refresh() {
    renderSummary();
    renderWeekStrip();
    renderTodayPlan();
    renderTaskList();
    renderGoal();
    renderStreak();
    renderDueRevisions();
    renderLearningPath();
    renderUpcoming();
    renderNeedsAttention();
    renderSuggestions();

    if (state.view === "calendar") {
      renderCalendar();
      el("spCalendarCard").hidden = false;
    } else {
      el("spCalendarCard").hidden = true;
    }

    var listBtn = document.querySelector('.sp-view-btn[data-view="list"]');
    var calBtn = document.querySelector('.sp-view-btn[data-view="calendar"]');
    if (listBtn) listBtn.classList.toggle("active", state.view === "list");
    if (calBtn) calBtn.classList.toggle("active", state.view === "calendar");
  }

  // ==================================================
  // SUMMARY CARDS
  // ==================================================

  function renderSummary() {
    var container = el("spSummary");
    if (!container) return;
    var tasks = readTasks();
    var todayStr = todayYmd();
    var todayCount = 0;
    var completedToday = 0;
    var pendingCount = 0;
    var overdueCount = 0;
    var dueRevisions = 0;
    var streak = api.getStreakAnalytics();

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (t.date === todayStr) todayCount++;
      if (t.effectiveStatus === "completed" && t.completedAt && String(t.completedAt).slice(0, 10) === todayStr) {
        completedToday++;
      }
      if (t.effectiveStatus === "pending" || t.effectiveStatus === "in progress") pendingCount++;
      if (t.effectiveStatus === "overdue") overdueCount++;
    }

    try {
      var rev = api.getRevisionSummary();
      if (rev) dueRevisions = Number(rev.dueCount) || 0;
    } catch (e) {}

    var revCard = {
      value: String(dueRevisions),
      label: "Due Revisions",
      hint: "flashcards to review",
      icon: "&#128220;",
    };
    var goal = api.getPlannerDailyGoal();

    var cards = [
      { value: String(todayCount), label: "Today's Tasks", hint: "scheduled today", icon: "&#128197;" },
      { value: String(completedToday), label: "Completed Today", hint: "tasks finished", icon: "&#10003;" },
      { value: String(pendingCount), label: "Pending Tasks", hint: "not done yet", icon: "&#128203;" },
      { value: String(overdueCount), label: "Overdue", hint: "need attention", icon: "&#9888;" },
      { value: (goal ? goal.percent + "%" : "0%"), label: "Daily Goal", hint: (goal ? goal.completedMinutes + " / " + goal.targetMinutes + " min" : ""), icon: "&#127919;" },
      { value: (streak && streak.current ? String(streak.current) : "0"), label: "Study Streak", hint: "day" + (streak && streak.current === 1 ? "" : "s"), icon: "&#128293;" },
      revCard,
    ];

    var html = "";
    for (var c = 0; c < cards.length; c++) {
      html +=
        '<article class="sp-summary-card">' +
        '  <span class="sp-summary-icon" aria-hidden="true">' + cards[c].icon + "</span>" +
        '  <div class="sp-summary-info">' +
        "    <span class=\"sp-summary-value\">" + cards[c].value + "</span>" +
        '    <span class="sp-summary-label">' + cards[c].label + "</span>" +
        '    <span class="sp-summary-hint">' + cards[c].hint + "</span>" +
        "  </div>" +
        "</article>";
    }
    container.innerHTML = html;
  }

  // ==================================================
  // THIS WEEK
  // ==================================================

  function renderWeekStrip() {
    var container = el("spWeekStrip");
    if (!container) return;
    var tasks = readTasks();
    var now = new Date();
    var dow = (now.getDay() + 6) % 7;
    var monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow);

    var html = "";
    for (var i = 0; i < 7; i++) {
      var day = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      var key = ymd(day);
      var count = 0;
      var minutes = 0;
      for (var t = 0; t < tasks.length; t++) {
        if (tasks[t].date === key) {
          count++;
          minutes += Number(tasks[t].duration) || 0;
        }
      }
      var isToday = key === todayYmd();
      var isSelected = state.focusDate === key;
      html +=
        '<button type="button" class="sp-week-day' + (isToday ? " today" : "") + (isSelected ? " selected" : "") + '" data-date="' + key + '">' +
        '  <span class="sp-week-day-name">' + WEEKDAYS[day.getDay()] + "</span>" +
        '  <span class="sp-week-day-num">' + day.getDate() + "</span>" +
        '  <span class="sp-week-day-count">' + count + (count === 1 ? " task" : " tasks") + "</span>" +
        '  <span class="sp-week-day-min">' + minutes + " min</span>" +
        "</button>";
    }
    container.innerHTML = html;
  }

  // ==================================================
  // TODAY'S STUDY PLAN
  // ==================================================

  function renderTodayPlan() {
    var container = el("spToday");
    if (!container) return;
    var todayStr = todayYmd();
    var tasks = readTasks();
    var todays = [];
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].date === todayStr) todays.push(tasks[i]);
    }
    todays.sort(function (a, b) {
      return String(a.time || "").localeCompare(String(b.time || ""));
    });

    if (!todays.length) {
      container.innerHTML = '<p class="sp-empty-sm">No study tasks for today.</p>';
      return;
    }
    container.innerHTML = todays.map(taskRowHtml).join("");
  }

  // ==================================================
  // TASK LIST
  // ==================================================

  function renderTaskList() {
    var container = el("spTaskList");
    var title = el("spTaskListTitle");
    var countLabel = el("spTaskListCount");
    var addBtn2 = el("spAddTaskBtn2");
    if (!container) return;

    var tasks = filteredTasks();
    var titleText = "All Study Tasks";
    if (state.focusDate) titleText = displayDate(state.focusDate);
    else if (state.statusTab === "today") titleText = "Today's Tasks";
    else if (state.statusTab === "upcoming") titleText = "Upcoming Tasks";
    else if (state.statusTab === "completed") titleText = "Completed Tasks";
    else if (state.statusTab === "overdue") titleText = "Overdue Tasks";

    if (title) title.textContent = titleText;
    if (countLabel) {
      countLabel.textContent = tasks.length + (tasks.length === 1 ? " task" : " tasks");
    }
    if (addBtn2) addBtn2.hidden = false;

    if (!tasks.length) {
      var msg = state.search ? "No study tasks found." : "No study tasks to show here.";
      container.innerHTML = '<p class="sp-empty">' + msg + "</p>";
      return;
    }
    container.innerHTML = tasks.map(taskRowHtml).join("");
  }

  function taskRowHtml(task) {
    var statusCls = "sp-badge " + statusBadgeClass(task.effectiveStatus);
    var statusText = statusLabel(task.effectiveStatus);
    var prioCls = "sp-prio " + priorityClass(task.priority);
    var course = courseTitle(task.courseId);
    var lesson = lessonTitle(task.courseId, task.lessonId);
    var meta = [];
    if (course) meta.push(escapeHtml(course));
    if (lesson) meta.push(escapeHtml(lesson));
    if (task.topic) meta.push(escapeHtml(task.topic));
    var durationText = task.duration ? task.duration + " min" : "";
    var checked = task.effectiveStatus === "completed" ? " checked" : "";

    return (
      '<article class="sp-task-row" data-id="' + escapeHtml(task.id) + '">' +
      '  <label class="sp-task-check">' +
      '    <input type="checkbox" data-complete="' + escapeHtml(task.id) + '"' + checked + ' aria-label="Mark ' + escapeHtml(task.title) + ' as complete">' +
      '    <span></span>' +
      "  </label>" +
      '  <div class="sp-task-body">' +
      '    <div class="sp-task-top">' +
      '      <span class="sp-badge sp-badge-type">' + escapeHtml(task.type) + "</span>" +
      '      <span class="' + prioCls + '">' + escapeHtml(task.priority) + "</span>" +
      '      <span class="' + statusCls + '">' + statusText + "</span>" +
      "    </div>" +
      "    <h4 class=\"sp-task-title\">" + escapeHtml(task.title) + "</h4>" +
      (meta.length ? '      <p class="sp-task-meta">' + meta.join(" &middot; ") + "</p>" : "") +
      '    <p class="sp-task-when">' + displayDate(task.date) + (task.time ? " at " + displayTime(task.time) : "") + (durationText ? " &middot; " + durationText : "") + "</p>" +
      "  </div>" +
      '  <div class="sp-task-actions">' +
      '    <button type="button" class="sp-icon-btn" data-reschedule="' + escapeHtml(task.id) + '" title="Reschedule" aria-label="Reschedule ' + escapeHtml(task.title) + '">&#128260;</button>' +
      '    <button type="button" class="sp-icon-btn" data-edit="' + escapeHtml(task.id) + '" title="Edit" aria-label="Edit ' + escapeHtml(task.title) + '">&#9998;</button>' +
      '    <button type="button" class="sp-icon-btn sp-icon-danger" data-delete="' + escapeHtml(task.id) + '" title="Delete" aria-label="Delete ' + escapeHtml(task.title) + '">&#128465;</button>' +
      "  </div>" +
      "</article>"
    );
  }

  function statusLabel(status) {
    if (status === "in progress") return "In Progress";
    if (status === "completed") return "Completed";
    if (status === "overdue") return "Overdue";
    return "Pending";
  }

  function statusBadgeClass(status) {
    if (status === "in progress") return "sp-badge-progress";
    if (status === "completed") return "sp-badge-completed";
    if (status === "overdue") return "sp-badge-overdue";
    return "sp-badge-pending";
  }

  function priorityClass(priority) {
    if (priority === "High") return "sp-prio-high";
    if (priority === "Low") return "sp-prio-low";
    return "sp-prio-medium";
  }

  // ==================================================
  // DAILY GOAL
  // ==================================================

  function renderGoal() {
    var container = el("spGoal");
    if (!container) return;
    var goal = api.getPlannerDailyGoal();
    if (!goal) {
      container.innerHTML = '<p class="sp-empty-sm">Daily goal is not available.</p>';
      return;
    }
    var reached = goal.reached;
    var msg = reached
      ? "<strong>Daily goal completed!</strong> Amazing work today. Keep going."
      : goal.remainingMinutes + " minute" + (goal.remainingMinutes === 1 ? "" : "s") + " to reach your goal.";

    var html =
      '<p class="sp-goal-progress-text">' +
      "  <span>" + goal.completedMinutes + " / " + goal.targetMinutes + " min</span>" +
      '  <span class="sp-goal-pct">' + goal.percent + "%</span>" +
      "</p>" +
      '<div class="sp-progress"><div class="sp-progress-bar' + (reached ? " done" : "") + '" style="width:' + goal.percent + '%"></div></div>' +
      '<p class="sp-goal-msg">' + msg + "</p>" +
      '<div class="sp-goal-edit">' +
      '  <label class="sp-field-label" for="spGoalInput">Daily target (minutes)</label>' +
      '  <div class="sp-goal-edit-row">' +
      '    <input type="number" id="spGoalInput" min="5" max="480" value="' + goal.targetMinutes + '" aria-label="Daily target minutes">' +
      '    <button type="button" class="btn btn-primary btn-sm" id="spGoalSave">Save</button>' +
      "  </div>" +
      '  <p class="sp-goal-hint">Suggested options: ' + ['30', '60', '90', '120'].map(function (n) { return n + " min"; }).join(", ") + "</p>" +
      "</div>";

    container.innerHTML = html;

    var saveBtn = el("spGoalSave");
    if (saveBtn) {
      saveBtn.addEventListener("click", function () {
        var input = el("spGoalInput");
        var value = input ? input.value : "";
        var res = api.saveDailyGoal(Number(value));
        if (res && res.success) {
          if (input) input.value = String(res.targetMinutes);
          toast(res.message || "Daily goal saved!");
          refresh();
        } else {
          toast((res && res.message) || "Please enter a valid goal.");
        }
      });
    }
  }

  // ==================================================
  // STUDY STREAK
  // ==================================================

  function renderStreak() {
    var container = el("spStreak");
    if (!container) return;
    var streak = api.getStreakAnalytics();
    if (!streak) {
      container.innerHTML = '<p class="sp-empty-sm">Streak data is not available yet.</p>';
      return;
    }
    var html =
      '<div class="sp-streak-val">' +
      '  <span class="sp-streak-fire">&#128293; ' + streak.current + " day" + (streak.current === 1 ? "" : "s") + "</span>" +
      "  <p class=\"sp-streak-hint\">Longest: " + streak.longest + " day" + (streak.longest === 1 ? "" : "s") + " &middot; " + streak.learningDays + " total learning days</p>" +
      "</div>" +
      '<p class="sp-streak-tip">Study a little every day to keep your streak alive.</p>';
    container.innerHTML = html;
  }

  // ==================================================
  // DUE REVISIONS (FLASHCARDS)
  // ==================================================

  function renderDueRevisions() {
    var container = el("spDueRevisions");
    if (!container) return;
    var rev = null;
    try { rev = api.getRevisionSummary(); } catch (e) {}
    var due = rev ? Number(rev.dueCount) || 0 : 0;
    var overdue = rev ? Number(rev.overdueCount) || 0 : 0;
    var reviewedToday = rev ? Number(rev.reviewedToday) || 0 : 0;

    var html = "";
    if (due === 0) {
      html += '<p class="sp-empty-sm">No flashcards due for review today.</p>';
    } else {
      html +=
        '<div class="sp-due-big">' +
        '  <span class="sp-due-num">' + due + "</span>" +
        '  <span class="sp-due-cap">card' + (due === 1 ? "" : "s") + " ready</span>" +
        "</div>" +
        (overdue > 0 ? '<p class="sp-due-warn">' + overdue + " overdue</p>" : "");
    }
    html += '<p class="sp-due-stats">Reviewed today: ' + reviewedToday + " &middot; Due: " + due + "</p>";
    html += '<button type="button" class="btn btn-primary btn-sm" id="spAddRevisionTask">&#43; Add Revision Task</button>';
    container.innerHTML = html;

    var addBtn = el("spAddRevisionTask");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        openTaskModal({
          title: "Flashcard Revision",
          type: "Revision",
          topic: due > 0 ? due + " flashcard" + (due === 1 ? "" : "s") + " due for review." : "Plan a short flashcard revision session.",
          duration: "15",
        });
      });
    }
  }

  // ==================================================
  // LEARNING PATH INTEGRATION
  // ==================================================

  function renderLearningPath() {
    var container = el("spLearningPath");
    if (!container) return;
    var enrolled = api.getEnrolledCourses();
    var ids = Array.isArray(enrolled) ? enrolled : [];

    var html = "";
    var shown = 0;
    for (var i = 0; i < ids.length && shown < 2; i++) {
      var courseId = ids[i];
      if (!courseId) continue;
      var rec = api.getRecommendedNextStepForCourse(courseId);
      if (!rec || !rec.title) continue;
      var typeMap = { start: "Lesson", continue: "Lesson", take_quiz: "Quiz", retry_quiz: "Practice", course_completed: "Revision" };
      var taskType = typeMap[rec.type] || "Custom Study";
      var canSchedule = rec.type !== "course_completed";
      html +=
        '<article class="sp-lp-item">' +
        '  <p class="sp-lp-course">' + escapeHtml(courseTitle(courseId)) + "</p>" +
        '  <h4 class="sp-lp-title">' + escapeHtml(rec.title) + "</h4>" +
        '  <p class="sp-lp-reason">' + escapeHtml(rec.message) + "</p>";
      if (canSchedule) {
        html +=
          '  <button type="button" class="btn btn-primary btn-sm" data-lp-add=\'' +
          jsonAttr({ title: rec.title, type: taskType, courseId: String(courseId), lessonId: rec.lessonId !== undefined ? String(rec.lessonId) : null, quizId: rec.quizId !== undefined ? rec.quizId : null }) +
          "'>Add to Planner</button>" +
          "</article>";
      } else {
        html += '  <span class="sp-badge sp-badge-completed">Completed</span></article>';
      }
      shown++;
    }

    if (!shown) {
      container.innerHTML = '<p class="sp-empty-sm">Enroll in a course to see recommended next steps.</p>';
      return;
    }
    container.innerHTML = html;
  }

  // ==================================================
  // UPCOMING
  // ==================================================

  function renderUpcoming() {
    var container = el("spUpcoming");
    if (!container) return;
    var tasks = readTasks();
    var upcoming = [];
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (t.effectiveStatus === "pending" || t.effectiveStatus === "in progress") upcoming.push(t);
    }
    upcoming.sort(function (a, b) {
      var da = parseYmd(a.date);
      var db = parseYmd(b.date);
      var ta = da ? da.getTime() : 0;
      var tb = db ? db.getTime() : 0;
      if (ta !== tb) return ta - tb;
      return String(a.time || "").localeCompare(String(b.time || ""));
    });
    upcoming = upcoming.slice(0, 5);

    if (!upcoming.length) {
      container.innerHTML = '<p class="sp-empty-sm">No upcoming study tasks.</p>';
      return;
    }
    var html = "";
    for (var u = 0; u < upcoming.length; u++) {
      html +=
        '<div class="sp-up-item">' +
        '  <span class="sp-up-dot"></span>' +
        '  <div class="sp-up-info">' +
        '    <p class="sp-up-title">' + escapeHtml(upcoming[u].title) + "</p>" +
        '    <p class="sp-up-when">' + displayDate(upcoming[u].date) + (upcoming[u].time ? " at " + displayTime(upcoming[u].time) : "") + "</p>" +
        "  </div>" +
        '  <span class="sp-prio ' + priorityClass(upcoming[u].priority) + '">' + escapeHtml(upcoming[u].priority) + "</span>" +
        "</div>";
    }
    container.innerHTML = html;
  }

  // ==================================================
  // NEEDS ATTENTION (OVERDUE)
  // ==================================================

  function renderNeedsAttention() {
    var container = el("spNeedsAttention");
    if (!container) return;
    var tasks = readTasks();
    var overdue = [];
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].effectiveStatus === "overdue") overdue.push(tasks[i]);
    }

    if (!overdue.length) {
      container.innerHTML = '<p class="sp-empty-sm">No overdue tasks. Great job staying on track!</p>';
      return;
    }

    var html = "";
    for (var o = 0; o < overdue.length; o++) {
      var t = overdue[o];
      html +=
        '<article class="sp-na-item" data-id="' + escapeHtml(t.id) + '">' +
        '  <p class="sp-na-title"><span class="sp-na-warn">&#9888;</span> ' + escapeHtml(t.title) + "</p>" +
        '  <p class="sp-na-when">Was scheduled ' + displayDate(t.date) + (t.time ? " at " + displayTime(t.time) : "") + "</p>" +
        '  <div class="sp-na-actions">' +
        '    <button type="button" class="btn btn-primary btn-sm" data-complete="' + escapeHtml(t.id) + '">Mark Complete</button>' +
        '    <button type="button" class="btn btn-ghost btn-sm" data-reschedule="' + escapeHtml(t.id) + '">Reschedule</button>' +
        '    <button type="button" class="btn btn-ghost btn-sm" data-edit="' + escapeHtml(t.id) + '">Edit</button>' +
        "  </div>" +
        "</article>";
    }
    container.innerHTML = html;
  }

  // ==================================================
  // SUGGESTED STUDY TASKS
  // ==================================================

  function renderSuggestions() {
    var container = el("spSuggestions");
    if (!container) return;
    var suggestions = [];
    try { suggestions = api.getSuggestedStudyTasks(); } catch (e) {}
    if (!Array.isArray(suggestions) || !suggestions.length) {
      container.innerHTML = '<p class="sp-empty-sm">No suggestions yet. Keep learning and add your own plan.</p>';
      return;
    }

    var html = "";
    for (var i = 0; i < suggestions.length; i++) {
      var s = suggestions[i];
      html +=
        '<article class="sp-suggestion">' +
        '  <div class="sp-suggestion-head">' +
        '    <span class="sp-badge sp-badge-type">' + escapeHtml(s.taskType) + "</span>" +
        '    <span class="sp-prio ' + priorityClass(s.priority) + '">' + escapeHtml(s.priority) + "</span>" +
        "  </div>" +
        '  <h4 class="sp-suggestion-title">' + escapeHtml(s.title) + "</h4>" +
        '  <p class="sp-suggestion-reason">' + escapeHtml(s.reason || s.topic || "") + "</p>" +
        '  <button type="button" class="btn btn-primary btn-sm" data-suggest=\'' +
        jsonAttr({ title: s.title, type: s.taskType, courseId: s.courseId !== undefined && s.courseId !== null ? String(s.courseId) : null, lessonId: s.lessonId !== undefined ? String(s.lessonId) : null, topic: s.topic || "" }) +
        "'>Add to Planner</button>" +
        "</article>";
    }
    container.innerHTML = html;
  }

  // ==================================================
  // CALENDAR
  // ==================================================

  function renderCalendar() {
    var grid = el("spCalendar");
    var title = el("spCalendarTitle");
    if (!grid) return;

    var today = new Date();
    if (!state.calMonth && !state.calYear) {
      state.calMonth = today.getMonth();
      state.calYear = today.getFullYear();
    }
    if (title) title.textContent = MONTHS[state.calMonth] + " " + state.calYear;

    var tasks = readTasks();
    var todayStr = todayYmd();
    var first = new Date(state.calYear, state.calMonth, 1);
    var startDow = first.getDay();
    var daysInMonth = new Date(state.calYear, state.calMonth + 1, 0).getDate();

    var html = "";
    for (var w = 0; w < 7; w++) {
      html += '<span class="sp-cal-cell sp-cal-head">' + WEEKDAYS[w] + "</span>";
    }
    for (var b = 0; b < startDow; b++) {
      html += '<span class="sp-cal-cell sp-cal-blank"></span>';
    }
    for (var d = 1; d <= daysInMonth; d++) {
      var key = state.calYear + "-" + pad2(state.calMonth + 1) + "-" + pad2(d);
      var hasTasks = false;
      for (var t = 0; t < tasks.length; t++) {
        if (tasks[t].date === key) { hasTasks = true; break; }
      }
      var cls = "sp-cal-cell sp-cal-day";
      if (key === todayStr) cls += " today";
      if (state.focusDate === key) cls += " selected";
      if (hasTasks) cls += " has-tasks";
      html +=
        '<button type="button" class="' + cls + '" data-date="' + key + '" aria-label="' + displayDate(key) + '">' +
        "  " + d + (hasTasks ? '<span class="sp-cal-dot"></span>' : "") +
        "</button>";
    }
    grid.innerHTML = html;

    renderCalendarDayTasks();
  }

  function renderCalendarDayTasks() {
    var container = el("spCalendarDayTasks");
    var title = el("spCalendarDayTitle");
    if (!container) return;
    if (!state.focusDate) {
      if (title) title.textContent = "Click a day to see its tasks";
      container.innerHTML = "";
      return;
    }
    if (title) title.textContent = displayDate(state.focusDate);
    var tasks = readTasks();
    var todays = [];
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].date === state.focusDate) todays.push(tasks[i]);
    }
    if (!todays.length) {
      container.innerHTML = '<p class="sp-empty-sm">No study tasks on this day.</p>';
      return;
    }
    container.innerHTML = todays.map(taskRowHtml).join("");
  }

  // ==================================================
  // MODALS
  // ==================================================

  function openTaskModal(prefill) {
    var modal = el("spTaskModal");
    if (!modal) return;
    state.editingId = null;
    state.reschedule = false;

    el("spModalTitle").textContent = "Add Study Task";
    el("spTaskSaveBtn").textContent = "Add Task";
    el("spFormError").hidden = true;

    resetTaskForm();
    if (prefill) {
      if (prefill.title !== undefined) el("spTaskTitle").value = prefill.title || "";
      if (prefill.type) el("spTaskType").value = prefill.type;
      if (prefill.courseId) {
        el("spTaskCourse").value = prefill.courseId;
        if (prefill.lessonId) fillLessonOptions(prefill.courseId);
      }
      if (prefill.lessonId) el("spTaskLesson").value = prefill.lessonId;
      if (prefill.topic !== undefined) el("spTaskTopic").value = prefill.topic;
      if (prefill.duration !== undefined) el("spTaskDuration").value = prefill.duration;
      if (prefill.priority) el("spTaskPriority").value = prefill.priority;
    }

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    el("spTaskTitle").focus();
    hideRescheduleOnly(false);
  }

  function openEditModal(taskId) {
    var task = api.getStudyTask(taskId);
    if (!task) { toast("Study task not found."); return; }
    var modal = el("spTaskModal");
    if (!modal) return;
    state.editingId = taskId;
    state.reschedule = false;

    el("spModalTitle").textContent = "Edit Study Task";
    el("spTaskSaveBtn").textContent = "Save Changes";
    el("spFormError").hidden = true;

    el("spTaskTitle").value = task.title || "";
    el("spTaskType").value = task.type || "Custom Study";
    el("spTaskPriority").value = task.priority || "Medium";
    el("spTaskDate").value = task.date || todayYmd();
    el("spTaskTime").value = task.time || "";
    el("spTaskDuration").value = task.duration ? String(task.duration) : "";
    el("spTaskNotes").value = task.notes || "";
    el("spTaskTopic").value = task.topic || "";

    if (task.courseId !== undefined && task.courseId !== null) {
      el("spTaskCourse").value = String(task.courseId);
      if (task.lessonId) fillLessonOptions(String(task.courseId));
    } else {
      el("spTaskCourse").value = "";
    }
    if (task.lessonId) el("spTaskLesson").value = String(task.lessonId);

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    hideRescheduleOnly(false);
  }

  function openRescheduleModal(taskId) {
    var task = api.getStudyTask(taskId);
    if (!task) { toast("Study task not found."); return; }
    var modal = el("spTaskModal");
    if (!modal) return;
    state.editingId = taskId;
    state.reschedule = true;

    el("spModalTitle").textContent = "Reschedule Study Task";
    el("spTaskSaveBtn").textContent = "Update Schedule";
    el("spFormError").hidden = true;

    el("spTaskTitle").value = task.title || "";
    el("spTaskDate").value = task.date || todayYmd();
    el("spTaskTime").value = task.time || "";

    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    hideRescheduleOnly(true);
  }

  function hideRescheduleOnly(rescheduleMode) {
    var fields = ["spTaskType", "spTaskPriority", "spTaskCourse", "spTaskLesson", "spTaskTopic", "spTaskNotes", "spTaskDuration"];
    for (var i = 0; i < fields.length; i++) {
      var node = el(fields[i]);
      if (!node) continue;
      var wrap = node.closest(".sp-field") || node.parentNode;
      wrap.style.display = rescheduleMode ? "none" : "";
    }
  }

  function closeTaskModal() {
    var modal = el("spTaskModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function resetTaskForm() {
    el("spTaskTitle").value = "";
    el("spTaskType").value = "Lesson";
    el("spTaskPriority").value = "Medium";
    el("spTaskDate").value = todayYmd();
    el("spTaskTime").value = "";
    el("spTaskDuration").value = "";
    el("spTaskCourse").value = "";
    el("spTaskTopic").value = "";
    el("spTaskNotes").value = "";
    fillLessonOptions(null);
  }

  function submitTaskForm() {
    var title = el("spTaskTitle").value.trim();
    var date = el("spTaskDate").value;
    var time = el("spTaskTime").value;
    var error = el("spFormError");

    if (!title) { showFormError("A title is required."); return; }
    if (!date) { showFormError("Please choose a date."); return; }
    if (!time) { showFormError("Please choose a time."); return; }

    if (state.reschedule && state.editingId) {
      var res = api.updateStudyTask(state.editingId, { date: date, time: time });
      if (res && res.success) {
        toast("Task rescheduled!");
        closeTaskModal();
        refresh();
      } else {
        showFormError((res && res.message) || "Could not reschedule the task.");
      }
      return;
    }

    var payload = {
      title: title,
      date: date,
      time: time,
      type: el("spTaskType").value,
      priority: el("spTaskPriority").value,
      duration: Number(el("spTaskDuration").value) || 0,
      notes: el("spTaskNotes").value.trim(),
      topic: el("spTaskTopic").value.trim(),
      courseId: el("spTaskCourse").value ? Number(el("spTaskCourse").value) : null,
      lessonId: el("spTaskLesson").value ? el("spTaskLesson").value : null,
    };

    var result;
    if (state.editingId) {
      result = api.updateStudyTask(state.editingId, payload);
    } else {
      result = api.createStudyTask(payload);
    }

    if (result && result.success) {
      toast(state.editingId ? "Study task updated." : "Study task created.");
      closeTaskModal();
      refresh();
    } else {
      showFormError((result && result.message) || "Could not save the study task.");
    }
  }

  function showFormError(message) {
    var error = el("spFormError");
    if (!error) return;
    error.textContent = message;
    error.hidden = false;
  }

  function openConfirmModal(text) {
    el("spConfirmText").textContent = text;
    el("spConfirmModal").style.display = "flex";
    el("spConfirmModal").setAttribute("aria-hidden", "false");
  }

  function closeConfirmModal() {
    el("spConfirmModal").style.display = "none";
    el("spConfirmModal").setAttribute("aria-hidden", "true");
  }

  // ==================================================
  // ACTIONS
  // ==================================================

  function toggleComplete(taskId, checked) {
    if (checked) {
      var res = api.completeStudyTask(taskId);
      toast(res && res.success ? "Great job! Task completed." : (res && res.message) || "Task unavailable.");
    } else {
      api.updateStudyTask(taskId, { status: "pending" });
      toast("Task marked as pending.");
    }
    refresh();
  }

  // ==================================================
  // EVENT BINDINGS
  // ==================================================

  function bindControls() {
    var toggle = el("spViewToggle");
    if (toggle) {
      toggle.addEventListener("click", function (e) {
        var btn = e.target.closest(".sp-view-btn");
        if (!btn) return;
        state.view = btn.getAttribute("data-view") === "calendar" ? "calendar" : "list";
        try { localStorage.setItem(VIEW_STORAGE_KEY, state.view); } catch (err) {}
        refresh();
      });
    }

    var search = el("spSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.search = search.value.trim();
        renderTaskList();
      });
    }

    var statusTabs = el("spStatusTabs");
    if (statusTabs) {
      statusTabs.addEventListener("click", function (e) {
        var btn = e.target.closest(".sp-status-tab");
        if (!btn) return;
        state.statusTab = btn.getAttribute("data-status");
        state.focusDate = null;
        buildStatusTabs();
        refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    var typeSel = el("spTypeFilter");
    if (typeSel) typeSel.addEventListener("change", function () { state.typeFilter = typeSel.value; refresh(); });

    var prioSel = el("spPriorityFilter");
    if (prioSel) prioSel.addEventListener("change", function () { state.priorityFilter = prioSel.value; refresh(); });

    var courseSel = el("spCourseFilter");
    if (courseSel) courseSel.addEventListener("change", function () { state.courseFilter = courseSel.value; refresh(); });

    var clearBtn = el("spClearFilters");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        state.search = "";
        state.typeFilter = "all";
        state.priorityFilter = "all";
        state.courseFilter = "all";
        state.statusTab = "all";
        state.focusDate = null;
        if (search) search.value = "";
        if (typeSel) typeSel.value = "all";
        if (prioSel) prioSel.value = "all";
        if (courseSel) courseSel.value = "all";
        buildStatusTabs();
        refresh();
      });
    }
  }

  function bindModals() {
    var modal = el("spTaskModal");
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeTaskModal();
      });
    }
    var cancelBtn = el("spTaskCancelBtn");
    if (cancelBtn) cancelBtn.addEventListener("click", closeTaskModal);

    var form = el("spTaskForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        submitTaskForm();
      });
    }

    var taskCourse = el("spTaskCourse");
    if (taskCourse) {
      taskCourse.addEventListener("change", function () {
        fillLessonOptions(taskCourse.value ? taskCourse.value : null);
      });
    }

    var confirmModal = el("spConfirmModal");
    if (confirmModal) {
      confirmModal.addEventListener("click", function (e) {
        if (e.target === confirmModal) closeConfirmModal();
      });
    }
    var confirmNo = el("spConfirmNo");
    if (confirmNo) confirmNo.addEventListener("click", closeConfirmModal);

    var confirmYes = el("spConfirmYes");
    if (confirmYes) {
      confirmYes.addEventListener("click", function () {
        if (state.deletingId) {
          var res = api.deleteStudyTask(state.deletingId);
          toast(res && res.success ? "Study task deleted." : (res && res.message) || "Task unavailable.");
        }
        state.deletingId = null;
        closeConfirmModal();
        refresh();
      });
    }
  }

  function bindActions() {
    var addBtn = el("spAddTaskBtn");
    if (addBtn) addBtn.addEventListener("click", function () { openTaskModal(); });
    var addBtn2 = el("spAddTaskBtn2");
    if (addBtn2) addBtn2.addEventListener("click", function () { openTaskModal(); });

    var calToday = el("spCalToday");
    if (calToday) {
      calToday.addEventListener("click", function () {
        var now = new Date();
        state.calYear = now.getFullYear();
        state.calMonth = now.getMonth();
        renderCalendar();
      });
    }
    var calPrev = el("spCalPrev");
    if (calPrev) {
      calPrev.addEventListener("click", function () {
        state.calMonth--;
        if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
        renderCalendar();
      });
    }
    var calNext = el("spCalNext");
    if (calNext) {
      calNext.addEventListener("click", function () {
        state.calMonth++;
        if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
        renderCalendar();
      });
    }
  }

  function bindDynamicClicks(root) {
    var handler = function (e) {
      var node = e.target;
      if (root && root !== e.currentTarget) return;

      var weekDay = e.target.closest(".sp-week-day");
      if (weekDay) {
        state.focusDate = weekDay.getAttribute("data-date");
        state.statusTab = "all";
        if (state.view !== "calendar") {
          state.view = "calendar";
          try { localStorage.setItem(VIEW_STORAGE_KEY, "calendar"); } catch (err) {}
        }
        buildStatusTabs();
        refresh();
        return;
      }

      var calDay = e.target.closest(".sp-cal-day");
      if (calDay) {
        state.focusDate = calDay.getAttribute("data-date");
        renderCalendar();
        return;
      }
    };
    document.addEventListener("click", handler);
  }

  function bindDocumentActions() {
    document.addEventListener("click", function (e) {
      var completeBtn = e.target.closest("[data-complete]");
      if (completeBtn) {
        var id = completeBtn.getAttribute("data-complete");
        var isCheckbox = completeBtn.tagName === "INPUT";
        toggleComplete(id, isCheckbox ? completeBtn.checked : true);
        return;
      }

      var editBtn = e.target.closest("[data-edit]");
      if (editBtn) {
        openEditModal(editBtn.getAttribute("data-edit"));
        return;
      }

      var rescheduleBtn = e.target.closest("[data-reschedule]");
      if (rescheduleBtn) {
        openRescheduleModal(rescheduleBtn.getAttribute("data-reschedule"));
        return;
      }

      var deleteBtn = e.target.closest("[data-delete]");
      if (deleteBtn) {
        state.deletingId = deleteBtn.getAttribute("data-delete");
        openConfirmModal("Are you sure you want to delete this study task?");
        return;
      }

      var suggestBtn = e.target.closest("[data-suggest]");
      if (suggestBtn) {
        var payload = {};
        try { payload = JSON.parse(suggestBtn.getAttribute("data-suggest")) || {}; } catch (err) { payload = {}; }
        var prefill = {
          title: payload.title || "",
          type: payload.type || "Custom Study",
          courseId: payload.courseId || null,
          lessonId: payload.lessonId || null,
          topic: payload.topic || "",
        };
        openTaskModal(prefill);
        return;
      }

      var lpAdd = e.target.closest("[data-lp-add]");
      if (lpAdd) {
        var lpPayload = {};
        try { lpPayload = JSON.parse(lpAdd.getAttribute("data-lp-add")) || {}; } catch (err) { lpPayload = {}; }
        var lpPrefill = {
          title: lpPayload.title || "",
          type: lpPayload.type || "Lesson",
          courseId: lpPayload.courseId || null,
          lessonId: lpPayload.lessonId || null,
        };
        openTaskModal(lpPrefill);
        return;
      }
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeTaskModal();
      closeConfirmModal();
    }
  });

  var winReady = false;
  function whenready() {
    if (winReady) return;
    winReady = true;
  }
  whenready();

  // ==================================================
  // PUBLIC API
  // ==================================================

  return {
    init: function () {
      init();
      bindDynamicClicks();
      bindDocumentActions();
      populateCourseFilter();
      populateCourseSelects();
    },
  };
})();

// Safe delegation helper for .closest on older engines.
if (!Element.prototype.closest) {
  Element.prototype.closest = function (selector) {
    var elc = this;
    while (elc && elc.nodeType === 1) {
      if (matchesSelector(elc, selector)) return elc;
      elc = elc.parentNode;
    }
    return null;
  };
  function matchesSelector(elc, selector) {
    var parts = selector.split(".");
    var tag = parts[0] || "*";
    var cls = parts.slice(1);
    if (tag !== "*" && elc.tagName && elc.tagName.toLowerCase() !== tag.toLowerCase()) return false;
    for (var i = 0; i < cls.length; i++) {
      if (!elc.classList || !elc.classList.contains(cls[i])) return false;
    }
    return true;
  }
}