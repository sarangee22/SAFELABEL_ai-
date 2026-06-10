function calculatePersonalRiskScore(matchedIngredients, userProfile = {}) {
  let score = 10;
  const reasons = [];

  matchedIngredients.forEach((ingredient) => {
    if (ingredient.isRestricted) {
      score += ingredient.restrictedRiskWeight || 20;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "restricted",
        reason:
          ingredient.restrictedReason ||
          "사용 조건 또는 제한 정보를 확인해 주세요.",
      });
    }

    if (ingredient.isAllergen) {
      score += ingredient.allergenRiskWeight || 20;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "allergen",
        reason:
          ingredient.allergenReason ||
          "알레르기 유발 가능성이 있어 주의가 필요합니다.",
      });
    }

    if (matchesProfileList(ingredient, userProfile.allergies)) {
      score += 35;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "user_allergy",
        reason: "사용자 알레르기 정보와 일치합니다.",
      });
    }

    if (matchesProfileList(ingredient, userProfile.avoidIngredients)) {
      score += 25;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "user_avoid",
        reason: "사용자가 피하고 싶은 성분과 일치합니다.",
      });
    }

    if (
      Array.isArray(userProfile.symptoms) &&
      userProfile.symptoms.length > 0 &&
      (ingredient.isRestricted || ingredient.isAllergen)
    ) {
      score += 5;
      reasons.push({
        ingredient: ingredient.standardName,
        type: "symptom_match",
        reason:
          "피부 불편 증상이 설정되어 있어 확인된 주의 성분을 더 보수적으로 평가했습니다.",
      });
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

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^0-9a-z가-힣]/g, "")
    .trim();
}

function matchesProfileList(ingredient, profileItems) {
  if (!Array.isArray(profileItems) || profileItems.length === 0) {
    return false;
  }

  const ingredientNames = [
    ingredient.originalName,
    ingredient.standardName,
    ingredient.englishName,
  ]
    .map(normalizeName)
    .filter(Boolean);

  return profileItems.some((profileItem) => {
    const target = normalizeName(profileItem);

    if (!target) return false;

    return ingredientNames.some(
      (name) =>
        name === target || name.includes(target) || target.includes(name),
    );
  });
}

module.exports = {
  calculatePersonalRiskScore,
};
