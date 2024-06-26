import * as yup from "yup";

const categorySchema = yup.object({
  category: yup
    .string()
    .min(2, "category is too short")
    .max(50, "category is too long"),
});

export default categorySchema;
