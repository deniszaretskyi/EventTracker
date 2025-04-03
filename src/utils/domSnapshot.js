/**
 *
 * Provides two main functions:
 *  - serializeNode(node): Recursively serialize a DOM node into a JSON structure.
 *  - rebuildDOM(snapshot, doc): Rebuilds the DOM inside `doc` from a JSON snapshot.
 */

/**
 * A set of attributes we choose to ignore during serialization.
 */
const IGNORED_ATTRS = new Set([
  "data-reactid",
  "data-ssr",
  "aria-atomic",
  "data-masked",
]);

/**
 * Some tags might be ignored entirely to reduce snapshot size (e.g., <script>).
 */
const IGNORED_TAGS = new Set(["SCRIPT", "STYLE", "META", "LINK"]);

export function serializeNode(node) {
  // If it's a text node, return a simple object with type "#text".
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: "#text",
      content: node.textContent || "",
    };
  }

  // If it's not an Element, we skip it (e.g. comments, docType, etc.)
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return undefined;
  }

  const element = node;
  const tagName = element.tagName.toUpperCase();

  // Ignore certain tags entirely
  if (IGNORED_TAGS.has(tagName)) {
    return undefined;
  }

  // Build a list of attributes, excluding those in IGNORED_ATTRS
  const attrs = {};
  for (let i = 0; i < element.attributes.length; i++) {
    const { name, value } = element.attributes[i];
    if (!IGNORED_ATTRS.has(name)) {
      attrs[name] = value;
    }
  }

  // Recursively serialize child nodes
  const childNodes = [];
  for (let i = 0; i < element.childNodes.length; i++) {
    const serializedChild = serializeNode(element.childNodes[i]);
    if (serializedChild) {
      childNodes.push(serializedChild);
    }
  }

  return {
    type: "element",
    tagName: element.tagName, // e.g. "DIV", "BODY", "HTML"
    attributes: attrs,
    children: childNodes,
  };
}

export function rebuildDOM(snapshot, doc) {
  if (!snapshot || !doc) {
    console.warn("[rebuildDOM] Invalid snapshot or document.");
    return;
  }

  // Clear out existing doc content
  doc.documentElement.innerHTML = "";

  // Recursively create DOM from snapshot
  const rootNode = parseNode(snapshot, doc);
  if (rootNode) {
    // If the snapshot is actually <html>, we want to replace doc.documentElement
    if (rootNode.tagName && rootNode.tagName.toLowerCase() === "html") {
      doc.replaceChild(rootNode, doc.documentElement);
    } else {
      // Otherwise, just put the rebuilt content into the body
      doc.body.appendChild(rootNode);
    }
  }
}

function parseNode(data, doc) {
  if (!data) return doc.createDocumentFragment();

  // If it's a text node
  if (data.type === "#text") {
    return doc.createTextNode(data.content || "");
  }

  // If it's an element
  if (data.type === "element") {
    const el = doc.createElement(data.tagName);
    // Set attributes
    if (data.attributes) {
      Object.keys(data.attributes).forEach((attrName) => {
        el.setAttribute(attrName, data.attributes[attrName]);
      });
    }
    // Recursively append children
    if (Array.isArray(data.children)) {
      data.children.forEach((child) => {
        const childNode = parseNode(child, doc);
        if (childNode) {
          el.appendChild(childNode);
        }
      });
    }
    return el;
  }

  // Fallback: return an empty fragment
  return doc.createDocumentFragment();
}
