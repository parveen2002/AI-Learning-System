/* ============================================
   AI-Learning System - Courses Page Module
   ============================================
   Handles course listing, search, filtering,
   sorting, and bookmarking on the courses page.
   ============================================ */

var LearnSphereCourses = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var allCourses = [];
  var filteredCourses = [];

  // ==================================================
  // QUERY PARAM
  // ==================================================

  function getQueryParam(name) {
    var qs = window.location.search.substring(1);
    if (!qs) return "";
    var parts = qs.split("&");
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split("=");
      if (kv[0] === name) return decodeURIComponent(kv[1] || "");
    }
    return "";
  }

  // ==================================================
  // INIT
  // ==================================================

  function init(coursesJson) {
    api.initCourseData(coursesJson, null);
    allCourses = api.getCourses() || [];
    filteredCourses = allCourses.slice();

    var query = getQueryParam("q");
    if (query) {
      var searchInput = document.getElementById("courseSearch");
      if (searchInput) searchInput.value = query;
    }

    setupSearch();
    setupFilters();
    setupSort();
    setupClearFilters();

    if (query) {
      applyFilters();
    } else {
      renderCourses();
    }
  }

  // ==================================================
  // SEARCH
  // ==================================================

  function setupSearch() {
    var searchInput = document.getElementById("courseSearch");
    if (!searchInput) return;
    var debounceTimer;
    searchInput.addEventListener("input", function () {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        applyFilters();
      }, 250);
    });
  }

  // ==================================================
  // FILTERS
  // ==================================================

  function setupFilters() {
    var catFilter = document.getElementById("filterCategory");
    var diffFilter = document.getElementById("filterDifficulty");

    if (catFilter) catFilter.addEventListener("change", applyFilters);
    if (diffFilter) diffFilter.addEventListener("change", applyFilters);
  }

  function applyFilters() {
    var searchVal = (document.getElementById("courseSearch") || {}).value || "";
    var catVal = (document.getElementById("filterCategory") || {}).value || "";
    var diffVal = (document.getElementById("filterDifficulty") || {}).value || "";

    searchVal = searchVal.trim().toLowerCase();

    filteredCourses = allCourses.filter(function (c) {
      // Search: title, category, description, tags
      if (searchVal) {
        var tagsStr = (c.tags || []).join(" ");
        var haystack = (
          c.title + " " + c.category + " " + c.description + " " + tagsStr
        ).toLowerCase();
        if (haystack.indexOf(searchVal) === -1) return false;
      }
      // Category
      if (catVal && c.category !== catVal) return false;
      // Level (maps to "difficulty" filter for backward compat)
      if (diffVal && c.level !== diffVal) return false;
      return true;
    });

    applySort();
    renderCourses();
  }

  // ==================================================
  // CLEAR FILTERS
  // ==================================================

  function setupClearFilters() {
    var btn = document.getElementById("clearFiltersBtn");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var searchInput = document.getElementById("courseSearch");
      var catFilter = document.getElementById("filterCategory");
      var diffFilter = document.getElementById("filterDifficulty");
      var sortSelect = document.getElementById("sortCourses");

      if (searchInput) searchInput.value = "";
      if (catFilter) catFilter.value = "";
      if (diffFilter) diffFilter.value = "";
      if (sortSelect) sortSelect.value = "recommended";

      filteredCourses = allCourses.slice();
      applySort();
      renderCourses();
    });
  }

  // ==================================================
  // SORT
  // ==================================================

  function setupSort() {
    var sortSelect = document.getElementById("sortCourses");
    if (sortSelect) sortSelect.addEventListener("change", function () {
      applySort();
      renderCourses();
    });
  }

  function getDurationWeeks(course) {
    var match = (course.duration || "").match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 99;
  }

  function applySort() {
    var sortVal = (document.getElementById("sortCourses") || {}).value || "recommended";
    switch (sortVal) {
      case "popular":
        filteredCourses.sort(function (a, b) { return b.students - a.students; });
        break;
      case "newest":
        filteredCourses.sort(function (a, b) { return b.id - a.id; });
        break;
      case "duration":
        filteredCourses.sort(function (a, b) { return getDurationWeeks(a) - getDurationWeeks(b); });
        break;
      default:
        // recommended: put featured first
        filteredCourses.sort(function (a, b) {
          if (a.featured && !b.featured) return -1;
          if (!a.featured && b.featured) return 1;
          return b.students - a.students;
        });
    }
  }

  // ==================================================
  // RENDER COURSE CARDS
  // ==================================================

  function renderCourses() {
    var container = document.getElementById("coursesGrid");
    var countEl = document.getElementById("courseCount");
    if (!container) return;

    if (countEl) countEl.textContent = filteredCourses.length + " course" + (filteredCourses.length !== 1 ? "s" : "");

    if (filteredCourses.length === 0) {
      container.innerHTML =
        '<div class="courses-empty">' +
          '<div class="courses-empty-icon">&#128269;</div>' +
          '<h3>No courses found</h3>' +
          '<p>Try changing your search or filters.</p>' +
        "</div>";
      return;
    }

    var enrolled = api.getEnrolledCourses() || [];
    var bookmarks = api.getBookmarkedCourses() || [];

    var html = "";
    for (var i = 0; i < filteredCourses.length; i++) {
      var c = filteredCourses[i];
      var isEnrolled = enrolled.indexOf(c.id) !== -1;
      var isBookmarked = bookmarks.indexOf(c.id) !== -1;
      var progress = isEnrolled ? api.getCourseProgress(c.id) : null;
      var pct = progress ? progress.progressPercentage : 0;

      var levelClass = (c.level || "").toLowerCase();
      var thumbColor = getThumbColor(c.thumbnail);

      html += '<div class="course-card" data-id="' + c.id + '">';
      html += '  <div class="course-card-thumb" style="background:' + thumbColor + ';">';
      html += '    <span class="course-card-thumb-icon">' + getThumbIcon(c.thumbnail) + "</span>";
      html += '    <button class="course-card-bookmark' + (isBookmarked ? " active" : "") + '" data-bookmark="' + c.id + '" aria-label="Bookmark">';
      html += isBookmarked ? "&#9733;" : "&#9734;";
      html += "    </button>";
      if (isEnrolled) {
        html += '    <span class="course-card-badge">Enrolled</span>';
      } else if (c.featured) {
        html += '    <span class="course-card-badge">Featured</span>';
      }
      html += "  </div>";
      html += '  <div class="course-card-body">';
      html += '    <div class="course-card-meta">';
      html += '      <span class="course-card-category">' + c.category + "</span>";
      html += '      <span class="course-card-difficulty ' + levelClass + '">' + c.level + "</span>";
      html += "    </div>";
      html += '    <h3 class="course-card-title">' + c.title + "</h3>";
      html += '    <p class="course-card-desc">' + truncate(c.description, 100) + "</p>";
      html += '    <div class="course-card-info">';
      html += '      <span>&#9733; ' + c.rating + "</span>";
      html += "      <span>" + c.lessonsCount + " lessons</span>";
      html += "      <span>" + c.duration + "</span>";
      html += "    </div>";

      if (isEnrolled && progress) {
        html += '    <div class="course-card-progress">';
        html += '      <div class="course-card-progress-header">';
        html += "        <span>" + progress.completedCount + "/" + progress.totalCount + " lessons</span>";
        html += "        <span>" + pct + "%</span>";
        html += "      </div>";
        html += '      <div class="course-card-progress-bar"><div class="course-card-progress-fill" style="width:' + pct + '%;"></div></div>';
        html += "    </div>";
      } else {
        html += '    <div class="course-card-instructor">' + c.topicsCount + " topics &middot; " + c.instructor + "</div>";
      }

      html += '    <a href="course-details.html?id=' + c.id + '" class="btn btn-primary btn-sm btn-block course-card-btn">';
      html += isEnrolled ? "Continue Learning" : "View Course";
      html += "    </a>";
      html += "  </div>";
      html += "</div>";
    }

    container.innerHTML = html;
    attachBookmarkListeners();
  }

  // ==================================================
  // BOOKMARK LISTENERS
  // ==================================================

  function attachBookmarkListeners() {
    var btns = document.querySelectorAll("[data-bookmark]");
    btns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var courseId = parseInt(btn.getAttribute("data-bookmark"), 10);
        var result = api.bookmarkCourse(courseId);
        if (result.bookmarked) {
          btn.classList.add("active");
          btn.innerHTML = "&#9733;";
        } else {
          btn.classList.remove("active");
          btn.innerHTML = "&#9734;";
        }
      });
    });
  }

  // ==================================================
  // HELPERS
  // ==================================================

  function truncate(str, len) {
    if (!str) return "";
    return str.length > len ? str.substring(0, len) + "..." : str;
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
      cyber: "linear-gradient(135deg,#0F766E,#2563EB)",
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
      cyber: "&#128737;",
    };
    return map[key] || "&#128218;";
  }

  // ==================================================
  // PUBLIC
  // ==================================================

  return {
    init: init,
  };
})();
