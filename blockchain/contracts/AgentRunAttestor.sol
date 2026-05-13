// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title AgentRunAttestor
/// @notice Stores public proof hashes for autonomous Agent runs on the configured EVM network.
contract AgentRunAttestor is AccessControl {
  struct AgentRunProof {
    address ownerWallet;
    bytes32 proofHash;
    string proofUri;
    uint256 attestedAt;
  }

  bytes32 public constant ATTESTER_ROLE = keccak256("ATTESTER_ROLE");

  mapping(bytes32 => AgentRunProof) private _proofs;

  event AgentRunAttested(bytes32 indexed runId, address indexed ownerWallet, bytes32 proofHash, string proofUri);

  constructor(address admin) {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ATTESTER_ROLE, admin);
  }

  function attestRun(
    bytes32 runId,
    address ownerWallet,
    bytes32 proofHash,
    string calldata proofUri
  ) external onlyRole(ATTESTER_ROLE) returns (bytes32) {
    require(runId != bytes32(0), "AgentRunAttestor: invalid run");
    require(ownerWallet != address(0), "AgentRunAttestor: invalid owner");
    require(proofHash != bytes32(0), "AgentRunAttestor: invalid proof");
    require(bytes(proofUri).length > 0, "AgentRunAttestor: invalid uri");

    _proofs[runId] = AgentRunProof({
      ownerWallet: ownerWallet,
      proofHash: proofHash,
      proofUri: proofUri,
      attestedAt: block.timestamp
    });

    emit AgentRunAttested(runId, ownerWallet, proofHash, proofUri);

    return proofHash;
  }

  function proofOf(
    bytes32 runId
  ) external view returns (address ownerWallet, bytes32 proofHash, string memory proofUri, uint256 attestedAt) {
    AgentRunProof memory proof = _proofs[runId];

    return (proof.ownerWallet, proof.proofHash, proof.proofUri, proof.attestedAt);
  }
}
