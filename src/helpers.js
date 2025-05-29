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
	return `${datetime.getFullYear()}-${datetime.getMonth()+1}-${datetime.getDate()} ${datetime.getHours()}:${datetime.getMinutes()}:${datetime.getSeconds()}`;
}