pragma solidity ^0.5.0;

contract Profiles {
  mapping(address => string) public profiles;

  event Message(string indexed to, string ipfsHash)

  constructor() public {
  }

  function updateProfile(string calldata ipfsHash) external {
    profiles[msg.sender] = ipfsHash;
  }

  function sendMessage(string calldata to, string calldata ipfsHash) external {
    emit Message(to, ipfsHash);
  }
}
