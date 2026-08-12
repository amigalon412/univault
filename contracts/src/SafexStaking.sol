// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SafexStaking
/// @notice Stake $SAFEX, earn from a funded reward pool.
///
/// @dev The accrual is the Synthetix `StakingRewards` accumulator, which is the
///      right shape for this and is worth stating plainly: a single
///      `rewardPerTokenStored` running total, and per-user `paid` marks. Cost
///      of `stake`/`withdraw`/`claim` does not grow with the number of stakers,
///      and nothing has to be iterated to pay everybody. Rewards are *pulled*
///      by the staker, never pushed.
///
///      Deliberately NOT a fixed APR. The owner funds a pot and a window, and
///      the rate falls out of `amount / duration`; what each staker earns then
///      depends on how much is staked beside them. A contract that promised a
///      percentage would owe money it might not hold -- this one can only ever
///      pay what has already been sent to it. `notifyRewardAmount` can be
///      called at any time, including mid-window: leftovers from the running
///      period are rolled into the new rate, so topping up is the normal way to
///      use this, not an exception.
///
///      Reward and staking token may be the same ERC-20, which is the intended
///      configuration ($SAFEX staked, $SAFEX paid). That is exactly where
///      this pattern is usually got wrong: with one token the contract's
///      balance holds principal and rewards mixed together, and a naive
///      implementation will happily pay stakers out of each other's deposits
///      until the last one out finds nothing there. `_rewardBudget` subtracts
///      `totalStaked` so principal is never spendable, and `notifyRewardAmount`
///      refuses a rate the budget cannot cover for the whole window.
///
///      What the owner cannot do, by construction: touch staked principal
///      (`recoverERC20` will not move the staking token), take rewards back out
///      once notified, or stop a withdrawal. There is no pause.
contract SafexStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The token stakers lock up, and are paid in.
    ///
    /// @dev Not immutable, and not because that would be nicer: this contract
    ///      has to be deployable before the token exists. It is set once, by
    ///      `setToken`, and can never be changed after -- which is the only
    ///      version of "settable" that keeps the guarantees intact. An owner
    ///      able to re-point this could swap the reward token out from under
    ///      people who had already staked.
    IERC20 public stakingToken;

    /// @notice The token rewards are paid in. Same address as `stakingToken`.
    ///
    /// @dev Kept as its own variable rather than folded away because the
    ///      accrual below does not care whether they match, and a future
    ///      deployment paying stakers in something else (the basket, say) is a
    ///      different constructor rather than a different code path here.
    IERC20 public rewardToken;

    /// @notice Reward tokens per second for the current window.
    uint256 public rewardRate;

    /// @notice When the current window ends. Accrual stops here.
    uint256 public periodFinish;

    /// @notice Length of the window a `notifyRewardAmount` spreads over.
    uint256 public rewardsDuration;

    /// @dev Accumulator bookkeeping.
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    /// @notice Total principal held for stakers. Never spendable as reward.
    uint256 public totalStaked;

    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    event Staked(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);
    event RewardPaid(address indexed account, uint256 amount);
    event RewardAdded(uint256 amount, uint256 periodFinish);
    event RewardsDurationUpdated(uint256 duration);
    event Recovered(address indexed token, uint256 amount);
    event TokenSet(address indexed token);

    error ZeroAmount();
    error InsufficientRewardBudget(uint256 needed, uint256 available);
    error PeriodStillActive(uint256 endsAt);
    error ZeroDuration();
    error CannotRecoverStakingToken();
    error TokenNotSet();
    error TokenAlreadySet(address token);
    error ZeroAddress();

    constructor(address owner_, uint256 rewardsDuration_) Ownable(owner_) {
        if (rewardsDuration_ == 0) revert ZeroDuration();
        rewardsDuration = rewardsDuration_;
    }

    /// @notice Point the contract at $SAFEX. Once, and then never again.
    ///
    /// @dev The whole reason this exists: the token is deployed after this
    ///      contract, so its address is not knowable at construction. Everything
    ///      that could move value is closed until this is called, and calling it
    ///      a second time reverts -- so from the outside, the pair (staking
    ///      contract, token) is as fixed as if it had been baked in, from the
    ///      first moment anyone can do anything here.
    function setToken(address token) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        if (address(stakingToken) != address(0)) revert TokenAlreadySet(address(stakingToken));
        stakingToken = IERC20(token);
        rewardToken = IERC20(token);
        emit TokenSet(token);
    }

    /// @notice Whether the contract has been wired to its token yet.
    function tokenIsSet() public view returns (bool) {
        return address(stakingToken) != address(0);
    }

    modifier whenTokenSet() {
        if (!tokenIsSet()) revert TokenNotSet();
        _;
    }

    /* ── accrual ──────────────────────────────────────────────────────── */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }

    function rewardPerToken() public view returns (uint256) {
        /* With nothing staked the accumulator must not advance, or the seconds
           that passed with no stakers would be credited to whoever arrives
           first. Those rewards stay in the pot and go out in a later window. */
        if (totalStaked == 0) return rewardPerTokenStored;
        return rewardPerTokenStored
            + ((lastTimeRewardApplicable() - lastUpdateTime) * rewardRate * 1e18) / totalStaked;
    }

    function earned(address account) public view returns (uint256) {
        return (balanceOf[account] * (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18
            + rewards[account];
    }

    /// @notice Rewards still to be handed out over the rest of the window.
    function remainingRewards() public view returns (uint256) {
        if (block.timestamp >= periodFinish) return 0;
        return (periodFinish - block.timestamp) * rewardRate;
    }

    /* ── staking ──────────────────────────────────────────────────────── */

    function stake(uint256 amount) external nonReentrant whenTokenSet updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        /* Credited from what actually arrived, not from what was asked for, so
           a token that takes a cut on transfer cannot leave this contract owing
           more principal than it holds. $SAFEX has no such fee, but this
           contract does not get to assume which token it was pointed at. */
        uint256 before = stakingToken.balanceOf(address(this));
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = stakingToken.balanceOf(address(this)) - before;
        if (received == 0) revert ZeroAmount();
        totalStaked += received;
        balanceOf[msg.sender] += received;
        emit Staked(msg.sender, received);
    }

    function withdraw(uint256 amount) public nonReentrant updateReward(msg.sender) {
        if (amount == 0) revert ZeroAmount();
        totalStaked -= amount;
        balanceOf[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function claim() public nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward == 0) return;
        rewards[msg.sender] = 0;
        rewardToken.safeTransfer(msg.sender, reward);
        emit RewardPaid(msg.sender, reward);
    }

    /// @notice Take everything out in one transaction.
    /// @dev Tolerates a zero stake so someone who already withdrew can still
    ///      use this to sweep rewards left behind.
    function exit() external {
        uint256 staked = balanceOf[msg.sender];
        if (staked > 0) withdraw(staked);
        claim();
    }

    /* ── funding ──────────────────────────────────────────────────────── */

    /// @notice Spendable reward tokens: everything held that is not principal.
    function _rewardBudget() internal view returns (uint256) {
        uint256 balance = rewardToken.balanceOf(address(this));
        if (address(rewardToken) == address(stakingToken)) {
            /* Principal is not a reward. Without this line the contract would
               pay stakers out of each other's deposits. */
            return balance - totalStaked;
        }
        return balance;
    }

    /// @notice Spendable reward tokens not already committed to the window.
    function unallocatedRewards() external view returns (uint256) {
        if (!tokenIsSet()) return 0;
        uint256 budget = _rewardBudget();
        uint256 committed = remainingRewards();
        return budget > committed ? budget - committed : 0;
    }

    /// @notice Start a window, or top up the one running.
    /// @dev Send the tokens first; this only sets the rate. Anything left over
    ///      from a running window is rolled in rather than stranded.
    function notifyRewardAmount(uint256 amount) external onlyOwner whenTokenSet updateReward(address(0)) {
        if (amount == 0) revert ZeroAmount();

        uint256 rate = block.timestamp >= periodFinish
            ? amount / rewardsDuration
            : (amount + remainingRewards()) / rewardsDuration;

        /* The whole window has to be covered by tokens already here. This is
           what keeps the contract from promising what it does not hold -- and
           it is checked against the budget net of principal, so a large
           `totalStaked` can never be mistaken for a large reward pot. */
        uint256 needed = rate * rewardsDuration;
        uint256 available = _rewardBudget();
        if (needed > available) revert InsufficientRewardBudget(needed, available);

        rewardRate = rate;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp + rewardsDuration;
        emit RewardAdded(amount, periodFinish);
    }

    /// @notice Change the window length. Only between windows.
    /// @dev Mid-window this would silently re-rate money already promised.
    function setRewardsDuration(uint256 duration) external onlyOwner {
        if (block.timestamp < periodFinish) revert PeriodStillActive(periodFinish);
        if (duration == 0) revert ZeroDuration();
        rewardsDuration = duration;
        emit RewardsDurationUpdated(duration);
    }

    /// @notice Sweep a token sent here by mistake.
    /// @dev The staking token is refused outright rather than limited to a
    ///      surplus: when it is also the reward token, "surplus" is exactly the
    ///      undistributed reward pot, and an owner able to pull that back could
    ///      cancel rewards stakers have already started earning.
    function recoverERC20(address token, uint256 amount) external onlyOwner {
        /* Before the token is set this matches nothing, which is correct: until
           then there is no principal here to protect. */
        if (token == address(stakingToken)) revert CannotRecoverStakingToken();
        IERC20(token).safeTransfer(owner(), amount);
        emit Recovered(token, amount);
    }
}
