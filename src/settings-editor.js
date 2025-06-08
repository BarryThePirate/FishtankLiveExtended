// =======================
//  ELEMENT-CREATION HELPERS
// =======================

/**
 * Create a new element with optional classes, and return it.
 */
function createEl(tag, classList = []) {
  const el = document.createElement(tag);
  classList.forEach(c => el.classList.add(c));
  return el;
}

/**
 * Create a <button> with specified text, classes, and click handler.
 */
function createButton(text, classList = [], onClick) {
  const btn = createEl("button", classList);
  btn.textContent = text;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

/**
 * Create an <input> of given type, with optional classes and attributes.
 */
function createInput(type, classList = [], attributes = {}, onChange) {
  const inp = createEl("input", classList);
  inp.type = type;
  Object.entries(attributes).forEach(([attr, value]) => {
    if (value !== null && value !== undefined) {
      inp[attr] = value;
    }
  });
  if (onChange) inp.addEventListener("change", onChange);
  return inp;
}

/**
 * Create a <textarea> with optional classes, rows, and input handler.
 */
function createTextarea(classList = [], rows = 3, onInput) {
  const ta = createEl("textarea", classList);
  ta.rows = rows;
  if (onInput) ta.addEventListener("input", onInput);
  return ta;
}

/**
 * Wrap a label + an input‐like element in a <div> with wrapper classes.
 */
function wrapWithLabel(inputEl, labelText, wrapperClasses = []) {
  const wrapper = createEl("div", wrapperClasses);
  const label = document.createElement("label");
  label.textContent = labelText;
  wrapper.appendChild(inputEl);
  wrapper.appendChild(label);
  return wrapper;
}


// ============================
//  SETTINGS-EDITOR MAIN LOGIC
// ============================

/**
 * Build the entire settings editor UI and insert it into the given modal container.
 */
function injectPluginSettingsIntoModal() {
  // 1) Locate modal, exit early if not found:
  const modal = getObjectFromClassNamePrefix("modal_body");
  if (!modal) return;

  // 2) Verify there's a “submit” button (model has finished loading):
  if (!modal.querySelector("button[type='submit']")) return;

  // 3) Change the modal title:
  const header = getObjectFromClassNamePrefix("modal_title");
  if (header) {
    header.innerHTML = "Fishtank Live Extended Settings";
  }

  // 4) Grab some stylesheet‐derived classnames to reuse later:
  const labelClass = getClassNameFromPrefix("input_input");
  const inputWrapperClass = getClassNameFromPrefix("input_input-wrapper");

  // 5) Wipe out existing modal contents:
  modal.innerHTML = "";

  // 6) Our outer container
  const outerContainer = createEl("div", ["ftl-ext-settings-editor-container"]);

  // 7) Main tab‐bar
  const mainTabBar = createEl("div", ["ftl-ext-tab-controls"]);
  outerContainer.appendChild(mainTabBar);

  // 8) We'll keep track of:
  let
    currentGroupName = "",
    currentGroupContainer = null,
    craftingGroupContainer = null,
    staffMessageGroupContainer = null,
    adminMessageGroupContainer = null;
    pingsGroupContainer = null;
    ttsGroupContainer = null;
	

  const groupInputsMap = {};       // { groupName: [ wrapperDiv, … ] }
  const subGroupContainers = {};   // { groupName: { subGroupName: <div> } }
  const subGroupTabButtons = {};   // { groupName: { subGroupName: <button> } }
  let lastCreatedGroupContainer = null;

  // 9) Iterate over each settingDefinition exactly in order
  settingDefinitions.forEach(def => {
    // 9a) If we’ve changed to a new group, create its container + tab button
    if (def.group !== currentGroupName) {
      currentGroupName = def.group;

      // Create & hide the group’s main container:
      const groupDiv = createEl("div", ["ftl-ext-settings-group"]);
      groupDiv.dataset.group = def.group;
      groupDiv.style.display = "none";
      outerContainer.appendChild(groupDiv);
      lastCreatedGroupContainer = groupDiv;
      currentGroupContainer = groupDiv;

      // If it’s “Crafting”, remember it for later:
      if (def.group === "Crafting") {
        craftingGroupContainer = groupDiv;
      }
      // If it’s “Logging”, nothing to store until subgroups arrive.

      // Record data structures for subgroups:
      subGroupContainers[def.group] = {};
      subGroupTabButtons[def.group] = {};

      // Build a main‐tab button for this group:
      const mainTabButton = createButton(def.group, ["ftl-ext-settings-tab-button"], (event) => {
        // Hide every group
        document.querySelectorAll(".ftl-ext-settings-group").forEach(el => {
          el.style.display = "none";
        });
        // Show this group
        groupDiv.style.display = "block";

        // Deactivate any previously active main tab
        const prevActive = document.querySelector(".ftl-ext-settings-tab-button-active");
        if (prevActive) {
          prevActive.classList.remove("ftl-ext-settings-tab-button-active");
        }
        event.currentTarget.classList.add("ftl-ext-settings-tab-button-active");

        // If subgroups exist, show the first subgroup by default:
        const subContainers = subGroupContainers[def.group];
        const subButtons = subGroupTabButtons[def.group];
        const firstSubKey = Object.keys(subContainers)[0];
        if (firstSubKey) {
          // Hide all sub-containers
          Object.values(subContainers).forEach(c => c.style.display = "none");
          // Deactivate all sub‐tabs
          Object.values(subButtons).forEach(b => b.classList.remove("ftl-ext-settings-tab-button-active"));
          // Show & activate the first one
          subContainers[firstSubKey].style.display = "block";
          subButtons[firstSubKey].classList.add("ftl-ext-settings-tab-button-active");
        }
      });
      mainTabBar.appendChild(mainTabButton);

      // In that groupDiv, add an <h2> header:
      /*const groupHeader = document.createElement("h2");
      groupHeader.textContent = def.group;
      groupHeader.classList.add("ftl-ext-settings-group-header");
      groupDiv.appendChild(groupHeader);*/

      // Create a sub‐tab‐bar area inside this group:
      const subTabBar = createEl("div", ["ftl-ext-sub-tab-controls"]);
      groupDiv.appendChild(subTabBar);
    }

    // 9b) Handle subGroup if it exists
    if (def.subGroup) {
      const grp = def.group;
      const sub = def.subGroup;

      // If we haven’t made a container for this subgroup yet, do it now:
      if (!subGroupContainers[grp][sub]) {
        // Create its hidden container:
        const subDiv = createEl("div", ["ftl-ext-subgroup-container"]);
        subDiv.style.display = "none";
        lastCreatedGroupContainer.appendChild(subDiv);
        subGroupContainers[grp][sub] = subDiv;

        // Create the tab button for this subGroup
        const subBtn = createButton(sub, ["ftl-ext-settings-tab-button"], () => {
          // Hide other sub‐containers in this group
          Object.values(subGroupContainers[grp]).forEach(c => {
            c.style.display = "none";
          });
          // Deactivate all sub buttons
          Object.values(subGroupTabButtons[grp]).forEach(b => {
            b.classList.remove("ftl-ext-settings-tab-button-active");
          });
          // Show & activate this sub‐container
          subDiv.style.display = "block";
          subBtn.classList.add("ftl-ext-settings-tab-button-active");
        });
        // Add that button into the group’s subTabBar
        lastCreatedGroupContainer.querySelector(".ftl-ext-sub-tab-controls").appendChild(subBtn);
        subGroupTabButtons[grp][sub] = subBtn;

        // If it’s Logging→“Staff Messages” or “Admin Messages”, store for later:
        if (grp === "Logging" && sub === "Staff Messages") {
          staffMessageGroupContainer = subDiv;
        }
        if (grp === "Logging" && sub === "Admin Messages") {
          adminMessageGroupContainer = subDiv;
        }
		if (grp === "Logging" && sub === "Pings") {
          pingsGroupContainer = subDiv;
        }
		if (grp === "Logging" && sub === "TTS") {
          ttsGroupContainer = subDiv;
        }
      }

      // Now, for subGroups, the “currentGroupContainer” is that subDiv:
      currentGroupContainer = subGroupContainers[def.group][def.subGroup];
    }

    // 9c) For every definition, we create its <div class="ftl-ext-settings-wrapper"> and then the input+label
    const wrapperDiv = createEl("div", ["ftl-ext-settings-wrapper"]);
    wrapperDiv.dataset.settingKey = def.key;
    // Keep track of each group’s wrapperDiv so groupToggler can disable siblings later
    if (!groupInputsMap[def.group]) {
      groupInputsMap[def.group] = [];
    }
    groupInputsMap[def.group].push(wrapperDiv);

    // Build the label text node (for boolean & text-array cases)
    const labelEl = document.createElement("label");
    labelEl.textContent = "  " + def.displayName;

    // Now switch by def.type
    let inputEl;
    switch (def.type) {
      // ─── Boolean (checkbox) ─────────────────────────────────────────────────
      case "boolean":
        inputEl = createInput("checkbox", ['ftl-ext-input-checkbox'], { checked: SETTINGS[def.key] }, () => {
          updateSetting(def.key, inputEl.checked);
        });

        // If groupToggler: disable/enable siblings on change
        if (def.groupToggler) {
          inputEl.addEventListener("change", () => {
            const isChecked = inputEl.checked;
            groupInputsMap[def.group].forEach(siblingWrapper => {
              if (siblingWrapper.dataset.settingKey !== def.key) {
                // disable/enable any <input> or <textarea> inside that wrapper
                siblingWrapper.querySelectorAll("input, textarea").forEach(el => {
                  el.disabled = isChecked;
                  el.classList.toggle("ftl-ext-setting-disabled", isChecked);
                });
                // also toggle the label style
                const lbl = siblingWrapper.querySelector("label");
                if (lbl) {
                  lbl.classList.toggle("ftl-ext-setting-disabled", isChecked);
                }
              }
            });
          });
          // Trigger initial state
          setTimeout(() => inputEl.dispatchEvent(new Event("change")), 0);
        }

        // Append checkbox + label, then add to currentGroupContainer
        wrapperDiv.appendChild(inputEl);
        wrapperDiv.appendChild(labelEl);
        currentGroupContainer.appendChild(wrapperDiv);
        break;

      // ─── Number ────────────────────────────────────────────────────────────────
      case "number":
        // Create number <input>, plus wrapper div (to apply inputWrapperClass if present)
        const numberInputWrapper = createEl("div", []);
        if (inputWrapperClass) {
          numberInputWrapper.classList.add(inputWrapperClass);
        }
        inputEl = createInput("number", ["ftl-ext-input"], {
          min: def.min != null ? def.min : null,
          max: def.max != null ? def.max : null,
          value: SETTINGS[def.key]
        }, () => {
          updateSetting(def.key, Number(inputEl.value));
        });
        numberInputWrapper.appendChild(inputEl);

        // Label for the number field
        const numberLabelEl = document.createElement("label");
        numberLabelEl.textContent = def.displayName;
        if (labelClass) {
          numberLabelEl.classList.add(labelClass);
        }

        // wrapperDiv also gets a “ftl-ext-setting-wrapper” (in addition to ftl-ext-settings-wrapper)
        wrapperDiv.classList.add("ftl-ext-setting-wrapper");
        wrapperDiv.appendChild(numberInputWrapper);
        wrapperDiv.appendChild(numberLabelEl);

        currentGroupContainer.appendChild(wrapperDiv);
        break;

      // ─── Text-Array ─────────────────────────────────────────────────────────────
      case "text-array":
        // Adjust label to mention newline separation
        labelEl.innerHTML = def.displayName + '<br />(Separated by new lines, not case sensitive)';

        inputEl = createEl("textarea", ["ftl-ext-input"]);
        inputEl.rows = 5;
        // Pre-populate from SETTINGS[def.key] (an array → join by newline)
        inputEl.value = SETTINGS[def.key].join("\n");
        inputEl.addEventListener("input", () => {
          const lines = inputEl.value
            .split("\n")
            .map(v => v.trim())
            .filter(Boolean);
          updateSetting(def.key, lines);
        });

        wrapperDiv.classList.add("ftl-ext-setting-wrapper");
        wrapperDiv.appendChild(inputEl);
        wrapperDiv.appendChild(labelEl);
        currentGroupContainer.appendChild(wrapperDiv);
        break;
    }
  }); // end of settingDefinitions.forEach


  // 10) After all fields exist, insert “special” sections if needed:

  // ─── Crafting Search ───────────────────────────────────────────────────────────
  if (craftingGroupContainer) {
    const searchWrapper = createEl("div", ["ftl-ext-craft-search-wrapper"]);
    const searchInput = createInput("text", ["ftl-ext-crafting-search-input"], {
      placeholder: "Crafting search..."
    });
    const recipesContainer = createEl("div", []);
    recipesContainer.className = "ftl-ext-recipes-container";

    searchInput.addEventListener("input", e => {
      const query = e.target.value.trim().toLowerCase();
      recipesContainer.innerHTML = "";
      if (!query) return;

      const matched = (CRAFTING_RECIPES || []).filter(recipe =>
        recipe.ingredients.some(ing => ing.toLowerCase().includes(query)) ||
        recipe.result.toLowerCase().includes(query)
      );
      const table = createRecipeTable(matched, query);
      recipesContainer.appendChild(table);
    });

    searchWrapper.appendChild(searchInput);
    searchWrapper.appendChild(recipesContainer);
    craftingGroupContainer.appendChild(searchWrapper);
  }

  // ─── Admin Messages ─────────────────────────────────────────────────
  setupLogPanel(
    adminMessageGroupContainer,
    ADMIN_MESSAGE_LOG_KEY,
    "logAdminMessagesOrderAsc",
    (container, messages) => {
      messages.forEach(msg => {
        // Outer wrapper for each admin message
        const outer = createEl("div", ["ftl-ext-admin-message-wrapper"]);
        const inner = createEl("div", ["ftl-ext-admin-message-container"]);
		inner.dataset.timestamp = msg.timestamp;
    
        // Timestamp
        const timestampDiv = createEl("div", ["ftl-ext-admin-timestamp-container"]);
        timestampDiv.innerHTML = formatUnixTimestamp(msg.timestamp);
    
        // Body (title + message)
        const bodyWrapper = createEl("div", ["ftl-ext-admin-body-container"]);
    
        const titleDiv = createEl("div", ["ftl-ext-admin-title"]);
        titleDiv.textContent = typeof msg.header === "string" ? msg.header : "";
    
        const messageDiv = createEl(
          "div",
          ["ftl-ext-admin-message-container-message-container"]
        );
        messageDiv.textContent = typeof msg.message === "string" ? msg.message : "";
    
        // Debugging guards
        if (DEBUGGING && typeof msg.header !== "string") {
          console.warn("Admin message header not a string:", msg.header);
        }
        if (DEBUGGING && typeof msg.message !== "string") {
          console.warn("Admin message message not a string:", msg.message);
        }
    
        // Assemble DOM
        bodyWrapper.append(titleDiv, messageDiv);
        inner.append(timestampDiv, bodyWrapper);
        outer.appendChild(inner);
    
        // Mount into the panel
        container.appendChild(outer);
      });
    },
    ["ftl-ext-admin-messages-wrapper"]
  );
  
  // ─── Staff Messages ─────────────────────────────────────────────────
  setupLogPanel(
    staffMessageGroupContainer,
	STAFF_MESSAGE_LOG_KEY,
    "logStaffMessagesOrderAsc",
	(container, messages) => {
      messages.forEach(msg => {
        const wrapper = createEl("div", ["ftl-ext-staff-message-wrapper"]);
        const inner   = createEl("div", ["ftl-ext-staff-message-container"]);
		inner.dataset.timestamp = msg.timestamp;
		
        inner.innerHTML = msg.html;
        wrapper.appendChild(inner);
        // Un-hide & make clickable:
        wrapper.querySelectorAll('[class*="chat-message-default_chat-message-default"]').forEach(m => {
          m.style.display = "";
          makeUsernameClickable(m);
        });
        container.appendChild(wrapper);
      });
    },
    ["ftl-ext-staff-messages-wrapper"]
  );
  
  // ─── Pings ────────────────────────────────────────────────────────────
  setupLogPanel(
    pingsGroupContainer,
	PINGS_LOG_KEY,
    "logPingsOrderAsc",
	(container, messages) => {
      messages.forEach(msg => {
        const wrapper = createEl("div", ["ftl-ext-staff-message-wrapper"]);
        const inner   = createEl("div", ["ftl-ext-staff-message-container"]);
		inner.dataset.timestamp = msg.timestamp;
		
        inner.innerHTML = msg.html;
        wrapper.appendChild(inner);
        // Un-hide & click
        wrapper.querySelectorAll('[class*="chat-message-default_chat-message-default"]').forEach(m => {
          m.style.display = "";
          makeUsernameClickable(m);
        });
        container.appendChild(wrapper);
      });
    },
    ["ftl-ext-staff-messages-wrapper"]
  );
  
  // ─── TTS ──────────────────────────────────────────────────────────────
  setupLogPanel(
    ttsGroupContainer,
	TTS_LOG_KEY,
    "logTtsOrderAsc",
	(container, messages) => {
      messages.forEach(msg => {
        const wrapper = createEl("div", ["ftl-ext-admin-message-wrapper"]);
        const inner   = createEl("div", ["ftl-ext-admin-message-container"]);
		inner.dataset.timestamp = msg.timestamp;
		
        const tsDiv   = createEl("div", ["ftl-ext-admin-timestamp-container"]);
        tsDiv.innerHTML = formatUnixTimestamp(msg.timestamp);
	  
        const roomDiv = createEl("div", ["ftl-ext-admin-room"]);
        roomDiv.textContent = msg.room || "";
	  
        const textDiv = createEl("div", ["ftl-ext-admin-message-container-message-container"]);
        textDiv.textContent = msg.message || "";
	  
        const fromSpan = createEl("span", ["ftl-ext-clickable-username"]);
		msg.from = typeof msg.from === 'string' ? msg.from.trim() : null;
        fromSpan.textContent = msg.from ? "@" + msg.from : "";
        fromSpan.addEventListener("click", () => usernameClicked(msg.from));
	  
        const body = createEl("div", ["ftl-ext-admin-body-container"]);
        body.append(roomDiv, textDiv, fromSpan);
	  
        inner.append(tsDiv, body);
        wrapper.appendChild(inner);
        container.appendChild(wrapper);
      });
    },
    ["ftl-ext-admin-messages-wrapper"]
  );

  // 11) Show the first group by default
  const firstGroupDiv = outerContainer.querySelector(".ftl-ext-settings-group");
  if (firstGroupDiv) {
    firstGroupDiv.style.display = "block";
  }
  // Activate the first main tab button
  const firstMainTabBtn = mainTabBar.querySelector(".ftl-ext-settings-tab-button");
  if (firstMainTabBtn) {
    firstMainTabBtn.classList.add("ftl-ext-settings-tab-button-active");
  }

  // 12) Finally, append our entire `outerContainer` into the modal
  modal.appendChild(outerContainer);

  // 13) Build the “Tip” section at the very bottom
  const tipSection = createEl("div", ["ftl-ext-tip-section"]);

  // — Tip text + link
  const tipText = document.createElement("span");
  tipText.textContent = "Like this extension? ";
  const tipLink = createEl("span", ["ftl-ext-tip-link"]);
  tipLink.textContent = "TIP";
  tipLink.addEventListener("click", e => {
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
        detail: JSON.stringify({ modal: "Tip", data: tipData })
      }));
    }, 100);
  });
  tipSection.appendChild(tipText);
  tipSection.appendChild(tipLink);
  
  // ── Insert a line break ─────────────────────────────────────────────────
  tipSection.appendChild(document.createTextNode("\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0"));
  
  // — Contribute text + link
  const contributeText = document.createElement("span");
  contributeText.textContent = "Want to contribute? ";
  const contributeLink = createEl("a", ["ftl-ext-tip-link"]);
  contributeLink.textContent = "GITHUB";
  contributeLink.href = "https://github.com/BarryThePirate/FishtankLiveExtended";
  contributeLink.target = "_blank";
  tipSection.appendChild(contributeText);
  tipSection.appendChild(contributeLink);
  
  modal.appendChild(tipSection);
}

