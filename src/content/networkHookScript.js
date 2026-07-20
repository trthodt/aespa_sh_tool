// Runs inside the page's own JS realm (MAIN world) via chrome.scripting.executeScript.
// Must be fully self-contained - no references to anything outside this function body,
// since Chrome re-serializes and re-executes it in the target page context.
export function installQueueHook() {
  if (window.__shQueueHookInstalled) return;
  window.__shQueueHookInstalled = true;

  var TARGET = "/me/queue/track/later";

  function post(payload) {
    window.postMessage({ source: "sh-ext-net", type: "QUEUE_RESPONSE", payload: payload }, "*");
  }

  var originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = function () {
      var args = arguments;
      var input = args[0];
      var url = typeof input === "string" ? input : input && input.url;
      var result = originalFetch.apply(this, args);
      if (url && url.indexOf(TARGET) !== -1) {
        result
          .then(function (res) {
            return res.clone().json();
          })
          .then(post)
          .catch(function () {});
      }
      return result;
    };
  }

  var XHR = window.XMLHttpRequest;
  var originalOpen = XHR.prototype.open;
  var originalSend = XHR.prototype.send;

  XHR.prototype.open = function (method, url) {
    this.__shUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XHR.prototype.send = function () {
    if (this.__shUrl && String(this.__shUrl).indexOf(TARGET) !== -1) {
      this.addEventListener("load", function () {
        try {
          post(JSON.parse(this.responseText));
        } catch (e) {
          // not JSON, ignore
        }
      });
    }
    return originalSend.apply(this, arguments);
  };
}
