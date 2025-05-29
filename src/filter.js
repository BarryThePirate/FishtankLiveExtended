let originalOptions;
let filterOptions = ['All', 'Not watching'];
let currentFilter = 'All';

/**
 * Updates the dropdown menu to reflect the currently selected filter.
 */
function updateActiveClass() {
  if(SETTINGS.disableFiltering) return;
  
  // Make sure we get the correct dropdown
  const chatRoomSelector = getObjectFromClassNamePrefix('chat-room-selector_chat-room-selector');
  const dropdown = getObjectFromClassNamePrefix('select_options', chatRoomSelector);
  const activeClass = getClassNameFromPrefix('select_active', chatRoomSelector);
  if (!dropdown || !activeClass) return;

  const filterButtons = dropdown.querySelectorAll('.filter-option');

  filterButtons.forEach(btn => {
    // Remove previously applied active class
    btn.classList.forEach(cls => {
      if (cls.startsWith('select_active__') && btn.textContent.trim().toLowerCase() !== currentFilter.trim().toLowerCase()) {
        btn.classList.remove(cls);
      }
    });
	
    // Apply active class to currently selected filter
    if (btn.textContent.trim().toLowerCase() === currentFilter.trim().toLowerCase()) {
      btn.classList.add(activeClass);
    }
  });
}

function filter(message) {
  message.style.display = 'none';
  message.classList.add('ftl-ext-filtered');
}

function unfilter(message) {
  message.style.display = '';
  message.classList.remove('ftl-ext-filtered');
}

function resetChatFilter() {
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  chat.childNodes.forEach(message => {
	unfilter(message);
	applyChatFilter(message);
  });
}

/**
 * Applies the selected filtering logic to the chat message.
 */
function applyChatFilter(message) {
 
  if(SETTINGS.disableFiltering) return;
  
  // If it's been hidden by anti-spam, skip
  if (message.classList.contains('ftl-ext-spam')) return;
	
  const selected = currentFilter.trim().toLowerCase();
  
  const prefixes = [
    'chat-message-default_timestamp',
    'chat-message-default_mention',
    'chat-message-sfx_room',
    'chat-message-tts_room',
  ];
  
  // Only resolve class names if they're not already cached
  for (const prefix of prefixes) {
    if (!CLASSES[prefix]) {
      getClassNameFromObjectWithPrefix(prefix, message);
    }
  }
  
  // If the message doesn't contain a class we're looking out for, ignore it
  if (!prefixes.some(prefix =>
    getClassNameFromObjectWithPrefix(prefix, message, false)
  )) return;

  const timestamp = getObjectFromClassNamePrefix('chat-message-default_timestamp', message);
  const timestampText = timestamp?.textContent || '';
  let mentioned = false;
  if (CLASSES['chat-message-default_mention'] && USERNAME) {
	const chatMentions = getAllObjectsFromClassNamePrefix('chat-message-default_mention', message);
    chatMentions.forEach(chatMention => {
      if(chatMention.textContent.toLowerCase() === '@'+USERNAME.toLowerCase()) {
	    mentioned = true;
	  }
    });
  }

  // If allowPings and user has been mentioned, don't filter chat message
  if (SETTINGS.allowPings && mentioned) return;

  //If filterSfx, apply filtering to SFX chat message
  const sfxRoom = getObjectFromClassNamePrefix('chat-message-sfx_room', message);
  if (SETTINGS.filterSfx && sfxRoom) {
	(sfxRoom.textContent.trim().toLowerCase() !== selected) ? filter(message) : unfilter(message);
  }

  //If filterTts, apply filtering to TTS chat message
  const ttsRoom = getObjectFromClassNamePrefix('chat-message-tts_room', message);
  if (SETTINGS.filterTts && ttsRoom) {
	(ttsRoom.textContent.trim().toLowerCase() !== selected) ? filter(message) : unfilter(message);
  }

  if (selected === 'all') {
    unfilter(message)
  } else if (selected === 'not watching') {
    timestampText.includes(' @') ? filter(message) : unfilter(message);
  } else {
    const roomLabel = selected + ' @';
    //TODO - should this not be an exact match?
    timestampText.toLowerCase().includes(roomLabel) ? unfilter(message) : filter(message);
  }
}

/**
 * Applies the filtering logic to all chat messages.
 */
function applyChatFilterToAll() {
  if(SETTINGS.disableFiltering) return;
	
  const chat = document.getElementById('chat-messages');
  if (!chat) return;

  chat.childNodes.forEach(message => {
	applyChatFilter(message);
  });
}

/**
 * Creates and appends new dropdown options for available stream names.
 */
