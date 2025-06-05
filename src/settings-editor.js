const iconSVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="black" width="24" height="24">
  <!-- Skull -->
  <rect x="7" y="6" width="10" height="2"></rect>
  <rect x="6" y="8" width="12" height="2"></rect>
  <rect x="6" y="10" width="2" height="2"></rect>
  <rect x="11" y="10" width="2" height="2"></rect>
  <rect x="16" y="10" width="2" height="2"></rect>
  <rect x="13" y="12" width="3" height="2"></rect>
  <rect x="8" y="12" width="3" height="2"></rect>
  <rect x="9" y="14" width="6" height="1"></rect>
  <rect x="10" y="17" width="4" height="1"></rect>
  <rect x="11" y="15" width="1" height="1"></rect>
  <rect x="13" y="15" width="1" height="1"></rect>
  <rect x="12" y="16" width="1" height="1"></rect>
  <rect x="10" y="16" width="1" height="1"></rect>
  
  <!-- Crossbones -->
  
  <!-- Top Left -->
  <rect x="2" y="0" width="2" height="2"></rect>
  <rect x="0" y="2" width="4" height="2"></rect>
  <rect x="4" y="4" width="2" height="2"></rect>
  
  <!-- Top Right -->
  <rect x="20" y="0" width="2" height="2"></rect>
  <rect x="20" y="2" width="4" height="2"></rect>
  <rect x="18" y="4" width="2" height="2"></rect>
  
  <!-- Bottom Left -->
  <rect x="0" y="20" width="4" height="2"></rect>
  <rect x="2" y="22" width="2" height="2"></rect>
  <rect x="4" y="18" width="2" height="2"></rect>
  <rect x="6" y="16" width="2" height="2"></rect>
  
  <!-- Bottom Right -->
  <rect x="20" y="20" width="4" height="2"></rect>
  <rect x="20" y="22" width="2" height="2"></rect>
  <rect x="18" y="18" width="2" height="2"></rect>
  <rect x="16" y="16" width="2" height="2"></rect>
  
