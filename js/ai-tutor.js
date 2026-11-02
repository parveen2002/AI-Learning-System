/* ============================================
   AI-Learning System - AI Tutor Module
   ============================================

   Handles the AI Tutor chat interface (ai-tutor.html).

   Data flow:
   ai-tutor.js -> api.js -> JSON + LocalStorage
   (Future: api.js -> Flask REST API -> AI API)

   Authentication:
   Uses the existing LearnSphereAuth module.
   ============================================ */

var LearnSphereTutor = (function () {
  "use strict";

  var api = LearnSphereAPI;
  var auth = LearnSphereAuth;

  var HISTORY_KEY = "ai_learning_tutor_history";
  var FEEDBACK_KEY = "ai_learning_tutor_feedback";
  var HISTORY_LIMIT = 50;

  var basePath = "";
  var context = {
    course: null,
    courseId: null,
    courseSlug: null,
    lesson: null,
    lessonTitle: null,
  };
  var sending = false;

  var COURSE_TOPICS = {
    1: "algorithm",
    2: "python",
    3: "javascript",
    4: "sql",
  };

  // ==================================================
  // HELPERS
  // ==================================================

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

  function requireLogin() {
    basePath = detectBasePath();
    if (auth.isLoggedIn()) return true;
    var current = window.location.href;
    window.location.href =
      basePath + "/pages/login.html" + (current ? "?redirect=" + encodeURIComponent(current) : "");
    return false;
  }

  function getLessonTitle(course, lessonId) {
    if (!course || !course.curriculum || !lessonId) return "";
    for (var m = 0; m < course.curriculum.length; m++) {
      var mod = course.curriculum[m];
      for (var l = 0; l < (mod.lessons || []).length; l++) {
        if (mod.lessons[l].id === lessonId) return mod.lessons[l].title;
      }
    }
    return "";
  }

  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "tutor-toast";
    toast.setAttribute("role", "status");
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.classList.add("show");
    }, 10);
    setTimeout(function () {
      toast.classList.remove("show");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2200);
  }

  function showPageError(title, message) {
    var container = document.getElementById("tutorError");
    if (!container) return;
    container.innerHTML = "";
    var h = document.createElement("h2");
    h.textContent = title;
    var p = document.createElement("p");
    p.textContent = message;
    var a = document.createElement("a");
    a.href = "dashboard.html";
    a.className = "btn btn-primary btn-lg";
    a.textContent = "Back to Dashboard";
    container.appendChild(h);
    container.appendChild(p);
    container.appendChild(a);
    container.style.display = "block";
    var layout = document.getElementById("tutorLayout");
    if (layout) layout.style.display = "none";
  }

  // ==================================================
  // LOCALSTORAGE (history + feedback)
  // ==================================================

  function loadHistory() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHistory(entries) {
    if (entries.length > HISTORY_LIMIT) {
      entries = entries.slice(entries.length - HISTORY_LIMIT);
    }
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    } catch (e) {
      showToast("Could not save chat history.");
    }
    return entries;
  }

  function loadFeedback() {
    try {
      var raw = localStorage.getItem(FEEDBACK_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveFeedback(feedback) {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
    } catch (e) {
      showToast("Could not save feedback.");
    }
  }

  // ==================================================
  // CONTEXT SIDEBAR
  // ==================================================

  function renderContext() {
    var rows = document.getElementById("tutorContextRows");
    if (!rows) return;

    var course = context.course;
    if (!course) {
      rows.innerHTML =
        '<div class="tutor-context-row"><span class="tutor-context-label">Current Course</span>' +
        '<span class="tutor-context-value tutor-context-muted">No active course</span></div>' +
        '<div class="tutor-context-row"><span class="tutor-context-label">Suggested Topic</span>' +
        '<span class="tutor-context-value tutor-context-muted">Start a course to get recommendations</span></div>';
      return;
    }

    var progress = api.getCourseProgress(course.id);
    var mastery = api.getStudentMastery(course.id);
    var recommendation = api.getRecommendedNextStepForCourse(course.id);

    var lessonTitle = context.lessonTitle;
    if (!lessonTitle && progress && progress.lastLessonId) {
      lessonTitle = getLessonTitle(course, progress.lastLessonId);
    }

    var progressHtml = progress ? progress.progressPercentage + "%" : "0%";

    var bestHtml = mastery && mastery.bestQuizScore !== null && mastery.bestQuizScore !== undefined
      ? mastery.bestQuizScore + "%"
      : "No quiz yet";

    var suggestedTitle = recommendation ? recommendation.title : "";
    var suggestedAction = recommendation ? recommendation.actionLabel : "";

    var courseLink =
      '<a class="tutor-context-link-value" href="course-details.html?id=' + course.id + '">' + course.title + "</a>";

    rows.innerHTML =
      '<div class="tutor-context-row"><span class="tutor-context-label">Current Course</span>' +
      '<span class="tutor-context-value">' + courseLink + "</span></div>" +
      '<div class="tutor-context-row"><span class="tutor-context-label">Current Lesson</span>' +
      '<span class="tutor-context-value">' + (lessonTitle || "Not started yet") + "</span></div>" +
      '<div class="tutor-context-row"><span class="tutor-context-label">Progress</span>' +
      '<span class="tutor-context-value">' + progressHtml + "</span></div>" +
      '<div class="tutor-context-row"><span class="tutor-context-label">Best Quiz Score</span>' +
      '<span class="tutor-context-value">' + bestHtml + "</span></div>" +
      '<div class="tutor-context-row"><span class="tutor-context-label">Suggested Topic</span>' +
      '<span class="tutor-context-value">' + (suggestedTitle || "Explore more lessons") + "</span></div>" +
      '<div class="tutor-context-row"><span class="tutor-context-label">Suggested Action</span>' +
      '<span class="tutor-context-value">' + (suggestedAction || "Continue Learning") + "</span></div>";
  }

  // ==================================================
  // CHAT UI
  // ==================================================

  function getMessagesContainer() {
    return document.getElementById("tutorMessages");
  }

  function setTyping(typing) {
    var status = document.getElementById("tutorChatStatus");
    if (!status) return;
    status.textContent = typing ? "AI is typing..." : "Online";
    status.classList.toggle("tutor-typing", typing);
  }

  function hideEmptyState() {
    var empty = document.getElementById("tutorEmpty");
    if (empty) empty.style.display = "none";
  }

  function scrollToBottom() {
    var container = getMessagesContainer();
    if (container) container.scrollTop = container.scrollHeight;
  }

  function createMessage(role, text, entry) {
    var container = getMessagesContainer();
    if (!container) return;

    hideEmptyState();

    var row = document.createElement("div");
    row.className = "tutor-message " + (role === "user" ? "user" : "ai");

    var avatar = document.createElement("div");
    avatar.className = "tutor-message-avatar";
    avatar.textContent = role === "user" ? "U" : "AI";

    var body = document.createElement("div");
    body.className = "tutor-message-body";

    var bubble = document.createElement("div");
    bubble.className = "tutor-bubble";
    bubble.textContent = text;

    body.appendChild(bubble);

    if (role === "ai") {
      var actions = document.createElement("div");
      actions.className = "tutor-message-actions";

      var msgId = entry ? entry.id : "msg-" + Date.now();

      var copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "tutor-meta-btn";
      copyBtn.textContent = "Copy";
      var originalLabel = "Copy";
      copyBtn.addEventListener("click", function () {
        copyText(text, copyBtn, originalLabel);
      });

      var upBtn = document.createElement("button");
      upBtn.type = "button";
      upBtn.className = "tutor-meta-btn";
      upBtn.textContent = "Helpful";
      upBtn.setAttribute("data-msg-id", msgId);
      upBtn.addEventListener("click", function () {
        recordFeedback(msgId, "up", upBtn, downBtn);
      });

      var downBtn = document.createElement("button");
      downBtn.type = "button";
      downBtn.className = "tutor-meta-btn";
      downBtn.textContent = "Not Helpful";
      downBtn.setAttribute("data-msg-id", msgId);
      downBtn.addEventListener("click", function () {
        recordFeedback(msgId, "down", upBtn, downBtn);
      });

      var reference = getSavedFeedbackState(msgId);
      if (reference === "up") {
        upBtn.classList.add("active");
        upBtn.textContent = "Marked as Helpful";
      } else if (reference === "down") {
        downBtn.classList.add("active");
        downBtn.textContent = "Marked as Not Helpful";
      }

      actions.appendChild(copyBtn);
      actions.appendChild(upBtn);
      actions.appendChild(downBtn);
      body.appendChild(actions);
    }

    row.appendChild(avatar);
    row.appendChild(body);

    container.appendChild(row);
    scrollToBottom();
    return row;
  }

  function attachShowAnswer(row, practice) {
    if (!practice || !practice.answer) return;
    var bubble = row.querySelector(".tutor-bubble");
    if (!bubble) return;

    var wrapper = document.createElement("div");
    wrapper.className = "tutor-answer-wrap";

    var showBtn = document.createElement("button");
    showBtn.type = "button";
    showBtn.className = "btn btn-secondary btn-sm tutor-answer-btn";
    showBtn.textContent = "Show Answer";

    var answer = document.createElement("div");
    answer.className = "tutor-answer";
    answer.style.display = "none";
    answer.textContent = "Answer: " + practice.answer;

    showBtn.addEventListener("click", function () {
      if (answer.style.display === "none") {
        answer.style.display = "block";
        showBtn.textContent = "Hide Answer";
      } else {
        answer.style.display = "none";
        showBtn.textContent = "Show Answer";
      }
      scrollToBottom();
    });

    wrapper.appendChild(showBtn);
    wrapper.appendChild(answer);
    bubble.appendChild(wrapper);

    // Refresh action buttons (rendered before answer wrapper was attached)
    scrollToBottom();
  }

  function createSuggestionChip(text) {
    var chip = document.createElement("button");
    chip.type = "button";
    chip.className = "tutor-suggestion";
    chip.textContent = text;
    chip.addEventListener("click", function () {
      sendText(text);
    });
    return chip;
  }

  function renderSuggestions() {
    var wrapper = document.getElementById("tutorSuggestions");
    if (!wrapper) return;
    var suggestions = api.getTutorSuggestions() || [];
    wrapper.innerHTML = "";
    for (var i = 0; i < suggestions.length; i++) {
      wrapper.appendChild(createSuggestionChip(suggestions[i]));
    }
  }

  // ==================================================
  // MESSAGE SENDING
  // ==================================================

  function sendText(text, action) {
    text = String(text || "").trim();
    if (!text) return;
    if (sending) return;
    sending = true;

    createMessage("user", text);
    setTyping(true);
    scrollToBottom();

    var requestContext = {
      course: context.course,
      courseId: context.courseId,
      courseSlug: context.courseSlug,
      lesson: context.lesson,
      lessonTitle: context.lessonTitle,
      topicKey: context.topicKey,
    };
    if (action) requestContext.action = action;

    setTimeout(function () {
      var response = api.sendTutorMessage(text, requestContext);
      sending = false;
      setTyping(false);

      var entry = {
        id: "msg-" + Date.now(),
        role: "ai",
        message: response ? response.reply : "I could not answer that right now. Please try again.",
        timestamp: new Date().toISOString(),
      };
      var practice = response ? response.practice : null;

      var row = createMessage("ai", entry.message, entry);
      if (practice) attachShowAnswer(row, practice);

      pushHistory(entry);
    }, 600 + Math.random() * 600);
  }

  function quickAction(action) {
    var course = context.course;

    if (action === "explain") {
      if (course && context.lessonTitle) {
        sendText("Explain this concept: " + context.lessonTitle, "explain");
      } else if (course) {
        sendText("Explain this concept: " + course.title, "explain");
      } else {
        sendText("Explain this concept", "explain");
      }
      return;
    }

    if (action === "practice") {
      context.topicKey = course ? COURSE_TOPICS[course.id] || null : null;
      var prefix = course ? "Give me a practice question for " + course.title : "Give me a practice question";
      sendText(prefix + " please", "practice");
      return;
    }
  }

  function handleInput(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText(document.getElementById("tutorInput").value);
      var input = document.getElementById("tutorInput");
      input.value = "";
      autoGrow(input);
    }
  }

  function autoGrow(textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  // ==================================================
  // HISTORY
  // ==================================================

  function pushHistory(entry) {
    var entries = loadHistory();
    entries.push(entry);
    entries = saveHistory(entries);
  }

  function renderHistory() {
    var entries = loadHistory();
    var container = getMessagesContainer();
    if (!container) return;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry || !entry.message) continue;
      if (entry.role === "ai") {
        createMessage("ai", entry.message, entry);
      } else {
        createMessage("user", entry.message, entry);
      }
    }

    if (entries.length === 0) {
      showGreeting();
    } else {
      hideEmptyState();
    }
    scrollToBottom();
  }

  function showGreeting() {
    var text = api.getTutorGreeting({
      course: context.course ? context.course.title : null,
      lessonTitle: context.lessonTitle || null,
    });
    createMessage("ai", text, null);
  }

  function clearChat() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {
      showToast("Could not clear chat history.");
    }
    var container = getMessagesContainer();
    if (container) {
      container.innerHTML = "";
      var empty = document.getElementById("tutorEmpty");
      if (empty) empty.style.display = "";
    }
    showGreeting();
    scrollToBottom();
    setTyping(false);
  }

  // ==================================================
  // COPY + FEEDBACK
  // ==================================================

  function copyText(text, button, originalLabel) {
    var done = function () {
      var prev = button.textContent;
      button.textContent = "Copied";
      setTimeout(function () {
        button.textContent = originalLabel;
      }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {
        legacyCopy(text);
        done();
      });
    } else {
      legacyCopy(text);
      done();
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch (e) {
      showToast("Could not copy to clipboard.");
    }
    document.body.removeChild(ta);
  }

  function recordFeedback(msgId, value, upBtn, downBtn) {
    var feedback = loadFeedback();
    var user = auth.getCurrentStudent();
    var userId = user ? user.id : "guest";

    var saved = null;
    for (var i = 0; i < feedback.length; i++) {
      if (feedback[i].userId === userId && feedback[i].msgId === msgId) {
        saved = feedback[i];
        break;
      }
    }

    if (!saved) {
      saved = { userId: userId, msgId: msgId, value: null };
      feedback.push(saved);
    }

    saved.value = saved.value === value ? null : value;
    saveFeedback(feedback);

    var upActive = saved.value === "up";
    var downActive = saved.value === "down";

    if (upBtn) {
      upBtn.classList.toggle("active", upActive);
      upBtn.textContent = upActive ? "Marked as Helpful" : "Helpful";
    }
    if (downBtn) {
      downBtn.classList.toggle("active", downActive);
      downBtn.textContent = downActive ? "Marked as Not Helpful" : "Not Helpful";
    }
  }

  function getSavedFeedbackState(msgId) {
    var feedback = loadFeedback();
    var user = auth.getCurrentStudent();
    var userId = user ? user.id : "guest";
    for (var i = 0; i < feedback.length; i++) {
      if (feedback[i].userId === userId && feedback[i].msgId === msgId) {
        return feedback[i].value;
      }
    }
    return null;
  }

  // ==================================================
  // CLEAR CHAT MODAL
  // ==================================================

  function openModal() {
    var modal = document.getElementById("tutorConfirmModal");
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    var modal = document.getElementById("tutorConfirmModal");
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function bindModal() {
    var openBtns = [document.getElementById("tutorClearBtn"), document.getElementById("tutorClearIconBtn")];
    var cancelBtn = document.getElementById("tutorModalCancelBtn");
    var confirmBtn = document.getElementById("tutorModalConfirmBtn");
    var modal = document.getElementById("tutorConfirmModal");

    for (var i = 0; i < openBtns.length; i++) {
      if (openBtns[i]) {
        openBtns[i].addEventListener("click", openModal);
      }
    }
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
    if (confirmBtn) confirmBtn.addEventListener("click", function () {
      clearChat();
      closeModal();
    });
    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeModal();
      });
    }
  }

  // ==================================================
  // INIT
  // ==================================================

  function init() {
    if (!requireLogin()) return;

    var params = getQueryParams();
    if (params.course) {
      var courseId = parseInt(params.course, 10);
      if (!isNaN(courseId)) {
        var course = api.getCourseById(courseId);
        if (course) {
          context.course = course;
          context.courseId = course.id;
          context.courseSlug = course.slug;
        }
      }
    }
    if (params.lesson) {
      context.lesson = params.lesson;
      if (context.course) {
        context.lessonTitle = getLessonTitle(context.course, context.lesson);
      }
    }

    renderContext();
    renderSuggestions();

    var sendBtn = document.getElementById("tutorSendBtn");
    var input = document.getElementById("tutorInput");

    if (sendBtn) {
      sendBtn.addEventListener("click", function () {
        sendText(input.value);
        input.value = "";
        autoGrow(input);
      });
    }

    if (input) {
      input.addEventListener("keydown", handleInput);
      input.addEventListener("input", function () {
        autoGrow(input);
      });
    }

    var explainBtn = document.getElementById("tutorExplainBtn");
    var practiceBtn = document.getElementById("tutorPracticeBtn");
    if (explainBtn) explainBtn.addEventListener("click", function () { quickAction("explain"); });
    if (practiceBtn) practiceBtn.addEventListener("click", function () { quickAction("practice"); });

    bindModal();

    setTyping(false);
    renderHistory();
  }

  return {
    init: init,
    showError: function () {
      showPageError("Sorry, something went wrong", "The AI tutor could not be loaded. Please check your connection and try again.");
    },
  };
})();