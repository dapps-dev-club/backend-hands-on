pragma solidity ^0.5.0;

contract Profiles {
  mapping(address => string) public profiles;

  constructor() public {
  }

  function updateProfile(string calldata ipfsHash) external {
    profiles[msg.sender] = ipfsHash;
  }
}