</svg>
`;

function injectPluginSettingsIntoModal() {
  const modal = getObjectFromClassNamePrefix("modal_body");
  if (!modal) return;

  const tipButton = modal.querySelector("button[type='submit']");
  if (!tipButton) return;

  const header = getObjectFromClassNamePrefix("modal_title");
  header.innerHTML = 'Fishtank Live Extended Settings';

  const labelClass = getClassNameFromPrefix("input_input");
  const inputWrapperClass = getClassNameFromPrefix("input_input-wrapper");

  modal.innerHTML = "";

  const container = document.createElement("div");
  container.classList.add('ftl-ext-settings-editor-container');
  
  const tabControls = document.createElement("div");
  tabControls.className = "ftl-ext-tab-controls";
  container.appendChild(tabControls);

  let currentGroup = '';
  let currentGroupContainer = null;
  let craftingGroupContainer = null;
  let adminMessageGroupContainer = null;
  let staffMessageGroupContainer = null;
  const groupInputsMap = {};
  
  settingDefinitions.forEach(def => {
    if (def.group !== currentGroup) {
      currentGroup = def.group;

      // Create group container
      const groupContainer = document.createElement("div");
      groupContainer.classList.add("ftl-ext-settings-group");
      groupContainer.dataset.group = def.group;
      groupContainer.style.display = "none"; // hidden by default
      container.appendChild(groupContainer);
      currentGroupContainer = groupContainer;

	  switch (currentGroup) {
		  case 'Crafting':
		    craftingGroupContainer = groupContainer;
			break;
		  case 'Admin Messages':
			adminMessageGroupContainer = groupContainer;
			break;
		  case 'Staff Messages':
			staffMessageGroupContainer = groupContainer;
			break;
		  default:
			break;
	  }

      // Tab button
      const tabButton = document.createElement("button");
	  tabButton.classList.add('ftl-ext-settings-tab-button');
	  
      tabButton.textContent = def.group;
      tabButton.onclick = (event) => {
		const clickedButton = event.currentTarget;
        document.querySelectorAll(".ftl-ext-settings-group").forEach(el => {
          el.style.display = "none";
        });
        groupContainer.style.display = "block";
		const activeButton = document.querySelector(".ftl-ext-settings-tab-button-active");
		if (activeButton) activeButton.classList.remove('ftl-ext-settings-tab-button-active');
		clickedButton.classList.add('ftl-ext-settings-tab-button-active');
      };
      tabControls.appendChild(tabButton);

      // Group header
      const groupHeader = document.createElement('h2');
      groupHeader.textContent = def.group;
	  groupHeader.classList.add('ftl-ext-settings-group-header');
      groupContainer.appendChild(groupHeader);
    }

    const wrapper = document.createElement('div');
	wrapper.classList.add('ftl-ext-settings-wrapper');
	
	if (!groupInputsMap[def.group]) groupInputsMap[def.group] = [];
	wrapper.dataset.settingKey = def.key;
	groupInputsMap[def.group].push(wrapper);

    const label = document.createElement('label');
    label.textContent = '  ' + def.displayName;

    let input;
    switch (def.type) {
      case 'boolean':
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = SETTINGS[def.key];
        input.onchange = () => updateSetting(def.key, input.checked);
		
		if (def.groupToggler) {
		  input.addEventListener('change', () => {
			const isChecked = input.checked;
			groupInputsMap[def.group].forEach(wrapperEl => {
			  if (wrapperEl.dataset.settingKey !== def.key) {
				const inputs = wrapperEl.querySelectorAll('input, textarea');
				inputs.forEach(i => {
				  i.disabled = isChecked;
				  i.classList.toggle('ftl-ext-setting-disabled', isChecked);
				});
				
				const label = wrapperEl.querySelector('label');
				if (label) label.classList.toggle('ftl-ext-setting-disabled', isChecked);
			  }
			});
		  });

		  // Trigger initial state
		  setTimeout(() => input.dispatchEvent(new Event('change')), 0);
		}

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        currentGroupContainer.appendChild(wrapper);
        break;

      case 'number':
        const numberLabel = document.createElement("label");
        numberLabel.textContent = def.displayName;
        if (labelClass) numberLabel.className = labelClass;

        const inputWrapper = document.createElement("div");
        if (inputWrapperClass) inputWrapper.className = inputWrapperClass;

        input = document.createElement('input');
        input.type = 'number';
        def.min != null && (input.min = def.min);
        def.max != null && (input.max = def.max);
        input.value = SETTINGS[def.key];
        input.classList.add('ftl-ext-input');
        input.oninput = () => updateSetting(def.key, Number(input.value));

        inputWrapper.appendChild(input);

        wrapper.classList.add('ftl-ext-setting-wrapper');

        wrapper.appendChild(inputWrapper);
        wrapper.appendChild(numberLabel);

        currentGroupContainer.appendChild(wrapper);
        break;

      case 'text-array':
        label.innerHTML = def.displayName + '<br />(Separated by new lines, not case sensitive)';

        input = document.createElement('textarea');
        input.classList.add('ftl-ext-input');
        input.value = SETTINGS[def.key].join('\n');
        input.rows = 5;
        input.oninput = () => updateSetting(def.key, input.value.split('\n').map(v => v.trim()).filter(Boolean));

        wrapper.classList.add('ftl-ext-setting-wrapper');

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        currentGroupContainer.appendChild(wrapper);
        break;
    }
  });
  
  // If there's a crafting container, insert the crafting search
  if (craftingGroupContainer) {
	const searchWrapper = document.createElement("div");
	searchWrapper.classList.add('ftl-ext-craft-search-wrapper');

	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.placeholder = "Crafting search...";
	searchInput.classList.add('ftl-ext-crafting-search-input');

	const recipesContainer = document.createElement("div");
	recipesContainer.className = "ftl-ext-recipes-container";

	searchInput.oninput = (e) => {
	  const query = e.target.value.trim().toLowerCase();
	  recipesContainer.innerHTML = '';
	  if (!query) return;

	  const matched = (CRAFTING_RECIPES || []).filter(recipe =>
		recipe.ingredients.some(ing => ing.toLowerCase().includes(query)) ||
		recipe.result.toLowerCase().includes(query)
	  );

	  const table = createRecipeTable(matched, query);
	  recipesContainer.appendChild(table);
	};

	searchWrapper.appendChild(searchInput);
	searchWrapper.appendChild(recipesContainer);
	craftingGroupContainer.appendChild(searchWrapper);
  }
  
  // If there's a staff message container, insert staff message log
  if (staffMessageGroupContainer) {
	const staffMessagesWrapper = document.createElement("div");
	staffMessagesWrapper.classList.add('ftl-ext-staff-messages-wrapper');
	
	// Get staff messages from local storage and sort asc by timestamp
	const staffMessages = loadStaffMessages();
	staffMessages.sort((a, b) => b.timestamp - a.timestamp);
	if (staffMessages) {
	  staffMessages.forEach(message => {
		const staffMessageWrapper = document.createElement("div");
		staffMessageWrapper.classList.add('ftl-ext-staff-message-wrapper');
		  
		const staffMessageContainer = document.createElement("div");
		staffMessageContainer.classList.add('ftl-ext-staff-message-container');
		staffMessageContainer.innerHTML = message.html;
		
		staffMessageWrapper.appendChild(staffMessageContainer);
		staffMessagesWrapper.appendChild(staffMessageWrapper);
	  });
	  
	  const loopMessages = getAllObjectsFromClassNamePrefix('chat-message-default_chat-message-default', staffMessagesWrapper);
	  if (loopMessages) {
		loopMessages.forEach(message => {
		  // Un-hide message that were hidden by either Anti-Spam or Filter at time of saving
		  message.style.display = '';
		});
	  }
	}
	staffMessageGroupContainer.appendChild(staffMessagesWrapper);
  }
  
  // If there's aa admin message container, insert admin message log
  if (adminMessageGroupContainer) {
	const adminMessagesWrapper = document.createElement("div");
	adminMessagesWrapper.classList.add('ftl-ext-admin-messages-wrapper');
	
	// Get admin messages from local storage and sort asc by timestamp
	const adminMessages = loadAdminMessages();
	adminMessages.sort((a, b) => b.timestamp - a.timestamp);
	if (adminMessages) {
	  adminMessages.forEach(message => {
		const adminMessageWrapper = document.createElement("div");
		adminMessageWrapper.classList.add("ftl-ext-admin-message-wrapper");
		  
		const adminMessageContainer = document.createElement("div");
		adminMessageContainer.classList.add('ftl-ext-admin-message-container');
		
		const adminTimestampContainer = document.createElement('div');
		adminTimestampContainer.innerHTML = formatUnixTimestamp(message.timestamp);
		adminTimestampContainer.classList.add('ftl-ext-admin-timestamp-container');
		
		const adminBodyContainer = document.createElement('div');
		adminBodyContainer.classList.add('ftl-ext-admin-body-container');

		// Title
		const titleContainer = document.createElement('div');
		titleContainer.textContent = message.header;
		titleContainer.classList.add('ftl-ext-admin-title');

		// Message
		const messageContainer = document.createElement('div');
		messageContainer.textContent = message.message;
		messageContainer.classList.add('ftl-ext-admin-message-container-message-container');

		adminBodyContainer.appendChild(titleContainer);
		adminBodyContainer.appendChild(messageContainer);
		
		adminMessageContainer.appendChild(adminTimestampContainer);
		adminMessageContainer.appendChild(adminBodyContainer);
		
		adminMessageWrapper.appendChild(adminMessageContainer);
		adminMessagesWrapper.appendChild(adminMessageWrapper);
	  });
	}
	adminMessageGroupContainer.appendChild(adminMessagesWrapper);
  }

  // Show the first group by default
  const firstGroup = container.querySelector(".ftl-ext-settings-group");
  if (firstGroup) firstGroup.style.display = "block";
  
  // Make the first button 'active' class for styling
  const firstButton = tabControls.querySelector(".ftl-ext-settings-tab-button");
  if (firstButton) {
    firstButton.classList.add("ftl-ext-settings-tab-button-active");
  }

  modal.appendChild(container);

  // Tip section
  const tipSection = document.createElement("div");
  tipSection.classList.add("ftl-ext-tip-section");

  const tipText = document.createElement("span");
  tipText.textContent = "Like this extension? ";

  const tipLink = document.createElement("span");
  tipLink.textContent = "TIP";
  tipLink.classList.add("ftl-ext-tip-link");
  
  tipLink.onclick = (e) => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent("modalclose"));

    setTimeout(() => {
      const tipData = {
        id: "3bd89a72-5aa2-4ad8-b461-71516bd6b4d5",
        displayName: "BarryThePirate",
        color: "#c24ffe",
        photo: "https://cdn.fishtank.live/avatars/standard-blue.png",
        seasonPass: true,
        seasonPassXL: false,
        seasonPassSubscription: true,
        seasonPassGift: null,
        xp: 2960,
        clan: null,
        joined: Date.now() - 100000000,
        pfps: ["standard-blue"],
        medals: {},
        tokens: 100000,
        bio: "Arrr, matey!",
        endorsement: "91",
        integrations: []
      };

      document.dispatchEvent(new CustomEvent("modalopen", {
        detail: JSON.stringify({
          modal: "Tip",
          data: tipData
        })
      }));
    }, 100);
  };

  tipSection.appendChild(tipText);
  tipSection.appendChild(tipLink);
  modal.appendChild(tipSection);
}

function createCustomButton() {
  const iconClass = getClassNameFromPrefix("icon_icon");
  const pluginBtn = document.createElement("button");
  pluginBtn.classList.add('ftl-ext-settings-button');

  pluginBtn.innerHTML = `
    <span>
      <div class="${iconClass}">${iconSVG}</div>
    </span>
    FTL Extended
  `;
  pluginBtn.dataset.pluginButton = "true";

  pluginBtn.onclick = (event) => {
	const userDropdown = getObjectFromClassNamePrefix("top-bar-user_show");
	if (userDropdown) userDropdown.classList.remove(getClassNameFromPrefix("top-bar-user_show"));
	
	document.dispatchEvent(new CustomEvent("modalopen", {
	  detail: JSON.stringify({
		modal: "Tip",
		data: []
	  })
	}));
	
	setTimeout(() => {
		// wait 100ms for the modal to actually appear
		const object = document.getElementById('modal');
		if (!object) return;
		
		injectPluginSettingsIntoModal(object);
		const observer = observeObjectForTarget(object, 'input_input-wrapper', injectPluginSettingsIntoModal, false);
	}, 100);
  };
  
  const dropdown = getObjectFromClassNamePrefix("top-bar-user_dropdown");
  
  const billingBtn = Array.from(dropdown.querySelectorAll("button"))
    .find(btn => btn.textContent.trim() === "Billing");
  
  if (billingBtn) {
    dropdown.insertBefore(pluginBtn, billingBtn);
  } else {
    dropdown.appendChild(pluginBtn);
  }
}