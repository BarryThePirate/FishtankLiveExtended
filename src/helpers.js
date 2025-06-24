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
  let observer = CLASS_OBSERVER_MAP.get(object.getAttribute("class"));
  if (observer) {
	observer.disconnect();
    CLASS_OBSERVER_MAP.delete(object.getAttribute("class"));
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
  
  CLASS_OBSERVER_MAP.set(object.getAttribute("class"), observer);

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
      if (DEBUGGING) console.log(`[👀] Found the target - `+targetPrefix);
	  if (stopObservingWhenFound) observer.disconnect();
	  then(target);
    }
	
	// If the object is removed, stop observing
	if (!document.contains(object)) observer.disconnect();
  });
  
  CLASS_OBSERVER_MAP.set(object.getAttribute("class"), observer);

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

function observeRootObjectClasses(object, then, passObjectIntoThen = false, disconnectObserverDuringThen = false) {
  observer = new MutationObserver(() => {
	if (disconnectObserverDuringThen) observer.disconnect();
	passObjectIntoThen ? then(object) : then();
	if (disconnectObserverDuringThen) {
	    observer.observe(object, {
	    attributes: true,
	    attributeFilter: ['class'],
	    attributeOldValue: true,
	  });	
	}
  });

  observer.observe(object, {
    attributes: true,
    attributeFilter: ['class'],
    attributeOldValue: true,
  });
  
  return observer;
}

/**
 * General functions referenced in the other scripts
 */
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
  if (! usernameContainer) return;
  
  let username = Array.from(usernameContainer.childNodes)
	.filter(node => node.nodeType === Node.TEXT_NODE)
	.map(node => node.textContent.trim())
	.join("");
	
  if (! username) {
	// If username has FTL Ext contributor custom styling
	username = message.querySelector('.ftl-ext-text-pulser')?.textContent.trim();
  }
	
  if (! username) return;
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

function toggleVideoFullscreen() {
  const vid = document.getElementById("hls-stream-player");
  if (! vid) return;

  // Toggle fullscreen
  const fsElem = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
  if (fsElem === vid) {
    // exit fullscreen
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  } else {
    // enter fullscreen
    if (vid.requestFullscreen) vid.requestFullscreen();
    else if (vid.webkitRequestFullscreen) vid.webkitRequestFullscreen();
    else if (vid.mozRequestFullScreen) vid.mozRequestFullScreen();
  }
}

