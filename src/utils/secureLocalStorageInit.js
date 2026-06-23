import CryptoJS from "crypto-js";

const SECRET_KEY = import.meta.env.VITE_SECRET_KEY || "your-secret-key";

// --- Encryption helpers ---
const encrypt = (data) => {
  try {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    return CryptoJS.AES.encrypt(str, SECRET_KEY).toString();
  } catch (err) {

    return data;
  }
};

const decrypt = (cipherText) => {
  try {
    if (!cipherText || typeof cipherText !== "string") return cipherText;
    if (!cipherText.startsWith("U2FsdGVkX1")) return cipherText; // Only decrypt valid AES data

    const bytes = CryptoJS.AES.decrypt(cipherText, SECRET_KEY);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (err) {

    return cipherText;
  }
};

// --- Monkey patch localStorage ---
(function enforceEncryptedLocalStorage() {
  const originalSet = Storage.prototype.setItem;
  const originalGet = Storage.prototype.getItem;
  const originalRemove = Storage.prototype.removeItem;

  // ✅ Encrypt automatically when setting
  Storage.prototype.setItem = function (key, value) {
    try {
      if (typeof value === "string" && value.startsWith("U2FsdGVkX1")) {
        // already encrypted
        originalSet.call(this, key, value);
      } else {
        const encrypted = encrypt(value);
        originalSet.call(this, key, encrypted);
      }
    } catch (err) {

      originalSet.call(this, key, value);
    }
  };

  // ✅ Decrypt automatically when getting
  Storage.prototype.getItem = function (key) {
    try {
      const encrypted = originalGet.call(this, key);
      if (!encrypted) return null;

      const decrypted = decrypt(encrypted);

      // If it’s JSON, parse safely
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted; // plain string
      }
    } catch (err) {
    
      return null;
    }
  };

  Storage.prototype.removeItem = function (key) {
    originalRemove.call(this, key);
  };
})();
