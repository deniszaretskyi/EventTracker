/**
 *
 */

const IGNORED_ATTRS = new Set([
  "data-reactid",
  "data-ssr",
  "aria-atomic",
  "data-masked",
]);
const IGNORED_TAGS = new Set(["SCRIPT"]);

export function serializeNode(node) {
  // Текст
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: "#text",
      content: node.textContent || "",
    };
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return undefined;
  }

  const tagName = node.tagName.toUpperCase();

  if (IGNORED_TAGS.has(tagName)) {
    return undefined;
  }

  const element = node;
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const { name, value } = element.attributes[i];
    if (!IGNORED_ATTRS.has(name)) {
      attrs[name] = value;
    }
  }

  const childNodes = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const serializedChild = serializeNode(element.childNodes[i]);
    if (serializedChild) {
      childNodes.push(serializedChild);
    }
  }

  return {
    type: "element",
    tagName: element.tagName, // e.g. DIV, BODY, HEAD, LINK, STYLE, ...
    attributes: attrs,
    children: childNodes,
  };
}

export function rebuildDOM(snapshot, doc) {
  if (!snapshot) return;

  // Очищаем doc.documentElement
  doc.documentElement.innerHTML = "";

  // Реконструируем
  const rootNode = parseNode(snapshot, doc);
  if (
    rootNode &&
    rootNode.tagName &&
    rootNode.tagName.toLowerCase() === "html"
  ) {
    doc.replaceChild(rootNode, doc.documentElement);
  } else {
    doc.body.appendChild(rootNode);
  }
}

function parseNode(data, doc) {
  if (!data) return null;

  if (data.type === "#text") {
    return doc.createTextNode(data.content);
  }
  if (data.type === "element") {
    const el = doc.createElement(data.tagName);

    if (data.attributes) {
      for (const [attrName, attrValue] of Object.entries(data.attributes)) {
        el.setAttribute(attrName, attrValue);
      }
    }
    if (Array.isArray(data.children)) {
      data.children.forEach((child) => {
        const childNode = parseNode(child, doc);
        if (childNode) el.appendChild(childNode);
      });
    }
    return el;
  }
  return null;
}
