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

module.exports = {
  calculatePersonalRiskScore,
};