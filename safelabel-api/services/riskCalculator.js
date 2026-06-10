function calculatePersonalRiskScore(matchedIngredients, userProfile = {}) {
  let score = 10;
  const reasons = [];

  matchedIngredients.forEach((ingredient) => {
    if (ingredient.isRestricted) {
      score += ingredient.riskWeight || 20;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "restricted",
        reason: ingredient.restrictedReason,
      });
    }

    if (ingredient.isAllergen) {
      score += ingredient.riskWeight || 20;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "allergen",
        reason: ingredient.allergenReason,
      });
    }

    if (userProfile.allergies?.includes(ingredient.standardName)) {
      score += 35;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "user_allergy",
        reason: "사용자 알레르기 정보와 일치합니다.",
      });
    }

    // User-specified avoid ingredients (keywords/categories) should increase risk
    if (
      Array.isArray(userProfile.avoidIngredients) &&
      userProfile.avoidIngredients.length > 0
    ) {
      const ingredientText = (
        (ingredient.standardName || "") +
        " " +
        (ingredient.englishName || "")
      ).toLowerCase();

      const matchedAvoid = userProfile.avoidIngredients.some((avoid) => {
        try {
          return avoid && ingredientText.includes(String(avoid).toLowerCase());
        } catch (e) {
          return false;
        }
      });

      if (matchedAvoid) {
        score += 20;
        reasons.push({
          ingredient: ingredient.standardName,
          type: "user_avoid",
          reason: "사용자가 회피하도록 설정한 성분/유형과 일치합니다.",
        });
      }
    }
  });

  if (userProfile.sensitivity === "민감") {
    score += 10;
    reasons.push({
      ingredient: "사용자 프로필",
      type: "sensitivity",
      reason: "민감 피부 설정이 반영되었습니다.",
    });
  }

  if (userProfile.sensitivity === "매우 민감") {
    score += 18;
    reasons.push({
      ingredient: "사용자 프로필",
      type: "sensitivity",
      reason: "매우 민감 피부 설정이 반영되었습니다.",
    });
  }

  // Consider symptom-driven sensitivity: map common symptoms to vulnerable categories
  if (Array.isArray(userProfile.symptoms) && userProfile.symptoms.length > 0) {
    const symptomMap = {
      "붉어짐(홍조)": ["alcohol", "ethanol", "향료", "fragrance"],
      가려움: ["fragrance", "paraben", "essential oil"],
      건조: ["alcohol", "ethanol"],
      "트러블/여드름": ["coconut", "lauric", "sulfate"],
      "눈주위 민감": ["essential oil", "fragrance"],
    };

    matchedIngredients.forEach((ingredient) => {
      const text = (
        (ingredient.standardName || "") +
        " " +
        (ingredient.englishName || "")
      ).toLowerCase();

      userProfile.symptoms.forEach((sym) => {
        const keywords = symptomMap[sym] || [];
        const matched = keywords.some((k) => text.includes(k));
        if (matched) {
          score += 8;
          reasons.push({
            ingredient: ingredient.standardName,
            type: "symptom_match",
            reason: `사용자 증상(${sym})과 관련된 성분일 수 있습니다.`,
          });
        }
      });
    });
  }

  const riskScore = Math.min(100, score);

  let riskLevel = "low";
  if (riskScore >= 61) riskLevel = "high";
  else if (riskScore >= 31) riskLevel = "medium";

  return {
    riskScore,
    riskLevel,
    reasons,
  };
}

module.exports = {
  calculatePersonalRiskScore,
};
