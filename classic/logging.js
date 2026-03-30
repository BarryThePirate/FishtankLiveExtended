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
  
  // Force to string conversion
  if (header) {
    header = typeof header === 'string' ? header : (header?.textContent?.trim() || header?.innerHTML || String(header));
    lowerCaseHeader = typeof header === 'string' ? header.toLowerCase() : null;
  }
  
  if (message) {
    message = typeof message === 'string' ? message : (message?.textContent?.trim() || message?.innerHTML || String(message));
    lowerCaseMessage = typeof message === 'string' ? message.toLowerCase() : null;
  }
  
  // Don't log admin messages sent from this plugin
  if (type && typeof type === 'string' && type === 'ftl-ext-admin-message') return;
  
  // Don't log season pass reminders
  if (lowerCaseMessage && (id === 'season-pass' || lowerCaseMessage === 'season-pass')) return;
  
  // Don't log forbidden error messages
  if (lowerCaseMessage === 'forbidden') return;
  
  // Don't log messages containing filtered words/phrases
  const wordFilter = Array.isArray(SETTINGS.logAdminMessagesWordFilter)
    ? SETTINGS.logAdminMessagesWordFilter
    : [];
  
  const combinedText = `${lowerCaseHeader || ''} ${lowerCaseMessage || ''}`.trim();
  
  const matchesFilter = wordFilter.some(filterWord => {
    if (!filterWord || typeof filterWord !== 'string') return false;
    const needle = filterWord.trim().toLowerCase();
    if (!needle) return false;
    return combinedText.includes(needle);
  });
  
  if (matchesFilter) return;
  
  let log = loadLog(ADMIN_MESSAGE_LOG_KEY, true);
  if (!log) return;
  
  const alreadyExists = log.some(entry =>
    entry.id === id &&
    entry.header === header &&
    entry.message === message
  );
  
  if (alreadyExists) return;
  
  log.push({
    id,
    header,
    message,
    timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logAdminMessagesNumber;
  if (numberOfMessages > SETTINGS.logAdminMessagesNumber.max) {
    numberOfMessages = SETTINGS.logAdminMessagesNumber.max;
  }
  
  // Keep only the last X number of messages
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, ADMIN_MESSAGE_LOG_KEY);
}

/**
 * Mod message logging
 */
function logModMessage(message) {
  if (SETTINGS.disableModMessageLogging) return;
	
  // Check if message has admin/wes class used by staff and a few other special users
  if (! getClassNameFromObjectWithPrefix('chat-message-default_mod', message, false)) return;
  
  const chatMessageId = message.querySelector('[id^="chatMessage-"]')?.id;
  message = message.querySelector(
	'.' + getClassNameFromObjectWithPrefix('chat-message-default_chat-message-default', message, false)
  )?.outerHTML;

  if (! message) return;
  
  let log = loadLog(MOD_MESSAGE_LOG_KEY, true);
  if (! log) return;
  
  // Skip if already logged
  if (log.some(entry => entry.id === chatMessageId)) return;
  
  log.push({
	id: chatMessageId,
	html: message,
	timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logModMessagesNumber;
  if (numberOfMessages > SETTINGS.logModMessagesNumber.max) numberOfMessages = SETTINGS.logModMessagesNumber.max;
  
  // Keep only the last X number of messages (changed by user in settings)
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, MOD_MESSAGE_LOG_KEY);
}

/**
 * Fish message logging
 */
function logFishMessage(message) {
  if (SETTINGS.disableFishMessageLogging) return;
	
  // Check if message has the fish span (meaning they're a fish chatter)
  if (! message.outerHTML.includes('<span>🐟</span>')) return;
  
  const chatMessageId = message.querySelector('[id^="chatMessage-"]')?.id;
  message = message.querySelector(
	'.' + getClassNameFromObjectWithPrefix('chat-message-default_chat-message-default', message, false)
  )?.outerHTML;

  if (! message) return;
  
  let log = loadLog(FISH_MESSAGE_LOG_KEY, true);
  if (! log) return;
  
  // Skip if already logged
  if (log.some(entry => entry.id === chatMessageId)) return;
  
  log.push({
	id: chatMessageId,
	html: message,
	timestamp: Date.now()
  });
  
  // Make sure the number isn't somehow higher than it should be
  let numberOfMessages = SETTINGS.logFishMessagesNumber;
  if (numberOfMessages > SETTINGS.logFishMessagesNumber.max) numberOfMessages = SETTINGS.logFishMessagesNumber.max;
  
  // Keep only the last X number of messages (changed by user in settings)
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, FISH_MESSAGE_LOG_KEY);
}

/**
 * Staff message logging
 */
