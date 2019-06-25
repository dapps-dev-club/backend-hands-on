import Web3 from 'web3';

import crypt from './crypt.js';
import ipfs from './ipfs.js';

import profilesArtefact from "../../build/contracts/Profiles.json";

const ProfilesApp = {
  web3: undefined,
  accounts: undefined,
  contract: undefined,
  crypt,
};

window.addEventListener('load', function() {
  if (window.ethereum) {
    init();
  } else {
    // basically, politely telling the user to install a newer version of
    // metamask, or else fly 🪁
    console.error('No compatible web3 provider injected');
  }
});

async function init() {
  try {
    window.ProfilesApp = ProfilesApp; // DEBUG
    await window.ethereum.enable(); // get permission to access accounts
    ProfilesApp.web3 = new Web3(window.ethereum);

    // determine network to connect to
    let networkId = await ProfilesApp.web3.eth.net.getId();
    console.log('networkId', networkId);

    let deployedNetwork = profilesArtefact.networks[networkId];
    if (!deployedNetwork) {
      console.warn('web3 provider is connected to a network ID that does not matched the deployed network ID');
      console.warn('Pls make sure that you are connected to the right network, defaulting to deployed network ID');
      networkId = Object.keys(profilesArtefact.networks)[0];
      deployedNetwork = profilesArtefact.networks[networkId];
    }
    console.log('deployedNetwork', deployedNetwork);

    // initialise the contract
    ProfilesApp.contract = new ProfilesApp.web3.eth.Contract(
      profilesArtefact.abi,
      deployedNetwork.address,
    );


    // set the initial accounts
    updateAccounts(await ProfilesApp.web3.eth.getAccounts());

    console.log('ProfilesApp initialised');
  } catch (err) {
    console.error('Failed to init contract');
    console.error(err);
  }

  // set up listeners for app interactions.
  const queryProfileButton = document.querySelector('#queryProfileButton');
  queryProfileButton.addEventListener('click', queryProfile);

  const updateProfileButton = document.querySelector('#updateProfileButton');
  updateProfileButton.addEventListener('click', updateProfile);

  const generateEncryptionKeysButton = document.querySelector('#generateEncryptionKeysButton');
  generateEncryptionKeysButton.addEventListener('click', generateEncryptionKeys);

  const addEncryptedFieldButton = document.querySelector('#addEncryptedFieldButton');
  addEncryptedFieldButton.addEventListener('click', addEncryptedField);

  // trigger various things that need to happen upon app being opened.
  window.ethereum.on('accountsChanged', updateAccounts);
}

async function updateAccounts(accounts) {
  ProfilesApp.accounts = accounts;
  console.log('updateAccounts', accounts[0]);

  const addressInput = document.querySelector('#addressInput');
  addressInput.value = accounts[0];
  await queryProfile();

  const profileOutput = document.querySelector('#profileOutput');
  const profileInput = document.querySelector('#profileInput');
  profileInput.value = profileOutput.value;
}

async function queryProfile() {
  const addressInput = document.querySelector('#addressInput');
  const profileAddress = addressInput.value;
  console.log({ profileAddress });

  const ipfsHash = await ProfilesApp.contract.methods.profiles(profileAddress).call({
    from: ProfilesApp.accounts[0],
  });
  console.log({ ipfsHash });

  // use the IPFS hash to read file
  // https://github.com/ipfs/interface-js-ipfs-core/blob/master/SPEC/FILES.md#cat
  const ipfsFileBuffer = await ipfs.cat(`/ipfs/${ipfsHash}`);
  const profile = ipfsFileBuffer.toString();

  // display profile as-is
  console.log({ profile });
  const profileOutput = document.querySelector('#profileOutput');
  profileOutput.value = profile;

  // attempt to decrypt fields within profile that are decryptable, then re-display
  try {
    await decryptProfile();
  } catch (ex) {
    console.error(ex);
    console.log('Skipped profile decryption due to failed attempt');
  }
}

