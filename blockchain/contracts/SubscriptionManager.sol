// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title SubscriptionManager
/// @notice Accepts native-token payments to activate, renew, or cancel a team's subscription.
contract SubscriptionManager is AccessControl {
  /* -------------------------------------------------------------------------- */
  /*                                  TYPES                                     */
  /* -------------------------------------------------------------------------- */

  struct Subscription {
    uint8 planKey;
    uint256 paidUntil;
    uint256 canceledAt;
    bool autoRenew;
  }

  /* -------------------------------------------------------------------------- */
  /*                                   ROLES                                    */
  /* -------------------------------------------------------------------------- */

  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  /* -------------------------------------------------------------------------- */
  /*                                 CONSTANTS                                  */
  /* -------------------------------------------------------------------------- */

  /// @dev All plans grant 30 days of service per payment.
  uint256 public constant PERIOD = 30 days;

  /* -------------------------------------------------------------------------- */
  /*                                 STORAGE                                    */
  /* -------------------------------------------------------------------------- */

  /// planKey (1 = Base, 2 = Plus, others reserved) → price in wei
  mapping(uint8 => uint256) public planPriceWei;

  /// team wallet → subscription state
  mapping(address => Subscription) private _subscriptions;
  mapping(address => bool) private _knownSubscriber;
  address[] private _subscribers;

  /* -------------------------------------------------------------------------- */
  /*                                   EVENTS                                   */
  /* -------------------------------------------------------------------------- */

  event SubscriptionPaid(address indexed team, uint8 indexed planKey, uint256 paidUntil);
  event SubscriptionRenewed(address indexed team, uint8 indexed planKey, uint256 paidUntil);
  event SubscriptionCanceled(address indexed team, uint256 canceledAt);
  event AutoRenewalUpdated(address indexed team, bool enabled);
  event PlanPriceUpdated(uint8 indexed planKey, uint256 priceWei);
  event TreasuryWithdrawn(address indexed recipient, uint256 amount);

  /* -------------------------------------------------------------------------- */
  /*                                CONSTRUCTOR                                 */
  /* -------------------------------------------------------------------------- */

  /// @param admin         Address receiving DEFAULT_ADMIN_ROLE and ADMIN_ROLE.
  /// @param priceWeiBase  Initial price for the Base plan (planKey = 1).
  /// @param priceWeiPlus  Initial price for the Plus plan (planKey = 2).
  constructor(address admin, uint256 priceWeiBase, uint256 priceWeiPlus) {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(ADMIN_ROLE, admin);

    planPriceWei[1] = priceWeiBase;
    planPriceWei[2] = priceWeiPlus;
  }

  /* -------------------------------------------------------------------------- */
  /*                               ADMIN ACTIONS                                */
  /* -------------------------------------------------------------------------- */

  /// @notice Update the wei price for a given plan.
  function setPlanPrice(uint8 planKey, uint256 newPriceWei) external onlyRole(ADMIN_ROLE) {
    require(planKey != 0, "Subscription: planKey 0 is reserved");
    planPriceWei[planKey] = newPriceWei;
    emit PlanPriceUpdated(planKey, newPriceWei);
  }

  /// @notice Withdraw accumulated subscription revenue to an admin-controlled recipient.
  /// @dev Passing amount = 0 withdraws the full available balance.
  function withdraw(address payable recipient, uint256 amount) external onlyRole(ADMIN_ROLE) {
    require(recipient != address(0), "Subscription: invalid recipient");

    uint256 balance = address(this).balance;
    uint256 payout = amount == 0 ? balance : amount;

    require(payout > 0, "Subscription: empty balance");
    require(payout <= balance, "Subscription: insufficient balance");

    (bool sent, ) = recipient.call{value: payout}("");
    require(sent, "Subscription: withdraw failed");

    emit TreasuryWithdrawn(recipient, payout);
  }

  /* -------------------------------------------------------------------------- */
  /*                           P U B L I C  A C T I O N                          */
  /* -------------------------------------------------------------------------- */

  /**
   * @dev Pay exactly the plan price in wei to activate or extend a subscription.
   *      If the team is already active, the new period is appended to the current
   *      expiry; otherwise it starts from `block.timestamp`.
   *
   * @param team     Wallet that owns the app workspace (can differ from `msg.sender`).
   * @param planKey  Pricing tier identifier (1 = Base, 2 = Plus).
   */
  function paySubscription(address team, uint8 planKey) external payable {
    uint256 newExpiry = _activateSubscription(team, planKey);
    emit SubscriptionPaid(team, planKey, newExpiry);
  }

  /// @notice Renew the sender's current or selected paid plan for another period.
  function renewSubscription(uint8 planKey) external payable {
    uint256 newExpiry = _activateSubscription(msg.sender, planKey);
    emit SubscriptionRenewed(msg.sender, planKey, newExpiry);
  }

  /// @notice Cancel the sender's subscription immediately.
  function cancelSubscription() external {
    _cancelSubscription(msg.sender);
  }

  /// @notice Cancel a team subscription as an admin.
  function cancelSubscriptionFor(address team) external onlyRole(ADMIN_ROLE) {
    _cancelSubscription(team);
  }

  /// @notice Store a user's preferred renewal setting for app automation.
  function setAutoRenew(bool enabled) external {
    _subscriptions[msg.sender].autoRenew = enabled;
    emit AutoRenewalUpdated(msg.sender, enabled);
  }

  /* -------------------------------------------------------------------------- */
  /*                                   VIEWS                                    */
  /* -------------------------------------------------------------------------- */

  /// @return Unix timestamp until which the subscription is active (0 if never paid)
  function paidUntil(address team) external view returns (uint256) {
    return _subscriptions[team].paidUntil;
  }

  function isSubscriptionActive(address team) external view returns (bool) {
    return _subscriptions[team].paidUntil > block.timestamp;
  }

  function contractBalance() external view returns (uint256) {
    return address(this).balance;
  }

  function subscriberCount() external view returns (uint256) {
    return _subscribers.length;
  }

  function subscriberAt(uint256 index) external view returns (address) {
    return _subscribers[index];
  }

  function subscribers(uint256 offset, uint256 limit) external view returns (address[] memory wallets, uint256 total) {
    total = _subscribers.length;

    if (offset >= total || limit == 0) {
      return (new address[](0), total);
    }

    uint256 end = offset + limit;
    if (end > total) {
      end = total;
    }

    wallets = new address[](end - offset);
    for (uint256 i = offset; i < end; i++) {
      wallets[i - offset] = _subscribers[i];
    }
  }

  function subscriptionOf(
    address team
  ) external view returns (uint8 planKey, uint256 paidUntilValue, bool active, bool autoRenew, uint256 canceledAt) {
    Subscription memory subscription = _subscriptions[team];

    return (
      subscription.planKey,
      subscription.paidUntil,
      subscription.paidUntil > block.timestamp,
      subscription.autoRenew,
      subscription.canceledAt
    );
  }

  /* -------------------------------------------------------------------------- */
  /*                                ERC-165                                     */
  /* -------------------------------------------------------------------------- */

  function supportsInterface(bytes4 id) public view override returns (bool) {
    return super.supportsInterface(id) || id == type(IERC165).interfaceId;
  }

  function _activateSubscription(address team, uint8 planKey) internal returns (uint256) {
    require(team != address(0), "Subscription: invalid team");

    uint256 price = planPriceWei[planKey];
    require(price > 0, "Subscription: unknown plan");
    require(msg.value == price, "Subscription: incorrect payment");

    Subscription storage subscription = _subscriptions[team];
    uint256 startTime = subscription.paidUntil > block.timestamp ? subscription.paidUntil : block.timestamp;
    uint256 newExpiry = startTime + PERIOD;

    if (!_knownSubscriber[team]) {
      _knownSubscriber[team] = true;
      _subscribers.push(team);
    }

    subscription.planKey = planKey;
    subscription.paidUntil = newExpiry;
    subscription.canceledAt = 0;

    return newExpiry;
  }

  function _cancelSubscription(address team) internal {
    Subscription storage subscription = _subscriptions[team];
    require(subscription.paidUntil > block.timestamp, "Subscription: no active subscription");

    subscription.paidUntil = block.timestamp;
    subscription.canceledAt = block.timestamp;
    subscription.autoRenew = false;

    emit SubscriptionCanceled(team, block.timestamp);
  }
}
