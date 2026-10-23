import { HttpError } from "../validation/request.js";

function emailPattern(email, flags = "") {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, flags);
}

export function findUserByEmail(UserModel, email) {
  // Registration rejects any existing case variant without rewriting accounts.
  return UserModel.findOne({ email: emailPattern(email, "i") });
}

export async function findUserForLogin(UserModel, email) {
  // A case-sensitive regex avoids the email schema's lowercase query setter.
  // Legacy accounts may legitimately differ only in the case of their address.
  const exact = await UserModel.findOne({ email: emailPattern(email) });
  if (exact) return exact;
  const matches = await UserModel.find({
    email: emailPattern(email, "i"),
  }).limit(2);
  return matches.length === 1 ? matches[0] : null;
}

export async function loadUser(UserModel, id) {
  const user = await UserModel.findById(id);
  if (!user)
    throw new HttpError(
      401,
      "Your account is unavailable. Please sign in again.",
    );
  return user;
}

// Retry against the latest document so embedded-array duplicate checks stay safe.
export async function updateLibrary(UserModel, id, mutate) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const user = await loadUser(UserModel, id);
    const result = mutate(user);
    try {
      await user.save();
      return result;
    } catch (error) {
      if (error.name !== "VersionError") throw error;
      if (attempt === 2) {
        throw new HttpError(
          409,
          "Your library changed in another tab. Please try again.",
        );
      }
    }
  }
}
