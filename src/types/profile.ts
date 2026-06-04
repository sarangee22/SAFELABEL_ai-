export type UserProfile = {
  name?: string;
  skinType?: string;
  sensitivity?: string;
  concerns?: string[];
  avoidIngredients?: string[];
  allergies?: string[];
  isSensitive?: boolean;
  updatedAt?: string;
};
