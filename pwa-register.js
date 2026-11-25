"use strict";
if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(function (error) {
      console.warn("Wortin offline support could not be registered.", error);
    });
  }, { once: true });
}
