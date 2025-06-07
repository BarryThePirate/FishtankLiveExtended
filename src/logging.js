/**
 * Logging functions
 */
function loadLog(key, asc = false) {
  if (DEBUGGING) console.log("Loading log: "+key);
	
  const log = localStorage.getItem(key);

  try {
    const parsed = log ? JSON.parse(log) : [];
    parsed.sort((a, b) => asc 
	  ? a.timestamp - b.timestamp // ascending
	  : b.timestamp - a.timestamp // descending
	);
	return parsed;
  } catch {
    console.warn("[⚠️] Failed to parse saved admin messages.");
  }
}

function saveLog(log, key) {
  if (DEBUGGING) console.log("Saving log: "+key);
  
  try {
    localStorage.setItem(key, JSON.stringify(log));
	
	// Signal to our log viewer that a log has updated
    window.dispatchEvent(new CustomEvent("ftl-ext-log-updated", { detail: { key } }));
  } catch (e) {
    console.error('[❌] Failed to save admin message log:', e);
  }
}

function deleteLog(key) {
  if (DEBUGGING) console.log("Deleting log: "+key);
  
  try {
    localStorage.removeItem(key);
	
	// Signal to our log viewer that a log has updated
    window.dispatchEvent(new CustomEvent("ftl-ext-log-updated", { detail: { key } }));
  } catch (e) {
    console.error('[❌] Failed to delete admin message log:', e);
  }
}

/**
 * Admin message logging
 */
