const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{1,48}[a-z0-9])$/;
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,189}\.[^\s@]{2,63}$/;

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidUsername(value) {
  return USERNAME_REGEX.test(normalizeUsername(value));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_REGEX.test(email) && !email.includes('..');
}

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isValidText(value, { min = 0, max = 200 } = {}) {
  const text = normalizeText(value);
  return text.length >= min && text.length <= max;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 20);
}

module.exports = {
  EMAIL_REGEX,
  USERNAME_REGEX,
  isValidEmail,
  isValidText,
  isValidUsername,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  normalizeUsername
};
