/**
 * Admin message logging
 */
function loadAdminMessages() {
  const saved = localStorage.getItem(ADMIN_MESSAGE_LOG_KEY);

  try {
    return saved ? JSON.parse(saved) : [];
  } catch {
    console.warn("[⚠️] Failed to parse saved admin messages.");
  }
}

function saveAdminMessages(log) {  
  try {
    localStorage.setItem(ADMIN_MESSAGE_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('[❌] Failed to save admin message log:', e);
  }
}

function deleteAdminMessages() {
	try {
    localStorage.removeItem(ADMIN_MESSAGE_LOG_KEY);
  } catch (e) {
    console.error('[❌] Failed to delete admin message log:', e);
  }
}

function logAdminMessage(id, header, message, type) {
  if (SETTINGS.disableAdminMessageLogging) return;
  
  // Force to string converstion
  if (header) {
	// If it isn't a string, change it to the innerHTML
	header = typeof header === 'string' ? header.toLowerCase() : (header?.innerHTML || header);
  }
  
  if (message) {
	// If it isn't a string, change it to the innerHTML
	message = typeof message === 'string' ? message.toLowerCase() : (message?.innerHTML || message);
  }
	
  // Don't log admin messages sent from this plugin
  if (id.startsWith('ftl-ext')) return;
  
  // Don't log season pass reminders
  if (message && (id == 'season-pass' || message == 'season-pass')) return;
  
  // Don't log 'Forbidden' error messages
  if (message && message == 'Forbidden') return;
  
  if (!SETTINGS.logAdminMessagesLevelUpsMissionsMedals) {
	// Don't log level up messages
    if (header && header.toLowerCase().includes('level up')) return;
	
	// Don't log mission completed messages
    if (header && header.includes('mission complete')) return;
    if (message && (message.startsWith('mission complete') || message.startsWith('mission accepted'))) return
	
	// Don't log medal earned messages
    if (header && header.includes('medal earned')) return;
  }
  
  // Don't log items added to inventory messages
  if (!SETTINGS.logAdminMessagesFoundItem 
    && header
	&& message
	&& (header.includes('found an item') || message.includes('added to your inventory'))) return;
  
  // Don't log polls started
  if (!SETTINGS.logAdminMessagesNewPollStarted && message && message.includes('new poll has started')) return;
  
  // Don't log error messages
  if (!SETTINGS.logAdminMessagesError && type && type == 'error') return;
  
  // Don't log tips sent/recieved
  if (!SETTINGS.logAdminMessagesTips && message && (message.startsWith("you spent ₣") || message.startsWith("you received ₣"))) return;
  
  // Don't log gifted season passes
  if (!SETTINGS.logAdminMessagesGiftedSeasonPasses && header && header.includes('gifted') && header.endsWith('season passes!')) return;
  
  let log = loadAdminMessages();
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
  
  saveAdminMessages(log);
}

/**
 * Staff message logging
 */
function loadStaffMessages() {
  const saved = localStorage.getItem(STAFF_MESSAGE_LOG_KEY);

  try {
    return saved ? JSON.parse(saved) : [];
  } catch {
    console.warn("[⚠️] Failed to parse saved staff messages.");
  }
}

function saveStaffMessages(log) {  
  try {
    localStorage.setItem(STAFF_MESSAGE_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('[❌] Failed to save staff message log:', e);
  }
}

function deleteStaffMessages() {
	try {
    localStorage.removeItem(STAFF_MESSAGE_LOG_KEY);
  } catch (e) {
    console.error('[❌] Failed to delete staff message log:', e);
  }
}

function logStaffMessage(message) {
  if (SETTINGS.disableStaffMessageLogging) return;
	
  // Check if message has admin/wes class used by staff and a few other special users
  if (!getClassNameFromObjectWithPrefix('chat-message-default_admin', message, false)
	  && !getClassNameFromObjectWithPrefix('chat-message-default_wes', message, false)) return;
  
  // Check if it uses a staff/wes avatar image
  if (!message.querySelector('img[src="https://cdn.fishtank.live/avatars/staff.png"]')
	  && !message.querySelector('img[src="https://cdn.fishtank.live/avatars/wes.png"]')) return;
  
  let log = loadStaffMessages();
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
  
  saveStaffMessages(log);
}

/**
 * Pings logging
 */
function loadPings() {
  const saved = localStorage.getItem(PINGS_LOG_KEY);

  try {
    return saved ? JSON.parse(saved) : [];
  } catch {
    console.warn("[⚠️] Failed to parse saved pings.");
  }
}

function savePings(log) {  
  try {
    localStorage.setItem(PINGS_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('[❌] Failed to save pings log:', e);
  }
}

function deletePings() {
	try {
    localStorage.removeItem(PINGS_LOG_KEY);
  } catch (e) {
    console.error('[❌] Failed to delete pings log:', e);
  }
}

function logPing(message) {
  if (SETTINGS.disablePingsLogging) return;
  
  if (!USERNAME) return;
  
  // Check the message contains mentions
  if (!getClassNameFromObjectWithPrefix('chat-message-default_mention', message, false)) return;
  
  let mentioned = false;
  const chatMentions = getAllObjectsFromClassNamePrefix('chat-message-default_mention', message);
  chatMentions.forEach(chatMention => {
    if(chatMention.textContent.toLowerCase() === '@'+USERNAME.toLowerCase()) {
      mentioned = true;
    }
  });
  if (!mentioned) return;
  
  let log = loadPings();
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
  
  savePings(log);
}

/**
 * TTS logging
 */
function loadTts() {
  const saved = localStorage.getItem(TTS_LOG_KEY);

  try {
    return saved ? JSON.parse(saved) : [];
  } catch {
    console.warn("[⚠️] Failed to parse saved TTS.");
  }
}

function saveTts(log) {  
  try {
    localStorage.setItem(TTS_LOG_KEY, JSON.stringify(log));
  } catch (e) {
    console.error('[❌] Failed to save TTS log:', e);
  }
}

function deleteTts() {
	try {
    localStorage.removeItem(TTS_LOG_KEY);
  } catch (e) {
    console.error('[❌] Failed to delete TTS log:', e);
  }
}

function logTts(message) {
  if (SETTINGS.disableTtsLogging) return;
  
  if (!getClassNameFromObjectWithPrefix('chat-message-tts_chat-message-tts', message, false)) return;
  
  const from = getObjectFromClassNamePrefix('chat-message-tts_from', message);
  const room = getObjectFromClassNamePrefix('chat-message-tts_room', message);
  const ttsMessage = getObjectFromClassNamePrefix('chat-message-tts_message', message);
  
  if (!from || !room || !ttsMessage) return;
  
  let log = loadTts();
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
  
  saveTts(log);
}