export const rebuildDOM = (serialized, doc) => {
  try {
    if (!serialized || !doc) return;

    const parseNode = (data) => {
      if (!data) return doc.createDocumentFragment();

      if (data.type === "#text") {
        return doc.createTextNode(data.content);
      }

      const node = doc.createElement(data.tag);

      // checking for attributes
      const attrs = data.attrs || {};
      Object.entries(attrs).forEach(([name, value]) => {
        node.setAttribute(name, value);
      });

      // checking for child comp
      const children = data.children || [];
      children.forEach((child) => {
        const childNode = parseNode(child);
        if (childNode) node.appendChild(childNode);
      });

      return node;
    };

    const fragment = parseNode(serialized);
    doc.body.innerHTML = "";
    doc.body.appendChild(fragment);
  } catch (error) {
    console.error("DOM reconstruction error:", error);
  }
};

export const applyBatchedMutations = (mutations, doc) => {
  const mutationMap = new Map();

  // target mutation
  mutations.forEach((mutation) => {
    const key = mutation.target;
    if (!mutationMap.has(key)) {
      mutationMap.set(key, []);
    }
    mutationMap.get(key).push(mutation);
  });

  // apply group changes
  mutationMap.forEach((mutations, target) => {
    const element = doc.querySelector(`[data-uid="${target}"]`);
    if (!element) return;

    mutations.forEach((mutation) => {
      switch (mutation.type) {
        case "attributes":
          element.setAttribute(mutation.attributeName, mutation.value);
          break;

        case "childList":
          mutation.addedNodes.forEach((node) => {
            element.appendChild(parseNode(node));
          });
          mutation.removedNodes.forEach((node) => {
            const toRemove = element.childNodes[node.index];
            if (toRemove) element.removeChild(toRemove);
          });
          break;
      }
    });
  });
};

const parseNode = (data) => {};
