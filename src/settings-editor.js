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
  container.style.padding = "20px";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "10px";

  const tabControls = document.createElement("div");
  tabControls.className = "ftl-ext-tab-controls";
  tabControls.style.display = "flex";
  tabControls.style.marginBottom = "15px";
  tabControls.style.alignItems = 'center';
  tabControls.style.justifyContent = 'center';
  container.appendChild(tabControls);
  
  const tabButtonStyle = document.createElement('style');
  tabButtonStyle.textContent = `
		  .ftl-ext-tab-button {
			cursor: pointer;
			background-color: #2b2d2e40;
			padding: 10px;
			border: 1px solid #505050;
		  }

		  .ftl-ext-tab-button:hover {
			background-color: #3c3f40;
		  }
		  
		  .ftl-ext-tab-button-active {
			color: #f8ec94;
			background-color: #F8EC941A;
		  }
		  
		  .disabled-setting {
		    opacity: 0.5;
		    pointer-events: none;
		  }
		`;
  container.appendChild(tabButtonStyle);

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
	  groupContainer.style.margin = "0 auto";
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
	  tabButton.classList.add('ftl-ext-tab-button');
	  
      tabButton.textContent = def.group;
	  //tabButton.style.border-top-right-radius = '0';
	  //tabButton.style.border-bottom-right-radius = '0';
      tabButton.onclick = (event) => {
		const clickedButton = event.currentTarget;
        document.querySelectorAll(".ftl-ext-settings-group").forEach(el => {
          el.style.display = "none";
        });
        groupContainer.style.display = "block";
		const activeButton = document.querySelector(".ftl-ext-tab-button-active");
		if (activeButton) activeButton.classList.remove('ftl-ext-tab-button-active');
		clickedButton.classList.add('ftl-ext-tab-button-active');
      };
      tabControls.appendChild(tabButton);

      // Group header
      const groupHeader = document.createElement('h2');
      groupHeader.textContent = def.group;
      groupHeader.style.marginTop = '20px';
      groupHeader.style.textAlign = 'center';
      groupHeader.style.paddingBottom = '30px';
	  groupHeader.style.color = '#fff';
      groupContainer.appendChild(groupHeader);
    }

    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '10px';
	
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
				  i.classList.toggle('disabled-setting', isChecked);
				});
				
				const label = wrapperEl.querySelector('label');
				if (label) label.classList.toggle('disabled-setting', isChecked);
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
        input.style.padding = '6px';
        input.oninput = () => updateSetting(def.key, Number(input.value));

        inputWrapper.appendChild(input);

        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '10px';

        wrapper.appendChild(inputWrapper);
        wrapper.appendChild(numberLabel);

        currentGroupContainer.appendChild(wrapper);
        break;

      case 'text-array':
        label.innerHTML = def.displayName + '<br />(Separated by new lines, not case sensitive)';

        input = document.createElement('textarea');
        input.style.padding = '6px';
        input.value = SETTINGS[def.key].join('\n');
        input.rows = 5;
        input.oninput = () => updateSetting(def.key, input.value.split('\n').map(v => v.trim()).filter(Boolean));

        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.gap = '10px';

        label.style.whiteSpace = 'nowrap';
        label.style.alignSelf = 'center';

        wrapper.appendChild(input);
        wrapper.appendChild(label);
        currentGroupContainer.appendChild(wrapper);
        break;
    }
  });
  
  // If there's a crafting container, insert the crafting search
  if (craftingGroupContainer) {
	const searchWrapper = document.createElement("div");
	searchWrapper.style.marginTop = "20px";

	const searchInput = document.createElement("input");
	searchInput.type = "text";
	searchInput.placeholder = "Crafting search...";
	searchInput.style.padding = "6px";
	searchInput.style.width = "100%";

	const recipesContainer = document.createElement("div");
	recipesContainer.style.marginTop = "10px";
	recipesContainer.className = "recipes";
	recipesContainer.style.display = "flex";
	recipesContainer.style.justifyContent = "center";

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
	staffMessagesWrapper.style.border = '1px solid #505050';
	staffMessagesWrapper.style.backgroundColor = '#101010';
	staffMessagesWrapper.style.textAlign = 'center';
	staffMessagesWrapper.style.padding = '20px';
	staffMessagesWrapper.style.maxHeight = '55vh';
	staffMessagesWrapper.style.width = '700px';
	staffMessagesWrapper.style.overflowY = 'auto';
	
	// Get staff messages from local storage and sort asc by timestamp
	const staffMessages = loadStaffMessages();
	staffMessages.sort((a, b) => b.timestamp - a.timestamp);
	if (staffMessages) {
	  staffMessages.forEach(message => {
		const staffMessageWrapper = document.createElement("div");
		staffMessageWrapper.style.width = '100%';
	    staffMessageWrapper.style.textAlign = 'center';
		  
		const staffMessageContainer = document.createElement("div");
		staffMessageContainer.style.border = '1px solid #505050';
		staffMessageContainer.style.width = '90%';
		staffMessageContainer.style.padding = '10px';
		staffMessageContainer.style.margin = '10px auto';
		staffMessageContainer.style.backgroundColor = '#191d21';
		staffMessageContainer.innerHTML = message.html;
		
		staffMessageWrapper.appendChild(staffMessageContainer);
		staffMessagesWrapper.appendChild(staffMessageWrapper);
	  });
	}
	staffMessageGroupContainer.appendChild(staffMessagesWrapper);
  }
  
  // If there's aa admin message container, insert admin message log
  if (adminMessageGroupContainer) {
	const adminMessagesWrapper = document.createElement("div");
	adminMessagesWrapper.style.border = '1px solid #505050';
	adminMessagesWrapper.style.backgroundColor = '#101010';
	adminMessagesWrapper.style.textAlign = 'center';
	adminMessagesWrapper.style.padding = '20px';
	adminMessagesWrapper.style.maxHeight = '38vh';
	adminMessagesWrapper.style.width = '700px';
	adminMessagesWrapper.style.overflowY = 'auto';
	
	// Get admin messages from local storage and sort asc by timestamp
	const adminMessages = loadAdminMessages();
	adminMessages.sort((a, b) => b.timestamp - a.timestamp);
	if (adminMessages) {
	  adminMessages.forEach(message => {
		const adminMessageWrapper = document.createElement("div");
		adminMessageWrapper.style.width = '100%';
	    adminMessageWrapper.style.textAlign = 'center';
		  
		const adminMessageContainer = document.createElement("div");
		adminMessageContainer.style.border = '1px solid #505050';
		adminMessageContainer.style.width = '90%';
		adminMessageContainer.style.margin = '10px auto';
		adminMessageContainer.style.backgroundColor = '#191d21';
		adminMessageContainer.style.display = 'flex';
		adminMessageContainer.style.flexDirection = 'row';
		//adminMessageContainer.innerHTML = formatUnixTimestamp(message.timestamp);
		
		const adminTimestampContainer = document.createElement('div');
		adminTimestampContainer.style.width = '20%';
		adminTimestampContainer.style.padding = '10px';
		adminTimestampContainer.innerHTML = formatUnixTimestamp(message.timestamp);
		adminTimestampContainer.style.borderRight = '1px solid #505050';
		adminTimestampContainer.style.display = 'flex';
		adminTimestampContainer.style.alignItems = 'center';
		adminTimestampContainer.style.justifyContent = 'center';
		adminTimestampContainer.style.color = '#55d5b4';
		
		const adminBodyContainer = document.createElement('div');
		adminBodyContainer.style.width = '80%';
		adminBodyContainer.style.display = 'flex';
		adminBodyContainer.style.flexDirection = 'column';
		adminBodyContainer.style.justifyContent = 'center';
		adminBodyContainer.style.padding = '10px';
		adminBodyContainer.style.color = '#fff';

		// Title
		const titleContainer = document.createElement('div');
		titleContainer.textContent = message.header; // assuming 'header' is the title
		titleContainer.style.fontWeight = 'bold';
		titleContainer.style.marginBottom = '6px';
		titleContainer.style.color = '#F8EC94';

		// Message
		const messageContainer = document.createElement('div');
		messageContainer.textContent = message.message;
		messageContainer.style.opacity = '0.85';

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
  const firstButton = tabControls.querySelector(".ftl-ext-tab-button");
  if (firstButton) {
    firstButton.classList.add("ftl-ext-tab-button-active");
  }
  
  // Add rounded corner styling just to first and last button like with the profile tabs
  const tabButtons = tabControls.querySelectorAll(".ftl-ext-tab-button");
  if (tabButtons.length > 0) {
    // Round left side of the first button
    tabButtons[0].style.borderTopLeftRadius = "4px";
    tabButtons[0].style.borderBottomLeftRadius = "4px";

	// Round right side of the last button
    const last = tabButtons[tabButtons.length - 1];
    last.style.borderTopRightRadius = "4px";
    last.style.borderBottomRightRadius = "4px";
  }

  modal.appendChild(container);

  // Tip section
  const tipSection = document.createElement("div");
  tipSection.style.marginTop = "20px";
  tipSection.style.textAlign = "center";
  tipSection.style.fontSize = "14px";
  tipSection.style.overflow = 'hidden';

  const tipText = document.createElement("span");
  tipText.textContent = "Like this plugin? ";

  const tipLink = document.createElement("span");
  tipLink.textContent = "TIP";
  tipLink.style.color = "#F8EC94";
  tipLink.style.cursor = "pointer";

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