function appendGridNamesToDropdown(names) {
  if(SETTINGS.disableFiltering) return;
  
  const chatRoomSelector = getObjectFromClassNamePrefix('chat-room-selector_chat-room-selector');
  if (!chatRoomSelector) return;
  
  const dropdown = getObjectFromClassNamePrefix('select_options', chatRoomSelector);
  if (!dropdown) return;

  const activeClass = getClassNameFromPrefix('select_active');
  const optionClass = getClassNameFromPrefix('select_option');
  const separatorClass = getClassNameFromPrefix('select_separator');
  const toggleButton = dropdown.parentElement?.querySelector('button');

  // Avoid duplicates
  const existingTexts = Array.from(dropdown.querySelectorAll('button span'))
    .map(span => span.textContent.trim().toLowerCase());

  const newNames = names.filter(name => !existingTexts.includes(name.toLowerCase()));
  if (newNames.length === 0) return;

  // Add to global list
  filterOptions.push(...newNames);

  // Add filter buttons
  filterOptions.forEach(name => {
    const btn = document.createElement('button');
    btn.className = `${optionClass} filter-option`;
	btn.classList.add('ftl-ext-filter-button');
    btn.innerHTML = `<span>${name}</span>`;
	
	if (name.trim().toLowerCase() === currentFilter.trim().toLowerCase()) btn.classList.add(`${activeClass}`);

    btn.addEventListener('click', () => {
      currentFilter = name;
	  
	  // Apply active styling to newly clicked
      updateActiveClass();
	  
	  // Simulate click to close dropdown
      if (toggleButton) toggleButton.click();
	  
	  // Apply chat filtering
      applyChatFilterToAll();
	  
	  // Scroll to the bottom after filtering
	  const chatMessagesContainer = document.getElementById('chat-messages');
	  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    });

    dropdown.appendChild(btn);
  });

  // Add separator to visually group dynamic entries
  const hr = document.createElement('hr');
  hr.className = separatorClass;
  dropdown.appendChild(hr);
}

/**
 * Extracts live stream names from the grid and updates the dropdown options.
 */
function getLiveStreamNames(grid) {
  const streams = getAllObjectsFromClassNamePrefix('live-streams_live-stream', grid);
  const names = [];

  streams.forEach(stream => {
	const streamNameContainer = getObjectFromClassNamePrefix('live-stream_name', stream);
    if (streamNameContainer && streamNameContainer.textContent && streamNameContainer.textContent !== "???") {
      names.push(streamNameContainer.textContent.trim());
    }
  });

  if (names.length > 0) {
    appendGridNamesToDropdown(names);
  }

  return names;
}

/**
 * Update dropdown options and attach continuous observer for stream grid mutations.
 */
function observeStreamGrid() {
  const object = getObjectFromClassNamePrefix('live-streams_live-streams-grid');
  if (object) {
	getLiveStreamNames(object);
	observeObject(object, getLiveStreamNames, true, true);
  }
}

/**
 * Make sure the correct "active" option is highlighted and attach click handlers to the original options.
 */
function observeDropdownOpen(dropdown) {
  const activeObject = getObjectFromClassNamePrefix('select_active');
  if (activeObject) {
	  updateActiveClass();
  }

  originalOptions.forEach(optionText => {
    const dropdownButton = Array.from(dropdown.querySelectorAll('button')).find(btn =>
      btn.textContent.trim().toLowerCase() === optionText
    );

    if (dropdownButton) {
      dropdownButton.addEventListener('click', updateActiveClass);
    }
  });
}

function closeDropdown(dropdown) {
  const options = getObjectFromClassNamePrefix('select_options', dropdown);
  if (options) options.classList.remove('ftl-ext-dropdown-open');
}

/**
 * Re-enable the dropdown box if it is off due to no season pass a.k.a. being poor
 * The season pass functionality won't work but our custom buttons will
 */
function enableDropdown(dropdown) {
  dropdown.classList.remove(getClassNameFromObjectWithPrefix('select_disabled', dropdown.parentElement));
  dropdown.classList.add('ftl-ext-dropdown-enabled');
  
  const optionsStyle = document.createElement('style');
  optionsStyle.textContent = `
	.ftl-ext-dropdown-open {
		opacity: 1 !important;
		z-index: 1 !important;
		pointer-events: auto !important;
		position: absolute !important;
		transform: translate(-1px, 22px) !important;
	}`;
  document.head.appendChild(optionsStyle);
  
  dropdown.addEventListener('click', (event) => {
    if (event.target !== dropdown && !dropdown.querySelector('button').contains(event.target)) return;
    const options = getObjectFromClassNamePrefix('select_options', dropdown);
    if (!options) return;
    
    if (options.classList.contains('ftl-ext-dropdown-open')) {
      closeDropdown(dropdown);
    } else {
      options.classList.add('ftl-ext-dropdown-open');
    }
  });
}

/**
 * Saves the initial dropdown options for later reference.
 */
function saveDropdownOptions(dropdown) {
  if (SETTINGS.disableFiltering) return;

  originalOptions = Array.from(dropdown.querySelectorAll('button span'))
    .map(span => span.textContent.trim().toLowerCase());
	
  // If the dropdown is disabled, re-enable it
  if (SETTINGS.enableChatDropdownIfDisabled 
    && getClassNameFromObjectWithPrefix('select_disabled', dropdown.parentElement, false))
	  enableDropdown(dropdown.parentElement);
}