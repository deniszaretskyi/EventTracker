const IGNORED_ATTRS = new Set([
  "data-reactid",
  "data-ssr",
  "aria-atomic",
  "data-masked",
]);

export const getNodeIdentifier = (node) => {
  if (node.id) return `#${node.id}`;
  const path = [];
  let current = node;

  while (current.parentNode) {
    const index = [...current.parentNode.children].indexOf(current);
    path.unshift(index);
    current = current.parentNode;
  }

  return path.join(":");
};

export const serializeNode = (node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    return { type: "#text", content: node.textContent };
  }

  return {
    type: "element",
    tag: node.tagName.toLowerCase(),
    attrs: [...node.attributes]
      .filter((attr) => !IGNORED_ATTRS.has(attr.name))
      .reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
    children: [...node.childNodes].map((child) => serializeNode(child)),
  };
};