function logAdminMessage(id, header, message, type) {
  if (SETTINGS.disableAdminMessageLogging) return;
  
  let lowerCaseHeader = null;
  let lowerCaseMessage = null;
  
  // Force to string converstion
  if (header) {
	// If it isn't a string, change it to the innerHTML
	header = typeof header === 'string' ? header : (header?.innerHTML || header);
	lowerCaseHeader = typeof header === 'string' ? header.toLowerCase() : header;
  }
  
  if (message) {
	// If it isn't a string, change it to the innerHTML
	message = typeof message === 'string' ? message : (message?.innerHTML || message);
	lowerCaseMessage = typeof header === 'string' ? header.toLowerCase() : header;
  }
	
  // Don't log admin messages sent from this plugin
  if (id.startsWith('ftl-ext')) return;
  
  // Don't log season pass reminders
  if (lowerCaseMessage && (id == 'season-pass' || lowerCaseMessage == 'season-pass')) return;
  
  // Don't log 'Forbidden' error messages
  if (lowerCaseMessage && lowerCaseMessage == 'Forbidden') return;
  
  if (!SETTINGS.logAdminMessagesLevelUpsMissionsMedals) {
	// Don't log level up messages
    if (lowerCaseHeader && lowerCaseHeader.includes('level up')) return;
	
	// Don't log mission completed messages
    if (lowerCaseHeader && lowerCaseHeader.includes('mission complete')) return;
    if (lowerCaseMessage && (lowerCaseMessage.startsWith('mission complete') || lowerCaseMessage.startsWith('mission accepted'))) return
	
	// Don't log medal earned messages
    if (lowerCaseHeader && lowerCaseHeader.includes('medal earned')) return;
  }
  
  // Don't log items added to inventory messages
  if (!SETTINGS.logAdminMessagesFoundItem 
    && lowerCaseHeader
	&& lowerCaseMessage
	&& (lowerCaseHeader.includes('found an item') || lowerCaseMessage.includes('added to your inventory'))) return;
  
  // Don't log polls started
  if (!SETTINGS.logAdminMessagesNewPollStarted && lowerCaseMessage && lowerCaseMessage.includes('new poll has started')) return;
  
  // Don't log error messages
  if (!SETTINGS.logAdminMessagesError && type && type == 'error') return;
  
  // Don't log tips sent/recieved
  if (!SETTINGS.logAdminMessagesTips && lowerCaseMessage && (lowerCaseMessage.startsWith("you spent ₣") || lowerCaseMessage.startsWith("you received ₣"))) return;
  
  // Don't log gifted season passes
  if (!SETTINGS.logAdminMessagesGiftedSeasonPasses && lowerCaseHeader && lowerCaseHeader.includes('gifted') && lowerCaseHeader.endsWith('season passes!')) return;
  
  let log = loadLog(ADMIN_MESSAGE_LOG_KEY, true);
  if (!log) return;
  
  log.push({
    id,
    header,
    message,
    timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logAdminMessagesNumber;
  if (numberOfMessages > SETTINGS.logAdminMessagesNumber.max) numberOfMessages = SETTINGS.logAdminMessagesNumber.max;
  
  // Keep only the last X number of messages (changed by user in settings)
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, ADMIN_MESSAGE_LOG_KEY);
}

/**
 * Staff message logging
 */
function logStaffMessage(message) {
  if (SETTINGS.disableStaffMessageLogging) return;
	
  // Check if message has admin/wes class used by staff and a few other special users
  if (!getClassNameFromObjectWithPrefix('chat-message-default_admin', message, false)
	  && !getClassNameFromObjectWithPrefix('chat-message-default_wes', message, false)) return;
  
  // Check if it uses a staff/wes avatar image
  if (!message.querySelector('img[src="https://cdn.fishtank.live/avatars/staff.png"]')
	  && !message.querySelector('img[src="https://cdn.fishtank.live/avatars/wes.png"]')) return;
  
  let log = loadLog(STAFF_MESSAGE_LOG_KEY, true);
  if (!log) return;
  log.push({
    html: message.outerHTML,
    timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logStaffMessagesNumber;
  if (numberOfMessages > SETTINGS.logStaffMessagesNumber.max) numberOfMessages = SETTINGS.logStaffMessagesNumber.max;
  
  // Keep only the last X number of messages (changed by user in settings)
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, STAFF_MESSAGE_LOG_KEY);
}

/**
 * Pings logging
 */
function logPing(message) {
  if (SETTINGS.disablePingsLogging) return;
  
  if (!USERNAME) return;
  
  // Check the message contains mentions
  if (!getClassNameFromObjectWithPrefix('chat-message-default_mention', message, false)) return;
  
  // Check the message is mentioning this user specifically
  let mentioned = false;
  const chatMentions = getAllObjectsFromClassNamePrefix('chat-message-default_mention', message);
  chatMentions.forEach(chatMention => {
    if(chatMention.textContent.toLowerCase() === '@'+USERNAME.toLowerCase()) {
      mentioned = true;
    }
  });
  if (!mentioned) return;
  
  let log = loadLog(PINGS_LOG_KEY, true);
  if (!log) return;
  log.push({
    html: message.outerHTML,
    timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logPingsNumber;
  if (numberOfMessages > SETTINGS.logPingsNumber.max) numberOfMessages = SETTINGS.logPingsNumber.max;
  
  // Keep only the last X number of messages (changed by user in settings)
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, PINGS_LOG_KEY);
}

/**
 * TTS logging
 */
function logTts(message) {
  if (SETTINGS.disableTtsLogging) return;
  
  if (!getClassNameFromObjectWithPrefix('chat-message-tts_chat-message-tts', message, false)) return;
  
  const from = getObjectFromClassNamePrefix('chat-message-tts_from', message);
  const room = getObjectFromClassNamePrefix('chat-message-tts_room', message);
  const ttsMessage = getObjectFromClassNamePrefix('chat-message-tts_message', message);
  
  if (!from || !room || !ttsMessage) return;
  
  let log = loadLog(TTS_LOG_KEY, true);
  if (!log) return;
  log.push({
    from: from.innerHTML,
    room: room.innerHTML,
    message: ttsMessage.innerHTML,
    timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logTtsNumber;
  if (numberOfMessages > SETTINGS.logTtsNumber.max) numberOfMessages = SETTINGS.logTtsNumber.max;
  
  // Keep only the last X number of messages (changed by user in settings)
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, TTS_LOG_KEY);
}