const ipfsApi = require('ipfs-api');

const localIpfsConnection = {
  host: 'localhost',
  port: 5001,
  protocol: 'http',
};

const infuraIpfsConnection = {
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
};

const ipfs = new ipfsApi(
  localIpfsConnection, // to connect to your local IPFS node
  // infuraIpfsConnection, // to connect to Infura's IPFS node
);

module.exports = ipfs;
