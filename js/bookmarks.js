/**
 * AI-Learning System - Saved Learning (Bookmarks) module.
 * Per-user bookmarks backed by api.js (ai_learning_bookmarks) so the
 * future backend can swap LocalStorage for Flask + MySQL without
 * touching this page.
 */
var LearnSphereBookmarks = (function () {
  "use strict";

  var BOOT_URLS = [
    "../data/courses.json",
    "../data/lessons.json",
  ];

  var allCourses = [];
  var lessonMap = {};
  var state = { filter: "all", search: "", sort: "recent" };
  var toastTimer = null;

  // ==================================================
  // INIT
  // ==================================================

  function init() {
    if (!auth.isLoggedIn()) {
      var current = window.location.href;
      window.location.href =
        "login.html" + (current ? "?redirect=" + encodeURIComponent(current) : "");
      return;
    }

    showLoading();
    loadBootData()
      .then(function (results) {
        api.initCourseData(results[0], results[1]);
        allCourses = Array.isArray(results[0]) ? results[0] : [];
        buildLessonMap(Array.isArray(results[1]) ? results[1] : []);
        refresh();
      })
      .catch(function () {
        showError();
      });
  }

  function loadBootData() {
    return Promise.all(BOOT_URLS.map(function (url) {
      return fetch(url).then(function (response) {
        return response.json();
      });
    }));
  }

  function buildLessonMap(lessons) {
    lessonMap = {};
    for (var i = 0; i < lessons.length; i++) {
      var lesson = lessons[i];
      if (!lesson || lesson.courseId === undefined || lesson.courseId === null || !lesson.lessonId) continue;
      lessonMap[String(lesson.courseId) + ":" + String(lesson.lessonId)] = lesson;
    }
  }

  // ==================================================
  // DATA RESOLUTION
  // ==================================================

  function findCourse(courseId) {
    if (courseId === undefined || courseId === null) return null;
    for (var i = 0; i < allCourses.length; i++) {
      if (String(allCourses[i].id) === String(courseId)) return allCourses[i];
    }
    return null;
  }

  function findLesson(courseId, lessonId) {
    if (courseId === undefined || courseId === null || lessonId === undefined || lessonId === null) return null;
    return lessonMap[String(courseId) + ":" + String(lessonId)] || null;
  }

  function findModuleTitle(course, lesson) {
    if (!course || !course.curriculum || !lesson || !lesson.moduleId) return "";
    for (var m = 0; m < course.curriculum.length; m++) {
      if (String(course.curriculum[m].id) === String(lesson.moduleId)) {
        return course.curriculum[m].title || "";
      }
    }
    return "";
  }

  function resolveItems() {
    var raw = api.getBookmarks();
    if (!Array.isArray(raw)) raw = [];
    var resolved = [];
    for (var i = 0; i < raw.length; i++) {
      var item = raw[i];
      if (!item || !item.id || !item.type) continue;
      var course = findCourse(item.courseId);
      if (item.type === "course") {
        if (!course) continue;
        resolved.push({ item: item, course: course });
      } else if (item.type === "lesson") {
        var lesson = findLesson(item.courseId, item.lessonId);
        if (!course || !lesson) continue;
        resolved.push({
          item: item,
          course: course,
          lesson: lesson,
          moduleTitle: findModuleTitle(course, lesson),
        });
      }
    }
    return resolved;
  }

  // ==================================================
  // FILTER / SORT / SEARCH
  // ==================================================

  function matchesSearch(entry) {
    if (!state.search) return true;
    var q = state.search.toLowerCase();
    var haystack = "";
    if (entry.course) {
      haystack += " " + (entry.course.title || "") + " " + (entry.course.category || "");
      if (Array.isArray(entry.course.tags)) haystack += " " + entry.course.tags.join(" ");
    }
    if (entry.lesson) {
      haystack += " " + (entry.lesson.title || "");
      if (entry.lesson.topic) haystack += " " + entry.lesson.topic;
    }
    if (entry.moduleTitle) haystack += " " + entry.moduleTitle;
    return haystack.toLowerCase().indexOf(q) !== -1;
  }

  function titleFor(entry) {
    if (entry.lesson) return entry.lesson.title || "";
    return entry.course ? entry.course.title || "" : "";
  }

  function sortEntries(a, b) {
    switch (state.sort) {
      case "oldest":
        return savedTime(a) - savedTime(b);
      case "az":
        return titleFor(a).localeCompare(titleFor(b));
      case "za":
        return titleFor(b).localeCompare(titleFor(a));
      case "recent":
      default:
        return savedTime(b) - savedTime(a);
    }
  }

  function savedTime(entry) {
    var t = Date.parse(entry.item.savedAt);
    if (isNaN(t)) return Date.parse(entry.item.createdAt) || 0;
    return t;
  }

  function focusedEntries(entries) {
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (state.filter === "course" && entry.item.type !== "course") continue;
      if (state.filter === "lesson" && entry.item.type !== "lesson") continue;
      if (!matchesSearch(entry)) continue;
      out.push(entry);
    }
    out.sort(sortEntries);
    return out;
  }

  // ==================================================
  // LOADING / ERROR / EMPTY STATES
  // ==================================================

  function showLoading() {
    setSummary(0, 0, 0);
    document.getElementById("bmEmpty").hidden = true;
    document.getElementById("bmFilterEmpty").hidden = true;
    document.getElementById("bmSearchEmpty").hidden = true;
    var grid = document.getElementById("bmGrid");
    if (grid) {
      grid.innerHTML = '<div class="bm-loading">Loading saved learning...</div>';
    }
  }

  function showError() {
    setSummary(0, 0, 0);
    document.getElementById("bmEmpty").hidden = true;
    document.getElementById("bmFilterEmpty").hidden = true;
    document.getElementById("bmSearchEmpty").hidden = true;
    var grid = document.getElementById("bmGrid");
    if (grid) {
      grid.innerHTML =
        '<div class="bm-error">' +
        '  <div class="bm-error-icon">&#9888;</div>' +
        '  <h3 class="bm-empty-title">We couldn\'t load your saved learning right now.</h3>' +
        '  <button type="button" class="btn btn-secondary btn-sm" id="bmRetry">Retry</button>' +
        "</div>";
      var retry = document.getElementById("bmRetry");
      if (retry) retry.addEventListener("click", init);
    }
  }

  function setSummary(total, courses, lessons) {
    document.getElementById("bmSummary").innerHTML =
      '<div class="bm-stat">' +
      '  <span class="bm-stat-value">' + total + "</span>" +
      '  <span class="bm-stat-label">Total Saved</span>' +
      "</div>" +
      '<div class="bm-stat">' +
      '  <span class="bm-stat-value">' + courses + "</span>" +
      '  <span class="bm-stat-label">Saved Courses</span>' +
      "</div>" +
      '<div class="bm-stat">' +
      '  <span class="bm-stat-value">' + lessons + "</span>" +
      '  <span class="bm-stat-label">Saved Lessons</span>' +
      "</div>";
  }

  // ==================================================
  // RENDER
  // ==================================================

  function refresh() {
    var resolved = resolveItems();
    var courseCount = 0;
    for (var i = 0; i < resolved.length; i++) {
      if (resolved[i].item.type === "course") courseCount++;
    }
    setSummary(resolved.length, courseCount, resolved.length - courseCount);

    var entries = focusedEntries(resolved);
    renderGrid(entries, resolved.length);
  }

  function renderGrid(entries, total) {
    var grid = document.getElementById("bmGrid");
    var empty = document.getElementById("bmEmpty");
    var filterEmpty = document.getElementById("bmFilterEmpty");
    var searchEmpty = document.getElementById("bmSearchEmpty");

    empty.hidden = true;
    filterEmpty.hidden = true;
    searchEmpty.hidden = true;

    if (total === 0) {
      if (grid) grid.innerHTML = "";
      empty.hidden = false;
      return;
    }

    if (entries.length === 0) {
      if (grid) grid.innerHTML = "";
      if (state.search) {
        searchEmpty.hidden = false;
      } else {
        var filterTitle = document.getElementById("bmFilterEmptyTitle");
        if (filterTitle) {
          filterTitle.textContent =
            state.filter === "course"
              ? "No saved courses found."
              : state.filter === "lesson"
                ? "No saved lessons found."
                : "No saved learning found.";
        }
        filterEmpty.hidden = false;
      }
      return;
    }

    var html = "";
    for (var i = 0; i < entries.length; i++) {
      html += renderEntry(entries[i]);
    }
    grid.innerHTML = html;
  }

  function renderEntry(entry) {
    if (entry.item.type === "lesson") return renderLessonCard(entry);
    return renderCourseCard(entry);
  }

  function thumbStyle(thumb) {
    var map = {
      dsa: "linear-gradient(135deg,#2563EB,#0891B2)",
      python: "linear-gradient(135deg,#059669,#06B6D4)",
      webdev: "linear-gradient(135deg,#2563EB,#7C3AED)",
      dbms: "linear-gradient(135deg,#D97706,#EA580C)",
      ai: "linear-gradient(135deg,#7C3AED,#2563EB)",
      excel: "linear-gradient(135deg,#059669,#10B981)",
      testing: "linear-gradient(135deg,#DC2626,#F59E0B)",
      java: "linear-gradient(135deg,#DC2626,#2563EB)",
      cyber: "linear-gradient(135deg,#0F766E,#2563EB)",
    };
    return map[thumb] || "linear-gradient(135deg,#2563EB,#06B6D4)";
  }

  function thumbIcon(thumb) {
    var map = {
      dsa: "&#128218;",
      python: "&#128013;",
      webdev: "&#127760;",
      dbms: "&#128451;",
      ai: "&#129302;",
      excel: "&#128202;",
      testing: "&#9989;",
      java: "&#9749;",
      cyber: "&#128737;",
    };
    return map[thumb] || "&#128218;";
  }

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.substring(0, len) + "..." : str;
  }

  function formatDate(savedAt) {
    var t = Date.parse(savedAt);
    if (isNaN(t)) return "";
    var d = new Date(t);
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }

  function renderCourseCard(entry) {
    var course = entry.course;
    var progress = api.getCourseProgress(course.id);
    var enrolled = progress !== null && progress !== undefined;
    var pct = enrolled && progress.progressPercentage !== undefined ? progress.progressPercentage : 0;
    var style = thumbStyle(course.thumbnail);
    var icon = thumbIcon(course.thumbnail);
    var levelClass = (course.level || "").toLowerCase();
    var progressHtml = "";
    if (enrolled) {
      progressHtml =
        '<div class="bm-progress">' +
        '  <div class="bm-progress-header">' +
        "    <span>" + progress.completedCount + "/" + progress.totalCount + " lessons</span>" +
        '    <span>' + pct + "%</span>" +
        "  </div>" +
        '  <div class="bm-progress-bar"><div class="bm-progress-fill" style="width:' + pct + '%;"></div></div>' +
        "</div>";
    }

    return (
      '<article class="bm-card bm-course-card">' +
      '  <div class="bm-thumb" style="background:' + style + ';">' +
      '    <span class="bm-thumb-icon">' + icon + "</span>" +
      "  </div>" +
      '  <div class="bm-card-body">' +
      '    <div class="bm-meta">' +
      '      <span class="bm-category">' + escapeHtml(course.category || "Course") + "</span>" +
      '      <span class="bm-difficulty ' + escapeHtml(levelClass) + '">' + escapeHtml(course.level || "") + "</span>" +
      "    </div>" +
      '    <h3 class="bm-title"><a href="course-details.html?id=' + encodeURIComponent(course.id) + '">' + escapeHtml(course.title) + "</a></h3>" +
      '    <p class="bm-desc">' + escapeHtml(truncate(course.description, 110)) + "</p>" +
      '    <div class="bm-info">' +
      "      <span>&#128214; " + escapeHtml(course.lessonsCount) + " lessons</span>" +
      "      <span>&#128337; " + escapeHtml(course.duration || "") + "</span>" +
      "    </div>" +
      progressHtml +
      '    <div class="bm-saved-on">Saved ' + escapeHtml(formatDate(entry.item.savedAt)) + "</div>" +
      '    <div class="bm-actions">' +
      '      <a href="course-details.html?id=' + encodeURIComponent(course.id) + '" class="btn btn-primary btn-sm">' +
      (enrolled ? "Continue Learning" : "Start Learning") +
      "      </a>" +
      '      <button type="button" class="btn btn-ghost btn-sm bm-remove" data-remove="' + escapeHtml(entry.item.id) + '" data-type="course" aria-label="Remove ' + escapeHtml(course.title) + " from bookmarks\">Remove</button>" +
      "    </div>" +
      "  </div>" +
      "</article>"
    );
  }

  function lessonStatus(courseId, lessonId) {
    var complete = api.isLessonComplete(courseId, lessonId);
    if (complete) return "Completed";
    var progress = api.getCourseProgress(courseId);
    if (progress && progress.completedCount > 0) return "In Progress";
    return "Not Started";
  }

  function typeIcon(type) {
    var map = {
      video: "&#9654;",
      reading: "&#128214;",
      practice: "&#9997;",
      quiz: "&#128221;",
    };
    return map[type] || "&#128214;";
  }

  function renderLessonCard(entry) {
    var course = entry.course;
    var lesson = entry.lesson;
    var status = lessonStatus(course.id, lesson.lessonId);
    var statusClass = status === "Completed" ? "done" : status === "In Progress" ? "progress" : "todo";
    var openUrl =
      "lesson.html?course=" + encodeURIComponent(course.id) + "&lesson=" + encodeURIComponent(lesson.lessonId);

    return (
      '<article class="bm-card bm-lesson-card">' +
      '  <div class="bm-lesson-icon" aria-hidden="true">' + typeIcon(lesson.type) + "</div>" +
      '  <div class="bm-card-body">' +
      '    <div class="bm-meta">' +
      '      <span class="bm-category">' + escapeHtml(course.title || "Course") + "</span>" +
      '      <span class="bm-lesson-type">' + escapeHtml(lesson.type || "") + "</span>" +
      "    </div>" +
      '    <h3 class="bm-title"><a href="' + openUrl + '">' + escapeHtml(lesson.title) + "</a></h3>" +
      '    <p class="bm-module">' + (entry.moduleTitle ? "Module: " + escapeHtml(entry.moduleTitle) : "") + "</p>" +
      '    <div class="bm-info">' +
      "      <span>&#128337; " + escapeHtml(lesson.duration || "") + "</span>" +
      "    </div>" +
      '    <div class="bm-status-row">' +
      '      <span class="bm-status ' + statusClass + '">' + status + "</span>" +
      '      <span class="bm-saved-on">Saved ' + escapeHtml(formatDate(entry.item.savedAt)) + "</span>" +
      "    </div>" +
      '    <div class="bm-actions">' +
      '      <a href="' + openUrl + '" class="btn btn-primary btn-sm">Open Lesson</a>' +
      '      <button type="button" class="btn btn-ghost btn-sm bm-remove" data-remove="' + escapeHtml(entry.item.id) + '" data-type="lesson" aria-label="Remove ' + escapeHtml(lesson.title) + " from bookmarks\">Remove</button>" +
      "    </div>" +
      "  </div>" +
      "</article>"
    );
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ==================================================
  // REMOVE / TOAST
  // ==================================================

  function removeBookmark(itemId, type) {
    var result = api.removeBookmark(itemId, type);
    if (!result || !result.success) {
      toast("Could not remove bookmark.");
      return;
    }
    toast("Bookmark removed.");
    refresh();
  }

  function toast(message) {
    var node = document.getElementById("bmToast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove("show");
    }, 2600);
  }

  // ==================================================
  // EVENTS
  // ==================================================

  function bindControls() {
    var tabs = document.querySelectorAll(".bm-tab");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.filter = tab.getAttribute("data-filter") || "all";
        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle("active", active);
          t.setAttribute("aria-selected", active ? "true" : "false");
        });
        refresh();
      });
    });

    var search = document.getElementById("bmSearch");
    if (search) {
      search.addEventListener("input", function () {
        state.search = search.value.trim();
        refresh();
      });
    }

    var sort = document.getElementById("bmSort");
    if (sort) {
      sort.addEventListener("change", function () {
        state.sort = sort.value;
        refresh();
      });
    }

    var clearSearch = document.getElementById("bmClearSearch");
    if (clearSearch) {
      clearSearch.addEventListener("click", function () {
        state.search = "";
        if (search) search.value = "";
        refresh();
      });
    }

    var grid = document.getElementById("bmGrid");
    if (grid) {
      grid.addEventListener("click", function (e) {
        var removeBtn = e.target.closest ? e.target.closest("[data-remove]") : null;
        if (!removeBtn) return;
        e.preventDefault();
        removeBookmark(
          removeBtn.getAttribute("data-remove"),
          removeBtn.getAttribute("data-type") || undefined
        );
      });
    }
  }

  // ==================================================
  // PUBLIC
  // ==================================================

  function initModule() {
    bindControls();
    init();
  }

  return {
    init: initModule,
  };
})();