import ethSigUtil from 'eth-sig-util';
import nacl from 'tweetnacl';
import elliptic from 'elliptic';

const crypto = global.crypto || global.msCrypto || {};
const cryptoSubtle = crypto.subtle || crypto.webkitSubtle;
const secp256k1 = new elliptic.ec('secp256k1');

async function getPbkdf2(
  passwordStr,
  saltStr,
  hash = 'SHA-256',
  iterations = 512,
  keyLength = 32,
) {
  const textEncoder = new TextEncoder('utf-8');
  const password = textEncoder.encode(passwordStr);
  const salt = textEncoder.encode(saltStr);
  const key = await cryptoSubtle.importKey(
    'raw',
    password,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return cryptoSubtle.deriveBits(
    {
      name: 'PBKDF2',
      hash,
      salt,
      iterations,
    },
    key,
    keyLength * 8,
  );
}

async function generateKeyPair() {
  // NOTE ideally we would not need to generate a separate key pair for encryption
  // NOTE more importantly, we should not need to manage private keys in the UI at all,
  // and have the wallet (e.g. MetaMask mange that instead)
  const keys = nacl.box.keyPair();
  return {
    privateKey: nacl.util.encodeBase64(keys.secretKey),
    publicKey: nacl.util.encodeBase64(keys.publicKey),
  };
}

async function encrypt(
  recipientPublicKey,
  text,
) {
  return ethSigUtil.encryptSafely(
    recipientPublicKey,
    { data: text },
    'x25519-xsalsa20-poly1305',
  );
}

async function decrypt(
  recipientPrivateKey,
  encryptedData,
) {
  const recipientPrivateKeyAsHexadecimalString = 
    nacl.util.decodeBase64(recipientPrivateKey)
      .reduce(
        (acc, byte) => (acc + byte.toString(16).padStart(2, '0')), 
        '',
      );
  return ethSigUtil.decryptSafely(
    encryptedData,
    recipientPrivateKeyAsHexadecimalString,
  );
}

export default { 
    crypto,
    ethSigUtil,
    nacl,
    generateKeyPair,
    getPbkdf2,
    encrypt,
    decrypt,
};