function resizeVideo() {
  const theatreMode = getObjectFromClassNamePrefix('live-stream-player_cinema');
  const video = getObjectFromClassNamePrefix('live-stream-player_container');
  const fullscreenButton = getObjectFromClassNamePrefix('live-stream-controls_live-stream-fullscreen');
  const chat = getObjectFromClassNamePrefix('chat_chat');
  let hideChatButton = document.querySelector('.ftl-ext-hide-chat-button');
  let ftlExtButton = document.querySelector('.ftl-ext-settings-theatre-mode-button');
  
  if (fullscreenButton) {
	if (SETTINGS.alwaysShowFullscreenButton) {
	  fullscreenButton.classList.add('ftl-ext-fullscreen-button-show');
	} else {
	  fullscreenButton.classList.remove('ftl-ext-fullscreen-button-show');
	}
  }
  
  if (SETTINGS.theatreModeImproved && theatreMode) {
	if (! hideChatButton) {
	  // Add hide chat button (defaults to display: none)
	  hideChatButton = fullscreenButton.cloneNode(true);
	  hideChatButton.classList.remove('ftl-ext-fullscreen-button-show');
	  hideChatButton.classList.add('ftl-ext-hide-chat-button');
	  
	  const iconHolder = hideChatButton.querySelector('div[class*="icon_icon"]');
	  if (iconHolder) {
		iconHolder.innerHTML = chat.style.zIndex === '2'? SVG_OPEN_CHAT : SVG_CLOSE_CHAT;
	  }

      hideChatButton.addEventListener('click', e => {
        if (chat) {
          chat.style.zIndex = chat.style.zIndex === '2' ? '7' : '2';
		  iconHolder.innerHTML = chat.style.zIndex === '2'? SVG_OPEN_CHAT : SVG_CLOSE_CHAT;
		  resizeVideo();
        }
      });

	  fullscreenButton.after(hideChatButton);
	}
	if (hideChatButton) hideChatButton.style.setProperty('display', 'block', 'important');
	
	if (! ftlExtButton && SETTINGS.theatreModeFtlExtButton) {
	  // Add hide chat button (defaults to display: none)
	  ftlExtButton = fullscreenButton.cloneNode(true);
	  ftlExtButton.classList.remove('ftl-ext-fullscreen-button-show');
	  ftlExtButton.classList.add('ftl-ext-settings-theatre-mode-button');
	  
	  const iconHolder = ftlExtButton.querySelector('div[class*="icon_icon"]');
	  if (iconHolder) {
		iconHolder.innerHTML = SVG_SKULL_AND_CROSSBONES;
	  }

      ftlExtButton.addEventListener('click', e => {
        openSettingsEditor();
      });

	   fullscreenButton.after(ftlExtButton);
	} else if (! SETTINGS.theatreModeFtlExtButton && ftlExtButton) {
	  ftlExtButton.style.display = 'none';
	}
	if (ftlExtButton && SETTINGS.theatreModeFtlExtButton) ftlExtButton.style.setProperty('display', 'block', 'important');
	
	if (chat) chat.classList.add('ftl-ext-theatre-mode-chat-box');

    const theatreModeClass = getClassNameFromPrefix('live-stream-player_cinema', theatreMode);
	
	// If the chat is behind the video (hidden) then act like it has no width
    let chatWidth = chat.getBoundingClientRect().width;
	if (chat.style.zIndex === '2') chatWidth = 0;
	
    const windowW   = window.innerWidth;
    const windowH   = window.innerHeight;
  
    // compute your available width
    const availableW = windowW - chatWidth;
  
    // get the video’s natural aspect ratio
    const aspectRatio = video.videoWidth
  	  ? (video.videoWidth / video.videoHeight)
  	  : (16 / 9); // fallback if metadata not loaded
  
    // set the width to fill that space…
    const newW = availableW;
    let newH = newW / aspectRatio;
  
    // don’t exceed the viewport’s height
    if (newH > windowH) {
  	  newH = windowH;
    }
    
    if (! MOBILE) {
  	  // Fix the terrible site CSS that stretches video heights when within a certain threshold
  	  const override = document.createElement('style');
  	  override.textContent = `
  	    /* Force the video to letterbox inside that container */
  	    .${theatreModeClass} video {
  	  	  width:       100%    !important;
  	  	  height:      auto    !important;
  	  	  object-fit:  contain !important;
  	    }
  	  `;
  	  document.head.appendChild(override);
    }
    
    video.style.width  = Math.round(newW) + 'px';
    if (DEBUGGING && video.style.width !== '100%') console.log(`→ video resized to ${video.style.width}`);
  } else if (video) {
    if (DEBUGGING &&  video.style.width !== '100%') console.log('Resetting video sizing to 100%');
    video.style.width  = '100%';
    video.style.margin = '';
	if (hideChatButton) hideChatButton.style.display = 'none';
	if (ftlExtButton) ftlExtButton.style.display = 'none';
	if (chat) chat.classList.remove('ftl-ext-theatre-mode-chat-box');
  }
}

function adminMessage(message, header = 'Fishtank Live Extended', id = null, duration = 5000) {
  const type = 'ftl-ext-admin-message';
  id = id ?? 'ftl-ext-admin-message';
  id = id + '-' + Date.now();
  
  const adminMessage = new CustomEvent("toastopen", {
    detail: JSON.stringify({
      message,
      header,
      id,
      duration,
	  type,
    })
  });
  document.dispatchEvent(adminMessage);
}

// Build a list of class prefixes to class with hashes e.g. chat_chat: chat_chat__2rdNg
// This will be used in the future to replace custom styling with standardised site styling
function buildCssModuleMap() {
  const map = {};
  // global regex: group1=moduleName, group2=localName, group3=hash
  const re = /\.([A-Za-z0-9-]+)_([A-Za-z0-9-]+)__([A-Za-z0-9]+)/g;

  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // skip cross-origin sheets
    }

    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule) || !rule.selectorText) continue;

      let match;
      // run the regex *globally* over the selectorText
      while ((match = re.exec(rule.selectorText)) !== null) {
        const [ , moduleName, localName, hash ] = match;
        const fullClass = `${moduleName}_${localName}__${hash}`;
        map[`${moduleName}_${localName}`] = fullClass;
      }
    }
  }

  CSS_MAP = map;
}

function removeWartoyVisuals() {
  if (DEBUGGING) console.log('Removing wartoy effect');
  const body = document.body;
  body.classList.remove('mirror', 'blind');
}