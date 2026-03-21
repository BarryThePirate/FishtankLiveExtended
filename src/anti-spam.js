function markAsSpam(message) {
  setTimeout(() => {
    const contents = getObjectFromClassNamePrefix('chat-message-default_chat-message-default', message);
    contents.style.display = 'none';
	contents.style.setProperty('height', '0', 'important');
  
    message.classList.add('ftl-ext-spam');
    message.style.setProperty('padding', '0', 'important');
	message.style.setProperty('height', '0', 'important');
	
	const row = document.querySelector('.ftl-ext-spam'); // or any selector you use
	console.log("ROW rect height:", row.getBoundingClientRect().height);
	console.log("ROW computed height:", getComputedStyle(row).height);
	console.log("ROW inline style:", row.getAttribute("style"));

	// and also measure the inner chatMessage div
	const inner = row.querySelector('[id^="chatMessage-"]');
	console.log("INNER rect height:", inner?.getBoundingClientRect().height);
	console.log("INNER computed display:", inner ? getComputedStyle(inner).display : null);
	window.dispatchEvent(new Event('resize'));
  }, 200);
}

function resetAntiSpam() {
	/*if (DEBUGGING) console.log('Resetting anti-spam');
	
	// Loop through all chat messages
	var chat = document.getElementById("chat-messages");
	
	// Chat message now sit within a div inside that div. If that exists, use it instead
	const listDiv = chat.querySelector('div[role="list"]');
	if (listDiv) { chat = listDiv; console.log('list div'); }
	
	if (chat) {
		chat.childNodes.forEach(message => {
			// Remove spam class, unhide and re-run anti-spam logic
			message.style.display = '';
			message.classList.remove('ftl-ext-spam');
			applyAntiSpam(message);
		});
		resetChatFilter();
	}
	
	// Scroll to the bottom after applying new anti-spam settings to chat
	const chatMessagesContainer = document.getElementById('chat-messages');
	
	chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;*/
}

function applyAntiSpam(message) {
  if (SETTINGS.disableAntiSpam) return;
  if (USERNAME && getUsernameFromMessage(message) === USERNAME) return;
  
  const prefixes = [
    'chat-message-happening_item',
    'chat-message-happening_catastrophe',
    'chat-message-emote_chat-message-emote',
    'chat-message-stocks_chat-message-stocks',
    'chat-message-sfx_chat-message-sfx',
    'chat-message-tts_chat-message-tts',
    'chat-message-default_free',
    'chat-message-clan_chat-message-clan',
  ];

  // Only resolve class names if they're not already cached
  for (const prefix of prefixes) {
    if (!CLASSES[prefix]) {
      getClassNameFromObjectWithPrefix(prefix, message);
    }
  }

  // Text-based filters
  const span = getObjectFromClassNamePrefix('chat-message-default_message', message);
  const messageText = span?.innerText?.toLowerCase() ?? '';

  if (messageText) {
    if (
      SETTINGS.hideChatMessageLength > 0 &&
      messageText.length > SETTINGS.hideChatMessageLength
    ) {
      markAsSpam(message);
    }

    if (
      SETTINGS.filterChatMessagesContaining.some(keyword =>
        messageText.includes(keyword.toLowerCase())
      )
    ) {
      markAsSpam(message);
    }

    if (
      SETTINGS.filterChatMessagesExact.some(
        keyword => keyword.toLowerCase() === messageText
      )
    ) {
      markAsSpam(message);
    }
  }

  // Structural/Type-based filters using cached class names
  if (SETTINGS.hideItemConsumption) {
    if (checkObjectContainsClassName(message, CLASSES['chat-message-happening_item'])) markAsSpam(message);
  }

  if (SETTINGS.hideGrenades && checkObjectContainsClassName(message, CLASSES['chat-message-happening_catastrophe'])) {
    markAsSpam(message);
  }

  if (SETTINGS.hideEmotes && checkObjectContainsClassName(message, CLASSES['chat-message-emote_chat-message-emote'])) {
    markAsSpam(message);
  }

  if (SETTINGS.hideStocks && checkObjectContainsClassName(message, CLASSES['chat-message-stocks_chat-message-stocks'])) {
    markAsSpam(message);
  }

  if (SETTINGS.hideSfx && checkObjectContainsClassName(message, CLASSES['chat-message-sfx_chat-message-sfx'])) {
    markAsSpam(message);
  }

  if (SETTINGS.hideTts && checkObjectContainsClassName(message, CLASSES['chat-message-tts_chat-message-tts'])) {
    markAsSpam(message);
  }

  if (SETTINGS.hidePoors && checkObjectContainsClassName(message, CLASSES['chat-message-default_free'])) {
    markAsSpam(message);
  }

  if (SETTINGS.hideClans && checkObjectContainsClassName(message, CLASSES['chat-message-clan_chat-message-clan'])) {
    markAsSpam(message);
  }
}