/**
 * @param {HTMLElement} mountPoint
 * @param {string}      logKey
 * @param {string}      orderSettingKey
 * @param {Function}    renderFn
 * @param {string[]}    wrapperClasses
 */
function setupLogPanel(mountPoint, logKey, orderSettingKey, renderFn, wrapperClasses = []) {
  if (!mountPoint) return;

  // Wrapper (preserves your CSS hooks)
  const wrapper = createEl("div", wrapperClasses);

  // Sort button + state
  let isAscending = Boolean(SETTINGS[orderSettingKey]);
  let currentRoom   = "";
  const allMessages = () => loadLog(logKey, isAscending) || [];
  const iconClass = "ftl-ext-svg-button";
  const orderBtn = createEl("button", ["ftl-ext-svg-button"]);
  const orderIcon = createEl("div", [iconClass]);
  orderIcon.innerHTML = isAscending ? SVG_UP_ARROW : SVG_DOWN_ARROW;
  orderBtn.appendChild(orderIcon);
  orderBtn.addEventListener("click", () => {
    isAscending = !isAscending;
    updateSetting(orderSettingKey, isAscending);
    orderIcon.innerHTML = isAscending ? SVG_UP_ARROW : SVG_DOWN_ARROW;
    renderPanel();
  });
  
  // If it's the TTS log, event listener for dropdown change
  let filterSelect = null;
  if (orderSettingKey === "logTtsOrderAsc") {
    filterSelect = createEl("select", ["ftl-ext-log-filter", 'select_select__UlP30']);
    filterSelect.style.left = "0px";
    filterSelect.addEventListener("change", e => {
      currentRoom = e.target.value;
      renderPanel();
    });
  }

  // Delete button (with confirmation)
  const deleteBtn = createEl("button", ["ftl-ext-svg-button"]);
  deleteBtn.innerHTML = `<span><div class="${iconClass}">${SVG_GARBAGE_CAN}</div></span>`;

  let confirmRow = null;

  deleteBtn.addEventListener("click", () => {
    if (confirmRow) return;

    // Build confirmation row
    confirmRow = createEl("div", ["ftl-ext-confirmation-row"]);
    confirmRow.textContent = "Are you sure? ";

    const yesBtn = createButton("Yes", ["ftl-ext-confirm-yes"], () => {
      deleteLog(logKey);
      confirmRow.remove();
      confirmRow = null;
    });
    const noBtn = createButton("No", ["ftl-ext-confirm-no"], () => {
      confirmRow.remove();
      confirmRow = null;
    });
    confirmRow.append(yesBtn, noBtn);

    // Position it absolutely next to the deleteBtn
    confirmRow.style.position = "absolute";
    // Calculate left offset: deleteBtn’s left edge + its width + small gap
    const left = deleteBtn.offsetLeft + deleteBtn.offsetWidth + 8;
    confirmRow.style.left = left + "px";
    confirmRow.style.top = "50%";
    confirmRow.style.transform = "translateY(-50%)";

    // Insert into the controlsRow (below we’ll create it)
    controlsRow.appendChild(confirmRow);
  });

  // Entries container
  const entriesContainer = createEl("div", []);

  // Controls row, centered & relative
  const controlsRow = createEl("div", ["ftl-ext-log-controls"]);
  controlsRow.style.position = "relative";  // allow absolute children
  controlsRow.append(orderBtn, deleteBtn);
  if (filterSelect) controlsRow.appendChild(filterSelect);
  wrapper.append(controlsRow, entriesContainer);

  // Mount
  mountPoint.appendChild(wrapper);

  // renderPanel implementation
  function renderPanel() {
    entriesContainer.innerHTML = "";
	
	// Rebuild the room dropdown each time (keeps it in sync)
    if (filterSelect) {
      const rooms = Array.from(
        new Set(allMessages().map(m => m.room).filter(Boolean))
      );
	  rooms.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      filterSelect.innerHTML = `<option value="">All</option>` +
        rooms.map(r => `
          <option value="${r}"${r === currentRoom ? " selected" : ""}>
            ${r}
          </option>
        `).join("");
    }
	
	// — load & optionally filter
    let messages = allMessages();
    if (currentRoom) {
      messages = messages.filter(m => m.room === currentRoom);
    }
    renderFn(entriesContainer, messages);
	
	const now = Date.now();
    entriesContainer.querySelectorAll("[data-timestamp]").forEach(el => {
	  // Add a flashing animation for the new elements
      const ts = Number(el.dataset.timestamp);
      if (!isNaN(ts) && now - ts < 1000) {
        el.classList.add("ftl-ext-new-flash");
      }
	  
	  // Remove the class when its animation finishes, so it won't replay
      el.addEventListener("animationend", () => {
        el.classList.remove("ftl-ext-new-flash");
      }, { once: true });
    });
  }

  // Initial render
  renderPanel();
  
  // Live-update: re-draw whenever saveLog/deleteLog fire our event
  window.addEventListener("ftl-ext-log-updated", (e) => {
    if (e.detail.key === logKey) {
      renderPanel();
    }
  });
}


