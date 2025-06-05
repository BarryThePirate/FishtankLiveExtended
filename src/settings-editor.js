// =======================
//  CONSTANTS
// =======================

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

  // ─── Staff Messages Log ─────────────────────────────────────────────────────────
  if (staffMessageGroupContainer) {
    const staffWrapper = createEl("div", ["ftl-ext-staff-messages-wrapper"]);
    const staffMessages = loadStaffMessages();
    staffMessages.sort((a, b) => b.timestamp - a.timestamp);

    staffMessages.forEach(msg => {
      const msgOuter = createEl("div", ["ftl-ext-staff-message-wrapper"]);
      const msgInner = createEl("div", ["ftl-ext-staff-message-container"]);
      msgInner.innerHTML = msg.html;
      msgOuter.appendChild(msgInner);
      staffWrapper.appendChild(msgOuter);
    });

    // Un-hide any nested chat‐message elements:
    const nested = staffWrapper.querySelectorAll('[class*="chat-message-default_chat-message-default"]');
    nested.forEach(m => {
      m.style.display = "";
    });

    staffMessageGroupContainer.appendChild(staffWrapper);
  }

  // ─── Admin Messages Log ─────────────────────────────────────────────────────────
  if (adminMessageGroupContainer) {
    const adminWrapper = createEl("div", ["ftl-ext-admin-messages-wrapper"]);
    const adminMessages = loadAdminMessages();
    adminMessages.sort((a, b) => b.timestamp - a.timestamp);

    adminMessages.forEach(msg => {
      const outer = createEl("div", ["ftl-ext-admin-message-wrapper"]);
      const inner = createEl("div", ["ftl-ext-admin-message-container"]);

      const timestampDiv = createEl("div", ["ftl-ext-admin-timestamp-container"]);
      timestampDiv.innerHTML = formatUnixTimestamp(msg.timestamp);

      const bodyWrapper = createEl("div", ["ftl-ext-admin-body-container"]);

      const titleDiv = createEl("div", ["ftl-ext-admin-title"]);
      titleDiv.textContent = msg.header?.toUpperCase();

      const messageDiv = createEl("div", ["ftl-ext-admin-message-container-message-container"]);
      messageDiv.textContent = msg.message?.toUpperCase();

      bodyWrapper.appendChild(titleDiv);
      bodyWrapper.appendChild(messageDiv);
      inner.appendChild(timestampDiv);
      inner.appendChild(bodyWrapper);
      outer.appendChild(inner);
      adminWrapper.appendChild(outer);
    });

    adminMessageGroupContainer.appendChild(adminWrapper);
  }
  
  // ─── Pings Log ─────────────────────────────────────────────────────────
  if (staffMessageGroupContainer) {
    const pingsWrapper = createEl("div", ["ftl-ext-staff-messages-wrapper"]);
    const pings = loadPings();
    pings.sort((a, b) => b.timestamp - a.timestamp);

    pings.forEach(msg => {
      const msgOuter = createEl("div", ["ftl-ext-staff-message-wrapper"]);
      const msgInner = createEl("div", ["ftl-ext-staff-message-container"]);
      msgInner.innerHTML = msg.html;
      msgOuter.appendChild(msgInner);
      pingsWrapper.appendChild(msgOuter);
    });

    // Un-hide any nested chat‐message elements:
    const nested = pingsWrapper.querySelectorAll('[class*="chat-message-default_chat-message-default"]');
    nested.forEach(m => {
      m.style.display = "";
    });

    pingsGroupContainer.appendChild(pingsWrapper);
  }
  
  // ─── TTS Log ─────────────────────────────────────────────────────────
  if (ttsGroupContainer) {
    const ttsWrapper = createEl("div", ["ftl-ext-admin-messages-wrapper"]);
    const tts = loadTts();
    tts.sort((a, b) => b.timestamp - a.timestamp);

    tts.forEach(msg => {
      const outer = createEl("div", ["ftl-ext-admin-message-wrapper"]);
      const inner = createEl("div", ["ftl-ext-admin-message-container"]);

      const timestampDiv = createEl("div", ["ftl-ext-admin-timestamp-container"]);
      timestampDiv.innerHTML = formatUnixTimestamp(msg.timestamp);
	  
	  //const fromDiv = createEl("div", ["ftl-ext-admin-timestamp-container"]);
     // fromDiv.innerHTML = msg.from;

      const bodyWrapper = createEl("div", ["ftl-ext-admin-body-container"]);

      const titleDiv = createEl("div", ["ftl-ext-admin-title"]);
      titleDiv.textContent = msg.room;

      const messageDiv = createEl("div", ["ftl-ext-admin-message-container-message-container"]);
      messageDiv.textContent = msg.message;

      bodyWrapper.appendChild(titleDiv);
      bodyWrapper.appendChild(messageDiv);
      inner.appendChild(timestampDiv);
	  //inner.appendChild(fromDiv);
      inner.appendChild(bodyWrapper);
      outer.appendChild(inner);
      ttsWrapper.appendChild(outer);
    });

    ttsGroupContainer.appendChild(ttsWrapper);
  }

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


// ============================
//  CREATE “FTL EXTENDED” BUTTON
// ============================

/**
 * Builds and injects the “FTL Extended” button into the user‐dropdown.
 * When clicked, it opens the Tip modal, waits 100ms, then calls
 * injectPluginSettingsIntoModal() and observes for any late‐loading inputs.
 */
function createCustomButton() {
  const iconClass = getClassNameFromPrefix("icon_icon");
  const pluginBtn = createEl("button", ["ftl-ext-settings-button"]);
  pluginBtn.dataset.pluginButton = "true";

  // Insert SVG + text
  pluginBtn.innerHTML = `
    <span>
      <div class="${iconClass}">${iconSVG}</div>
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
