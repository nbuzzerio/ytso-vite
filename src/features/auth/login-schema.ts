import * as yup from "yup";

export const loginSchema = yup.object({
  name: yup
    .string()
    .trim()
    .when("$signUp", {
      is: true,
      then: (schema) =>
        schema
          .required("Enter your name.")
          .min(3, "Use at least 3 characters.")
          .max(50),
      otherwise: (schema) => schema.strip(),
    }),
  email: yup
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(255)
    .required("Enter your email address."),
  password: yup
    .string()
    .min(5, "Use at least 5 characters.")
    .required("Enter your password.")
    .when("$signUp", {
      is: true,
      then: (schema) =>
        schema
          .max(72, "Use no more than 72 characters.")
          .test(
            "password-bytes",
            "This password is too long. Use a shorter password.",
            (value) => !value || new TextEncoder().encode(value).length <= 72,
          ),
      otherwise: (schema) =>
        schema.max(255, "Use no more than 255 characters."),
    }),
  confirmPassword: yup.string().when("$signUp", {
    is: true,
    then: (schema) =>
      schema
        .required("Confirm your password.")
        .oneOf([yup.ref("password")], "Passwords do not match."),
    otherwise: (schema) => schema.strip(),
  }),
});

export type LoginValues = yup.InferType<typeof loginSchema>;
