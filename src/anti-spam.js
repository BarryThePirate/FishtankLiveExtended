function markAsSpam(message) {
  message.style.display = 'none';
  message.classList.add('ftl-ext-spam');
}

function resetAntiSpam() {
	if (DEBUGGING) console.log('Resetting anti-spam');
	
	// Loop through all chat messages
	const chat = document.getElementById("chat-messages");
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
	chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

function applyAntiSpam(message) {
  if (SETTINGS.disableAntiSpam) return;
  
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