function logStaffMessage(message) {
  if (SETTINGS.disableStaffMessageLogging) return;
	
  // Check if message has admin/wes class used by staff and a few other special users
  if (! getClassNameFromObjectWithPrefix('chat-message-default_admin', message, false)
	  && ! getClassNameFromObjectWithPrefix('chat-message-default_wes', message, false)) return;
  
  // Check if it uses a staff/wes avatar image
  if (! message.querySelector('img[src="https://cdn.fishtank.live/avatars/staff.png"]')
	  && ! message.querySelector('img[src="https://cdn.fishtank.live/avatars/wes.png"]')) return;
  
  const chatMessageId = message.querySelector('[id^="chatMessage-"]')?.id;
  message = message.querySelector(
	'.' + getClassNameFromObjectWithPrefix('chat-message-default_chat-message-default', message, false)
  )?.outerHTML;

  if (! message) return;
  
  let log = loadLog(STAFF_MESSAGE_LOG_KEY, true);
  if (! log) return;
  
  // Skip if already logged
  if (log.some(entry => entry.id === chatMessageId)) return;
  
  log.push({
	id: chatMessageId,
	html: message,
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
  
  if (! USERNAME) return;
  
  // Check the message contains mentions
  if (! getClassNameFromObjectWithPrefix('chat-message-default_mention', message, false)) return;
  
  // Check the message is mentioning this user specifically
  let mentioned = false;
  const chatMentions = getAllObjectsFromClassNamePrefix('chat-message-default_mention', message);
  chatMentions.forEach(chatMention => {
    if(chatMention.textContent.toLowerCase() === '@'+USERNAME.toLowerCase()) {
      mentioned = true;
    }
  });
  if (! mentioned) return;
  
  const chatMessageId = message.querySelector('[id^="chatMessage-"]')?.id;
  message = message.querySelector(
	'.' + getClassNameFromObjectWithPrefix('chat-message-default_chat-message-default', message, false)
  )?.outerHTML;

  if (! message || ! chatMessageId) return;
  
  let log = loadLog(PINGS_LOG_KEY, true);
  if (! log) return;
  
  // Skip if already logged
  if (log.some(entry => entry.id === chatMessageId)) return;
  
  log.push({
	id: chatMessageId,
	html: message,
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
  
  const from = getObjectFromClassNamePrefix('chat-message-tts_from', message)?.innerHTML;
  const room = getObjectFromClassNamePrefix('chat-message-tts_room', message)?.innerHTML || 'website';
  const ttsMessage = getObjectFromClassNamePrefix('chat-message-tts_message', message)?.innerHTML;
  const ttsVoice = getObjectFromClassNamePrefix('chat-message-tts_voice', message)?.innerHTML;
  
  if (!from || !room || !ttsMessage || !ttsVoice) return;
  
  let log = loadLog(TTS_LOG_KEY, true);
  if (!log) return;

  const alreadyExists = log.some(entry =>
    entry.from === from &&
    entry.room === room &&
    entry.message === ttsMessage &&
    entry.voice === ttsVoice
  );

  if (alreadyExists) return;

  log.push({
    from: from,
    room: room,
    message: ttsMessage,
    voice: ttsVoice,
    timestamp: Date.now()
  });
  
  let numberOfMessages = SETTINGS.logTtsNumber;
  if (numberOfMessages > SETTINGS.logTtsNumber.max) {
    numberOfMessages = SETTINGS.logTtsNumber.max;
  }
  
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, TTS_LOG_KEY);
}

/**
 * SFX logging
 */
function logSfx(message) {
  if (SETTINGS.disableSfxLogging) return;
  
  if (!getClassNameFromObjectWithPrefix('chat-message-sfx_chat-message-sfx', message, false)) return;
  
  const from = getObjectFromClassNamePrefix('chat-message-sfx_from', message)?.textContent?.trim();
  const room = getObjectFromClassNamePrefix('chat-message-sfx_room', message)?.textContent?.trim() || 'website';
  const sfxPrompt = getObjectFromClassNamePrefix('chat-message-sfx_message', message)?.textContent?.trim();
  
  if (!from || !room || !sfxPrompt) return;
  
  let log = loadLog(SFX_LOG_KEY, true);
  if (!log) return;

  const alreadyExists = log.some(entry =>
    entry.from === from &&
    entry.room === room &&
    entry.sfxPrompt === sfxPrompt
  );

  if (alreadyExists) return;

  log.push({
    from: from,
    room: room,
    sfxPrompt: sfxPrompt,
    timestamp: Date.now()
  });
  
  let numberOfMessages = SETTINGS.logSfxNumber;
  if (numberOfMessages > SETTINGS.logSfxNumber.max) {
    numberOfMessages = SETTINGS.logSfxNumber.max;
  }
  
  if (log.length > numberOfMessages) {
    log = log.slice(-numberOfMessages);
  }
  
  saveLog(log, SFX_LOG_KEY);
}