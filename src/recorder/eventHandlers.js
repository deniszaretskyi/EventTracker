import { throttle } from "../utils/helpers";
import { IGNORED_ATTRS } from "./constants";
import { getNodeIdentifier } from "./domUtils";

export const initMouseListeners = (callback) => {
  const handleMouseMove = throttle((e) => {
    callback({
      type: "mousemove",
      x: e.clientX,
      y: e.clientY,
      timestamp: performance.now(),
    });
  }, 100);

  const handleClick = (e) => {
    callback({
      type: "click",
      target: e.target.tagName,
      x: e.clientX,
      y: e.clientY,
      timestamp: performance.now(),
    });
  };

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("click", handleClick);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("click", handleClick);
  };
};

export const initMutationObserver = (callback) => {
  const observer = new MutationObserver((mutationsList) => {
    const mutations = Array.from(mutationsList).map((mutation) => ({
      type: mutation.type,
      target: getNodeIdentifier(mutation.target),
      addedNodes: Array.from(mutation.addedNodes).map(getNodeIdentifier),
      removedNodes: Array.from(mutation.removedNodes).map(getNodeIdentifier),
      attributeName: mutation.attributeName,
      oldValue: mutation.oldValue,
    }));

    callback(mutations); // Always array
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
  });

  return () => observer.disconnect();
};
