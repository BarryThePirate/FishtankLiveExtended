/**
 * Prefix is required (e.g. "select_active").
 * Object is optional, defaults to full document if not set
 */

function getClassNameFromPrefix(prefix, object = document, lookup = true) {
  if (lookup && CLASSES[prefix]) return CLASSES[prefix];

  const target = object.querySelector(`[class*="${prefix}__"]`);
  if (!target) return;

  const match = [...target.classList].find(cls => cls.startsWith(prefix + '__'));
  if (match) {
    CLASSES[prefix] = match;
    return match;
  }
}

function getObjectFromClassNamePrefix(prefix, object = document) {
  const className = getClassNameFromPrefix(prefix, object);
  if (!className) return;
  return object.querySelector('.' + className);
}

function getAllObjectsFromClassNamePrefix(prefix, object = document) {
  const className = getClassNameFromPrefix(prefix, object);
  if (!className) return [];
  return object.querySelectorAll('.' + className);
}

/**
 * Re-usable ultra efficient lookup to see if some html contains the prefix
 * Try to use this over the above methods when doing many frequent lookups
 * Use `lookup = false` if you want to just see if object contains prefix
 */
function getClassNameFromObjectWithPrefix(prefix, object, lookup = true) {
  if (lookup && CLASSES[prefix]) return CLASSES[prefix];

  const regex = new RegExp(`\\b(${prefix}__[^\\s"'=]+)\\b`);

  // Try top-level className first
  let match = regex.exec(object.className);
  if (!match) {
    // If not found, try full inner HTML
    match = regex.exec(object.innerHTML);
  }

  if (match && match[1]) {
    CLASSES[prefix] = match[1];
    return match[1];
  }

  return;
}

function checkObjectContainsClassName(object, className) {
  return !!(
    className &&
    (object.classList.contains(className) || object.querySelector('.' + className))
  );
}

/**
 * Re-usable observer function to wait for a target to appear in the object
 * `then` is a function name you give it so it knows what to do if it find it
 */
function observeObject(object, then, passObjectIntoThen = false, disconnectObserverDuringThen = false) {
  // duplicate observer protection
  let observer = OBJECT_OBSERVER_MAP.get(object);
  if (observer) {
	observer.disconnect();
    OBJECT_OBSERVER_MAP.delete(object);
  }
	
  observer = new MutationObserver(() => {
	if (disconnectObserverDuringThen) observer.disconnect();
	passObjectIntoThen ? then(object) : then();
	if (disconnectObserverDuringThen) {
		// Reconnect observer
		observer.observe(object, {
		childList: true,
		subtree: true
	  });
	}
  });
  
  OBJECT_OBSERVER_MAP.set(object, observer);

  observer.observe(object, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

function observeObjectForTarget(object, targetPrefix, then, stopObservingWhenFound = true) {
  const observer = new MutationObserver((mutations, obs) => {
	const target = getObjectFromClassNamePrefix(targetPrefix, object);
    if (target) {
      if (DEBUGGING) console.log(`[👀] Found the target`);
	  if (stopObservingWhenFound) observer.disconnect();
	  then(target);
    }
	
	// If the object is removed, stop observing
	if (!document.contains(object)) observer.disconnect();
  });
  
  OBJECT_OBSERVER_MAP.set(object, observer);

  observer.observe(object, {
    childList: true,
    subtree: true
  });
  
  return observer;
}

function observeAddedElements(object, callback, options = {}) {
  const {
    once = false,
    subtree = false
  } = options;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) {
          callback(node);
		  
          if (once) {
            observer.disconnect();
            return;
          }
        }
      }
    }
  });

  observer.observe(object, {
    childList: true,
    subtree
  });

  return observer;
}

function formatUnixTimestamp(timestamp) {
  const datetime = new Date(timestamp);

  const year = datetime.getFullYear();
  const month = String(datetime.getMonth() + 1).padStart(2, '0');
  const day = String(datetime.getDate()).padStart(2, '0');
  const hours = String(datetime.getHours()).padStart(2, '0');
  const minutes = String(datetime.getMinutes()).padStart(2, '0');
  const seconds = String(datetime.getSeconds()).padStart(2, '0');

  return `${hours}:${minutes}:${seconds} ${year}-${month}-${day}`;
}

function getUsernameFromMessage(message) {
  const usernameContainer = getObjectFromClassNamePrefix('chat-message-default_user', message);
  if (!usernameContainer) return;
  
  const username = Array.from(usernameContainer.childNodes)
	.filter(node => node.nodeType === Node.TEXT_NODE)
	.map(node => node.textContent.trim())
	.join("");
	
  if (!username) return;
  return username;
}


function makeUsernameClickable(message) {
  const usernameContainer = getObjectFromClassNamePrefix('chat-message-default_user', message);
  if (!usernameContainer) return;
  
  const username = getUsernameFromMessage(message);
  if (!username) return;
  
  usernameContainer.addEventListener("click", () => {
    usernameClicked(username);
  });
}

/**
 * CHATGPT SLOP BUT IT SEEMS TO DO THE JOB
 * ---------------------------------------
 * Focuses the chat input and simulates typing “@username ” so Slate treats it like manual input.
 * @param {string} username  – the username to mention
 */
function usernameClicked(username) {
  if (DEBUGGING) console.log('Username clicked: ' + username);
  
  // Use this for desktop. Helper to dispatch keydown→beforeinput→input→keyup for a single character
  function dispatchChar(editorEl, char) {
    const charCode = char.charCodeAt(0);
    const isLetter = /[a-zA-Z]/.test(char);
    const code = isLetter ? "Key" + char.toUpperCase() : "";
    const init = {
      key: char,
      code,
      charCode,
      keyCode: charCode,
      which: charCode,
      bubbles: true,
      cancelable: true
    };
    editorEl.dispatchEvent(new KeyboardEvent("keydown", init));
    editorEl.dispatchEvent(new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: char,
      inputType: "insertText"
    }));
    editorEl.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      data: char,
      inputType: "insertText"
    }));
    editorEl.dispatchEvent(new KeyboardEvent("keyup", init));
  }
  
  function moveCaretToEnd(el) {
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);   // select all…
    range.collapse(false);          // …then collapse to the end
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  
  // Use this for mobile
  function insertTextContenteditable(el, text) {
	moveCaretToEnd(el);
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    // collapse after the inserted text
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    
    // notify Slate/React that content changed
    el.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: "insertText"
    }));
  }
  
  if (MOBILE) {
	document.dispatchEvent(new CustomEvent("modalclose"));
	setTimeout(() => {
	  const bottomBarButtons = getAllObjectsFromClassNamePrefix('mobile-bottom-bar_button');
      bottomBarButtons.forEach(btn => {
		setTimeout(() => {
		  if (btn.textContent.trim().toLowerCase() === "chat") {
			btn.click();
			setTimeout(() => {
			  const chatInput = document.getElementById("chat-input");
			  if (!chatInput || !username) return;
			  
			  chatInput.focus();
			  insertTextContenteditable(chatInput, "@" + username + " ");
		    }, 50);
		  }
		}, 50);
	  });
    }, 50);
	return;
  }
  
  const chatInput = document.getElementById("chat-input");
  if (!chatInput || !username) return;

  // 1) Focus the editor and collapse the caret to the end
  chatInput.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(chatInput);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);

  // 2) After Slate has processed focus/selection, simulate typing
  setTimeout(() => {
    const textToType = "@" + username + " ";
    for (const ch of textToType) {
      dispatchChar(chatInput, ch);
    }
  }, 0);
}