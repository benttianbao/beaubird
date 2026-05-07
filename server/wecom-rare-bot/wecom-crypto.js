const { createCipheriv, createDecipheriv, createHash, timingSafeEqual } = require("node:crypto");

function getAesKey(encodingAesKey) {
  const key = String(encodingAesKey || "").trim();
  if (!/^[A-Za-z0-9+/]{43}$/.test(key)) {
    throw new Error("企业微信 EncodingAESKey 必须是 43 位 Base64 字符。");
  }

  const buffer = Buffer.from(`${key}=`, "base64");
  if (buffer.length !== 32) {
    throw new Error("企业微信 EncodingAESKey 解码后长度不正确。");
  }

  return buffer;
}

function buildWecomSignatureSource({ token, timestamp, nonce, encrypted }) {
  return [token, timestamp, nonce, encrypted].map((value) => String(value || "")).sort().join("");
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function createWecomSignature({ token, timestamp, nonce, encrypted }) {
  return sha1(buildWecomSignatureSource({ token, timestamp, nonce, encrypted }));
}

function verifyWecomSignature({ token, timestamp, nonce, encrypted, signature }) {
  const expected = Buffer.from(createWecomSignature({ token, timestamp, nonce, encrypted }));
  const actual = Buffer.from(String(signature || ""));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function pkcs7Unpad(buffer) {
  if (!buffer.length) {
    return buffer;
  }

  const pad = buffer[buffer.length - 1];
  if (pad < 1 || pad > 32) {
    return buffer;
  }

  return buffer.subarray(0, buffer.length - pad);
}

function decryptWecomMessage(encrypted, { encodingAesKey, corpId }) {
  const aesKey = getAesKey(encodingAesKey);
  const decipher = createDecipheriv("aes-256-cbc", aesKey, aesKey.subarray(0, 16));
  decipher.setAutoPadding(false);
  const plain = pkcs7Unpad(Buffer.concat([decipher.update(String(encrypted || ""), "base64"), decipher.final()]));
  const messageLength = plain.readUInt32BE(16);
  const messageStart = 20;
  const messageEnd = messageStart + messageLength;
  const message = plain.subarray(messageStart, messageEnd).toString("utf8");
  const messageCorpId = plain.subarray(messageEnd).toString("utf8");

  if (corpId && messageCorpId !== corpId) {
    throw new Error("企业微信回调 CorpID 校验失败。");
  }

  return message;
}

function pkcs7Pad(buffer) {
  const blockSize = 32;
  const remainder = buffer.length % blockSize;
  const pad = remainder === 0 ? blockSize : blockSize - remainder;
  return Buffer.concat([buffer, Buffer.alloc(pad, pad)]);
}

function encryptWecomMessage(message, { encodingAesKey, corpId, randomBytes }) {
  const aesKey = getAesKey(encodingAesKey);
  const messageBuffer = Buffer.from(String(message || ""), "utf8");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(messageBuffer.length, 0);
  const randomPrefix = randomBytes || Buffer.from(Array.from({ length: 16 }, () => Math.floor(Math.random() * 256)));
  const plain = pkcs7Pad(Buffer.concat([randomPrefix, lengthBuffer, messageBuffer, Buffer.from(String(corpId || ""), "utf8")]));
  const cipher = createCipheriv("aes-256-cbc", aesKey, aesKey.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString("base64");
}

module.exports = {
  createWecomSignature,
  decryptWecomMessage,
  encryptWecomMessage,
  getAesKey,
  buildWecomSignatureSource,
  signWecomPayload: createWecomSignature,
  verifyWecomSignature
};
