function findAllRecipesByIngredients(ingredients) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return [];

  return CRAFTING_RECIPES.filter(recipe => {
    if (ingredients.length === 1) {
      return recipe.ingredients.includes(ingredients[0]);
    } else if (ingredients.length === 2) {
      // Match both ingredients exactly, including duplicates
      const sortedInput = [...ingredients].sort();
      const sortedRecipe = [...recipe.ingredients].sort();
      return sortedInput[0] === sortedRecipe[0] && sortedInput[1] === sortedRecipe[1];
    }
    return false;
  });
}

function createRecipeTable(recipes, query) {
  const table = document.createElement("table");
  table.style.fontFamily = "monospace";
  table.style.marginTop = "20px";
  table.style.marginBottom = "10px";
  table.style.borderSpacing = "8px 4px";

  recipes.forEach(recipe => {
    const [a, b] = recipe.ingredients;
    const queryMatch = b.toLowerCase().includes(query);
    const first = queryMatch ? b : a;
    const second = queryMatch ? a : b;

    const row = document.createElement("tr");

    const td1 = document.createElement("td");
    td1.textContent = first;
    const tdPlus = document.createElement("td");
    tdPlus.textContent = "+";
    const td2 = document.createElement("td");
    td2.textContent = second;
    const tdEquals = document.createElement("td");
    tdEquals.textContent = "=";
    const tdResult = document.createElement("td");
    tdResult.textContent = recipe.result;

    row.appendChild(td1);
    row.appendChild(tdPlus);
    row.appendChild(td2);
    row.appendChild(tdEquals);
    row.appendChild(tdResult);

    table.appendChild(row);
  });

  return table;
}

function displayCraftingRecipesForItem(modal) {
  if (!SETTINGS.displayRecipesInCraftModal || !CRAFTING_RECIPES) return;

  const modalHeader = getObjectFromClassNamePrefix('modal_header', modal);
  if (!modalHeader) return;

  const craftItems = getAllObjectsFromClassNamePrefix('craft-item-modal_name', modal);
  if (!craftItems || craftItems.length === 0) return;

  const craftItem1 = craftItems[0].textContent.trim();
  let craftItem2 = craftItems[1].textContent.trim();

  if (craftItem1 === 'Select an item') {
    const existing = modalHeader.querySelector('.ftl-ext-recipes');
    if (existing) existing.remove();
    return;
  }
  if (craftItem2 === 'Select an item') craftItem2 = null;

  const existing = modalHeader.querySelector('.ftl-ext-recipes');
  if (existing) existing.remove();

  const recipesContainer = document.createElement('span');
  recipesContainer.classList.add('ftl-ext-recipes');
  recipesContainer.style.display = "flex";
  recipesContainer.style.justifyContent = "center";

  const ingredients = [craftItem1];
  if (craftItem2) ingredients.push(craftItem2);
  const matchingRecipes = findAllRecipesByIngredients(ingredients);

  if (matchingRecipes.length > 0) {
    const table = createRecipeTable(matchingRecipes, craftItem1.toLowerCase());
    recipesContainer.appendChild(table);
  } else if (craftItem2) {
    const fallback = document.createElement('div');
    fallback.textContent = `${craftItem1} + ${craftItem2} = Trash Heap`;
    fallback.style.marginTop = "20px";
    fallback.style.marginBottom	= "10px";
    fallback.style.borderSpacing = "8px 4px";
    recipesContainer.appendChild(fallback);
  }

  modalHeader.appendChild(recipesContainer);
}