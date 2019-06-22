const Profiles = artifacts.require("Profiles");

module.exports = function(deployer) {
  deployer.deploy(Profiles);
};
