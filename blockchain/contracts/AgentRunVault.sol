// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title AgentRunVault
/// @notice Holds user-funded ERC20 budgets for autonomous agent runs.
contract AgentRunVault is AccessControl {
  using SafeERC20 for IERC20;

  enum RunState {
    None,
    Funded,
    Running,
    Completed,
    Cancelled,
    Refunded
  }

  struct RunBudget {
    address owner;
    address agentSigner;
    address token;
    uint256 fundedAmount;
    uint256 spentAmount;
    uint256 refundedAmount;
    uint256 expiresAt;
    RunState state;
    uint256 createdAt;
    uint256 updatedAt;
  }

  bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

  mapping(bytes32 => RunBudget) private _budgets;

  event AgentRunFunded(
    bytes32 indexed runId,
    address indexed owner,
    address indexed token,
    address agentSigner,
    uint256 amount,
    uint256 expiresAt
  );
  event AgentRunStarted(bytes32 indexed runId);
  event AgentSpendRecorded(bytes32 indexed runId, bytes32 indexed paymentId, uint256 amount);
  event AgentSpendRefundRecorded(bytes32 indexed runId, bytes32 indexed paymentId, uint256 amount);
  event AgentRunCompleted(bytes32 indexed runId);
  event AgentRunCancelled(bytes32 indexed runId);
  event AgentRunRefunded(bytes32 indexed runId, address indexed owner, uint256 amount);

  constructor(address admin) {
    require(admin != address(0), "AgentRunVault: invalid admin");

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(OPERATOR_ROLE, admin);
  }

  function fundRun(bytes32 runId, address token, uint256 amount, address agentSigner, uint256 expiresAt) external {
    require(runId != bytes32(0), "AgentRunVault: invalid run");
    require(token != address(0), "AgentRunVault: invalid token");
    require(amount > 0, "AgentRunVault: invalid amount");
    require(agentSigner != address(0), "AgentRunVault: invalid signer");
    require(expiresAt > block.timestamp, "AgentRunVault: invalid expiry");
    require(_budgets[runId].state == RunState.None, "AgentRunVault: already funded");

    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

    _budgets[runId] = RunBudget({
      owner: msg.sender,
      agentSigner: agentSigner,
      token: token,
      fundedAmount: amount,
      spentAmount: 0,
      refundedAmount: 0,
      expiresAt: expiresAt,
      state: RunState.Funded,
      createdAt: block.timestamp,
      updatedAt: block.timestamp
    });

    emit AgentRunFunded(runId, msg.sender, token, agentSigner, amount, expiresAt);
  }

  function markRunning(bytes32 runId) external onlyRole(OPERATOR_ROLE) {
    RunBudget storage budget = _requireBudget(runId);
    require(budget.state == RunState.Funded, "AgentRunVault: not funded");

    budget.state = RunState.Running;
    budget.updatedAt = block.timestamp;

    emit AgentRunStarted(runId);
  }

  function recordSpend(bytes32 runId, bytes32 paymentId, uint256 amount) external onlyRole(OPERATOR_ROLE) {
    RunBudget storage budget = _requireActiveBudget(runId);
    require(paymentId != bytes32(0), "AgentRunVault: invalid payment");
    require(amount > 0, "AgentRunVault: invalid amount");
    require(budget.spentAmount + amount <= budget.fundedAmount - budget.refundedAmount, "AgentRunVault: over budget");

    budget.spentAmount += amount;
    budget.updatedAt = block.timestamp;

    IERC20(budget.token).safeTransfer(budget.agentSigner, amount);

    emit AgentSpendRecorded(runId, paymentId, amount);
  }

  function recordSpendRefund(bytes32 runId, bytes32 paymentId, uint256 amount) external onlyRole(OPERATOR_ROLE) {
    RunBudget storage budget = _requireActiveBudget(runId);
    require(paymentId != bytes32(0), "AgentRunVault: invalid payment");
    require(amount > 0, "AgentRunVault: invalid amount");
    require(amount <= budget.spentAmount, "AgentRunVault: refund too large");

    budget.spentAmount -= amount;
    budget.updatedAt = block.timestamp;

    emit AgentSpendRefundRecorded(runId, paymentId, amount);
  }

  function markCompleted(bytes32 runId) external onlyRole(OPERATOR_ROLE) {
    RunBudget storage budget = _requireActiveBudget(runId);

    budget.state = RunState.Completed;
    budget.updatedAt = block.timestamp;

    emit AgentRunCompleted(runId);
  }

  function cancelRun(bytes32 runId) external {
    RunBudget storage budget = _requireBudget(runId);
    require(msg.sender == budget.owner || hasRole(OPERATOR_ROLE, msg.sender), "AgentRunVault: not authorized");
    require(budget.state == RunState.Funded || budget.state == RunState.Running, "AgentRunVault: cannot cancel");

    budget.state = RunState.Cancelled;
    budget.updatedAt = block.timestamp;

    emit AgentRunCancelled(runId);
  }

  function refundUnused(bytes32 runId) external {
    RunBudget storage budget = _requireBudget(runId);
    require(msg.sender == budget.owner || hasRole(OPERATOR_ROLE, msg.sender), "AgentRunVault: not authorized");
    require(
      budget.state == RunState.Completed || budget.state == RunState.Cancelled || block.timestamp >= budget.expiresAt,
      "AgentRunVault: not refundable"
    );

    uint256 refundableAmount = budget.fundedAmount - budget.spentAmount - budget.refundedAmount;
    require(refundableAmount > 0, "AgentRunVault: nothing to refund");

    budget.refundedAmount += refundableAmount;
    if (budget.refundedAmount + budget.spentAmount >= budget.fundedAmount) {
      budget.state = RunState.Refunded;
    }
    budget.updatedAt = block.timestamp;

    IERC20(budget.token).safeTransfer(budget.owner, refundableAmount);

    emit AgentRunRefunded(runId, budget.owner, refundableAmount);
  }

  function budgetOf(bytes32 runId) external view returns (RunBudget memory) {
    return _budgets[runId];
  }

  function availableAmount(bytes32 runId) external view returns (uint256) {
    RunBudget memory budget = _budgets[runId];

    if (budget.state == RunState.None || budget.fundedAmount <= budget.spentAmount + budget.refundedAmount) {
      return 0;
    }

    return budget.fundedAmount - budget.spentAmount - budget.refundedAmount;
  }

  function _requireBudget(bytes32 runId) private view returns (RunBudget storage) {
    RunBudget storage budget = _budgets[runId];

    require(budget.state != RunState.None, "AgentRunVault: not found");

    return budget;
  }

  function _requireActiveBudget(bytes32 runId) private view returns (RunBudget storage) {
    RunBudget storage budget = _requireBudget(runId);

    require(budget.state == RunState.Funded || budget.state == RunState.Running, "AgentRunVault: not active");
    require(block.timestamp < budget.expiresAt, "AgentRunVault: expired");

    return budget;
  }
}
