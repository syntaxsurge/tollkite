// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title ApiPaymentEscrow
/// @notice Holds prepaid ERC20 API payments until the gateway can release or refund them.
contract ApiPaymentEscrow is AccessControl {
  using SafeERC20 for IERC20;

  enum PaymentState {
    None,
    Reserved,
    Released,
    Refunded
  }

  struct EscrowPayment {
    address token;
    address payer;
    address provider;
    uint256 amount;
    bytes32 settlementTxHash;
    PaymentState state;
    uint256 reservedAt;
    uint256 finalizedAt;
  }

  bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

  mapping(bytes32 => EscrowPayment) private _payments;

  event PaymentReserved(
    bytes32 indexed paymentId,
    address indexed token,
    address indexed payer,
    address provider,
    uint256 amount,
    bytes32 settlementTxHash
  );
  event PaymentReleased(bytes32 indexed paymentId, address indexed provider, uint256 amount);
  event PaymentRefunded(bytes32 indexed paymentId, address indexed payer, uint256 amount);

  constructor(address admin) {
    require(admin != address(0), "ApiPaymentEscrow: invalid admin");

    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(OPERATOR_ROLE, admin);
  }

  function reservePayment(
    bytes32 paymentId,
    address token,
    address payer,
    address provider,
    uint256 amount,
    bytes32 settlementTxHash
  ) external onlyRole(OPERATOR_ROLE) {
    require(paymentId != bytes32(0), "ApiPaymentEscrow: invalid payment");
    require(token != address(0), "ApiPaymentEscrow: invalid token");
    require(payer != address(0), "ApiPaymentEscrow: invalid payer");
    require(provider != address(0), "ApiPaymentEscrow: invalid provider");
    require(amount > 0, "ApiPaymentEscrow: invalid amount");
    require(_payments[paymentId].state == PaymentState.None, "ApiPaymentEscrow: already reserved");
    require(IERC20(token).balanceOf(address(this)) >= amount, "ApiPaymentEscrow: insufficient escrow balance");

    _payments[paymentId] = EscrowPayment({
      token: token,
      payer: payer,
      provider: provider,
      amount: amount,
      settlementTxHash: settlementTxHash,
      state: PaymentState.Reserved,
      reservedAt: block.timestamp,
      finalizedAt: 0
    });

    emit PaymentReserved(paymentId, token, payer, provider, amount, settlementTxHash);
  }

  function releasePayment(bytes32 paymentId) external onlyRole(OPERATOR_ROLE) {
    EscrowPayment storage payment = _payments[paymentId];

    require(payment.state == PaymentState.Reserved, "ApiPaymentEscrow: not reserved");

    payment.state = PaymentState.Released;
    payment.finalizedAt = block.timestamp;

    IERC20(payment.token).safeTransfer(payment.provider, payment.amount);

    emit PaymentReleased(paymentId, payment.provider, payment.amount);
  }

  function refundPayment(bytes32 paymentId) external onlyRole(OPERATOR_ROLE) {
    EscrowPayment storage payment = _payments[paymentId];

    require(payment.state == PaymentState.Reserved, "ApiPaymentEscrow: not reserved");

    payment.state = PaymentState.Refunded;
    payment.finalizedAt = block.timestamp;

    IERC20(payment.token).safeTransfer(payment.payer, payment.amount);

    emit PaymentRefunded(paymentId, payment.payer, payment.amount);
  }

  function paymentOf(bytes32 paymentId) external view returns (EscrowPayment memory) {
    return _payments[paymentId];
  }
}
