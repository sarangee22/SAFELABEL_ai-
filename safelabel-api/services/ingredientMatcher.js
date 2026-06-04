const ingredients = require("../data/ingredients.json");
const restrictedIngredients = require("../data/restrictedIngredients.json");
const allergenIngredients = require("../data/allergenIngredients.json");

function matchIngredients(extractedIngredients) {
  return extractedIngredients.map((name) => {
    const matched = ingredients.find((item) => {
      const aliases = item.aliases || [];

      return (
        item.standardName.includes(name) ||
        name.includes(item.standardName) ||
        aliases.some((alias) => name.includes(alias) || alias.includes(name))
      );
    });

    const standardName = matched?.standardName || name;

    const restricted = restrictedIngredients.find(
      (item) => item.standardName === standardName
    );

    const allergen = allergenIngredients.find(
      (item) => item.standardName === standardName
    );

    return {
      originalName: name,
      standardName,
      englishName: matched?.englishName || "",
      description: matched?.description || "",
      isMatched: Boolean(matched),
      isRestricted: Boolean(restricted),
      isAllergen: Boolean(allergen),
      restrictedReason: restricted?.reason || "",
      allergenReason: allergen?.reason || "",
      riskWeight: (restricted?.riskWeight || 0) + (allergen?.riskWeight || 0),
    };
  });
}

module.exports = {
  matchIngredients,
};