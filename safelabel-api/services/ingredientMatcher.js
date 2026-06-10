const ingredients = require("../data/ingredients.json");
const restrictedIngredients = require("../data/restrictedIngredients.json");
const allergenIngredients = require("../data/allergenIngredients.json");

function normalize(text) {
  if (!text) return "";
  return String(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9a-z가-힣]+/gi, "")
    .toLowerCase();
}

function tokensOf(text) {
  const t = String(text || "")
    .toLowerCase()
    .replace(/[^0-9a-z가-힣\s]+/gi, " ");
  return t
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function matchIngredients(extractedIngredients) {
  return extractedIngredients.map((name) => {
    const inputNorm = normalize(name);
    const inputTokens = tokensOf(name);

    const matched = ingredients.find((item) => {
      const aliases = item.aliases || [];

      const candidates = [item.standardName, item.englishName, ...aliases]
        .filter(Boolean)
        .map((s) => String(s));

      const norms = candidates.map(normalize);

      // exact or contains checks
      if (norms.includes(inputNorm)) return true;
      if (
        norms.some((n) => n && (n.includes(inputNorm) || inputNorm.includes(n)))
      )
        return true;

      // token overlap: if any token of input exists in any candidate name
      for (const n of norms) {
        if (!n) continue;
        for (const t of inputTokens) {
          if (t.length >= 3 && n.includes(t)) return true;
        }
      }

      return false;
    });

    const standardName = matched?.standardName || name;

    const restricted = restrictedIngredients.find(
      (item) => item.standardName === standardName,
    );

    const allergen = allergenIngredients.find(
      (item) => item.standardName === standardName,
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