// ============================
//  CREATE “FTL EXTENDED” BUTTON
// ============================

/**
 * Builds and injects the “FTL Extended” button into the user‐dropdown.
 * When clicked, it opens the Tip modal, waits 100ms, then calls
 * injectPluginSettingsIntoModal() and observes for any late‐loading inputs.
 */
function createCustomButton() {
  // Prevent duplicates
  if (document.querySelector('.ftl-ext-settings-button')) return;
  
  const iconClass = getClassNameFromPrefix("icon_icon");
  const pluginBtn = createEl("button", ["ftl-ext-settings-button"]);
  pluginBtn.dataset.pluginButton = "true";

  // Insert SVG + text
  pluginBtn.innerHTML = `
    <span>
      <div class="${iconClass}">${SVG_SKULL_AND_CROSSBONES}</div>
    </span>
    FTL Extended
  `;

  pluginBtn.addEventListener("click", () => {
    // Close dropdown if open
    const openDropdown = getObjectFromClassNamePrefix("top-bar-user_show");
    if (openDropdown) {
      openDropdown.classList.remove(getClassNameFromPrefix("top-bar-user_show"));
    }

    // Open a bare “Tip” modal
    document.dispatchEvent(new CustomEvent("modalopen", {
      detail: JSON.stringify({ modal: "Tip", data: [] })
    }));

    // After 100ms, inject our settings UI
    setTimeout(() => {
      const modalElem = document.getElementById("modal");
      if (!modalElem) return;
      injectPluginSettingsIntoModal();
      // Watch for any dynamically added <div class="input_input-wrapper"> inside the modal
      observeObjectForTarget(modalElem, "input_input-wrapper", injectPluginSettingsIntoModal, false);
    }, 100);
  });

  // Insert before “Billing” in the user dropdown, or append at end
  const dropdown = getObjectFromClassNamePrefix("top-bar-user_dropdown");
  if (!dropdown) return;
  const billingBtn = Array.from(dropdown.querySelectorAll("button"))
    .find(btn => btn.textContent.trim() === "Billing");
  if (billingBtn) {
    dropdown.insertBefore(pluginBtn, billingBtn);
  } else {
    dropdown.appendChild(pluginBtn);
  }
}


// ============================
//  INITIALIZE
// ============================

// As soon as this script loads, insert our custom button:
createCustomButton();
