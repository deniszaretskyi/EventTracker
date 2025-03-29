export const maskSensitiveFields = () => {
  const mask = (element) => {
    if (element.matches('input[type="password"], [data-sensitive]')) {
      element.setAttribute("data-masked", "true");
      element.value = "*****";
    }
  };

  // Mask existing elements
  document
    .querySelectorAll('input[type="password"], [data-sensitive]')
    .forEach(mask);

  // Observe new elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          node
            .querySelectorAll('input[type="password"], [data-sensitive]')
            .forEach(mask);
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  return () => observer.disconnect();
};
