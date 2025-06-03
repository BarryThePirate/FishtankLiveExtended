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
  
  if (SETTINGS.logAdminMessagesExcludeLevelUpsMissionsMedals) {
	// Don't log level up messages
    if (header && header.toLowerCase().includes('level up')) return;
	
	// Don't log mission completed messages
    if (header && header.includes('mission complete')) return;
    if (message && (message.startsWith('mission complete') || message.startsWith('mission accepted'))) return
	
	// Don't log medal earned messages
    if (header && header.includes('medal earned')) return;
  }
  
  // Don't log items added to inventory messages
  if (SETTINGS.logAdminMessagesExcludeFoundItem 
    && header
	&& message
	&& (header.includes('found an item') || message.includes('added to your inventory'))) return;
  
  // Don't log polls started
  if (SETTINGS.logAdminMessagesExcludeNewPollStarted && message && message.includes('new poll has started')) return;
  
  // Don't log error messages
  if (SETTINGS.logAdminMessagesExcludeError && type && type == 'error') return;
  
  // Don't log tips sent/recieved
  if (SETTINGS.logAdminMessagesExcludeTips && message && (message.startsWith("you spent ₣") || message.startsWith("you received ₣"))) return;
  
  // Don't log gifted season passes
  if (SETTINGS.logAdminMessagesExcludeGiftedSeasonPasses && header && header.includes('gifted') && header.endsWith('season passes!')) return;
  
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
	
  // Check if message has admin class used by staff and a few other special users
  if (!getClassNameFromObjectWithPrefix('chat-message-default_admin', message, false)) return;
  
  // Check if it uses a staff avatar image
  if (!message.querySelector('img[src="https://cdn.fishtank.live/avatars/staff.png"]')) return;
  
  
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