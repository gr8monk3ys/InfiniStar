module.exports = {
  generateSecret: () => "TEST_SECRET",
  generateURI: ({ issuer, label, secret }) =>
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(
      label
    )}?secret=${encodeURIComponent(secret)}`,
  verifySync: () => ({ valid: false }),
}