async function decryptProfile() {
  const profileInput = document.querySelector('#profileInput');
  let profile;
  try {
    profile = JSON.parse(profileInput.value);
  } catch (ex) {
    throw 'Failed to parse input profile';
  }
  
  const {
    publicKey,
    privateKey,
  } = profile;

  if (!publicKey || !privateKey) {
    throw new Error('Missing own encryption keys');
  }

  const profileOutput = document.querySelector('#profileOutput');
  let encryptedProfile;
  try {
    encryptedProfile = JSON.parse(profileOutput.value);
  } catch (ex) {
    throw 'Failed to parse output profile';
  }

  const decryptedProfile = {};
  for (const [key, value] of Object.entries(encryptedProfile)) {
    console.log({ key, value });
    if (
      typeof value === 'object' &&
      value.visibleTo === publicKey
    ) {
      try {
        const decryptedValue = await ProfilesApp.crypt.decrypt(
          privateKey,
          value,
        );
        decryptedProfile[key] = decryptedValue;
      } catch (ex) {
        decryptedProfile[key] = value;
      }
    } else {
      decryptedProfile[key] = value;
    }
  }

  const updatedProfileString = JSON.stringify(decryptedProfile, undefined, 2);
  profileOutput.value = updatedProfileString;
}

async function generateEncryptionKeys() {
  const profileInput = document.querySelector('#profileInput');
  let profile;
  try {
    profile = JSON.parse(profileInput.value);
  } catch (ex) {
    throw 'Failed to parse input profile';
  }

  const keys = await ProfilesApp.crypt.generateKeyPair();

  const updatedProfile = {
    ...profile,
    ...keys,
  };

  const updatedProfileString = JSON.stringify(updatedProfile, undefined, 2);
  profileInput.value = updatedProfileString;

  console.log('Profile updated, NOTE that private key is only there for demo purposes');
}

async function updateProfile() {
  const profileInput = document.querySelector('#profileInput');
  let profile;
  try {
    profile = JSON.parse(profileInput.value);
  } catch (ex) {
    throw 'Failed to parse input profile';
  }
  console.log({ profile });

  // NOTE that we should strip the private key - we don't want that to be written anywhere
  // For demo purposes, we're leaving that in

  // write to IPFS and obtain its hash
  // ref: https://github.com/ipfs/interface-js-ipfs-core/blob/master/SPEC/FILES.md#add
  const buffer = await Buffer.from(JSON.stringify(profile, undefined, 2));
  const ipfsResult = await ipfs.add(buffer);
  console.log({ ipfsResult });

  await ProfilesApp.contract.methods.updateProfile(
    // Write the IPFS hash instead of the full JSON
    // JSON.stringify(profile),
    ipfsResult[0].hash,
  ).send({
    from: ProfilesApp.accounts[0],
  });
}

async function addEncryptedField() {
  const profileInput = document.querySelector('#profileInput');
  let profile;
  try {
    profile = JSON.parse(profileInput.value);
  } catch (ex) {
    throw 'Failed to parse input profile';
  }

  const cryptToInput = document.querySelector('#cryptToInput');
  const cryptTextInput = document.querySelector('#cryptTextInput');
  const cryptProfileKeyInput = document.querySelector('#cryptProfileKeyInput');
  const cryptTo =  cryptToInput.value;
  const cryptText =  cryptTextInput.value;
  const cryptProfileKey = cryptProfileKeyInput.value;

  const encrypted = await ProfilesApp.crypt.encrypt(
    cryptTo,
    cryptText,
  );
  const messageOutput = {
    visibleTo: cryptTo,
    ...encrypted,
  };
  const updatedProfile = {
    ...profile,
    [cryptProfileKey]: messageOutput,
  };

  const updatedProfileString = JSON.stringify(updatedProfile, undefined, 2);
  profileInput.value = updatedProfileString;
}
