// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @dev A simple exchange between arbitrary tokens that rewards matching compatible orders.
 */
contract Exchange {
    // Description of a single order.
    struct Order {
        uint256 id;             // Unique order id
        address maker;          // Address placing the order
        address tokenBuy;       // Token being bought
        address tokenSell;      // Token being sold
        uint256 quantity;       // Number of tokenBuy tokens to buy
        uint256 cost;           // Number of tokenSell tokens to spend (cost)
        uint256 timestamp;      // Time of order creation
        OrderStatus status;     // Status of the order
    }

    // Order can be either open or closed.
    enum OrderStatus { CLOSED, OPEN }

    // Counter for unique order IDs.
    uint256 public lastOrderId;

    // Mapping from order ID to an order.
    mapping(uint256 => Order) public orderBook;

    /**
     * @dev Emitted when a new order is created that buys `quantity` of `tokenBuy` token
     * for `cost` of `tokenSell` tokens.
     */
    event NewOrder(address tokenBuy, address tokenSell, uint256 quantity, uint256 cost);

    /**
     * @dev Emitted when order with `orderId` is cancelled.
     */
    event OrderCancel(uint256 orderId);

    /**
     * @dev Emitted when a trade has been made by exchanging `amountA` of `tokenA` for `amountB` of `tokenB`.
     */
    event Trade(address tokenA, address tokenB, uint256 amountA, uint256 amountB);

    // Note: no need for constructor here.


    /**
     * @dev Places a new order in the order book. The order denotes that `quantity` of `tokenBuy` tokens
     * is exchanged for `cost` of `tokenSell` tokens. This will transfer `cost` of `tokenSell` to the contract, for the
     * duration while the order is opened. When the order is closed, the tokens will be returned. Hence, for this
     * transaction to succeed, the tokens need to be approved.
     */
    function placeOrder(address tokenBuy, address tokenSell, uint256 quantity, uint256 cost) external {
        require(tokenBuy != tokenSell, "Buy and sell tokens must be different");
        require(quantity > 0, "Quantity must be greater than zero");
        require(cost > 0, "Cost must be greater than zero");

        // Note: Transfer from on an ERC20 token requires pre-authorization.
        IERC20(tokenSell).transferFrom(msg.sender, address(this), cost);

        // Store new order
        Order memory newOrder = Order({
            id: lastOrderId++,
            maker: msg.sender,
            tokenBuy: tokenBuy,
            tokenSell: tokenSell,
            quantity: quantity,
            cost: cost,
            timestamp: block.timestamp,
            status: OrderStatus.OPEN
        });
        orderBook[newOrder.id] = newOrder;

        // Notify about new order
        emit NewOrder(tokenBuy, tokenSell, quantity, cost);
    }

    /**
     * @dev Cancels order with ID `orderID`. Only the order owner can cancel it.
     * The tokens reserved while placing the order will be reimbursed.
     */
    function cancelOrder(uint256 orderId) external {
        Order storage order = orderBook[orderId];
        require(order.maker == msg.sender, "Only order maker can cancel order");
        require(order.status == OrderStatus.OPEN, "Order already closed");
        
        // Return reserved cost
        IERC20(order.tokenSell).transfer(msg.sender, order.cost);

        // Close order (so it cannot be matched)
        _closeOrder(order);

        // Notify about order being cancelled
        emit OrderCancel(orderId);
    }

    /**
     * @dev Match two orders with IDs `orderId1` and `orderId2`. The orders need to be opened,
     * exchange matching tokens, and have matching quantities and costs. Any excess tokens are given to the matcher.
     */
    function matchOrders(uint256 orderId1, uint256 orderId2) external {
        // Find orders to match
        Order storage order1 = orderBook[orderId1];
        Order storage order2 = orderBook[orderId2];

        // Check that orders are still opened
        require(order1.status == OrderStatus.OPEN && order2.status == OrderStatus.OPEN, "Match orders must be open");
        require(order1.tokenBuy == order2.tokenSell && order1.tokenSell == order2.tokenBuy, "Match order have incompatible tokens");

        // Make sure that orders can be matched
        require(order1.quantity <= order2.cost && order2.quantity <= order1.cost, "Orders cannot be matched");
        uint256 excess1;
        uint256 excess2;
        unchecked {
            excess1 = order2.cost - order1.quantity;
            excess2 = order1.cost - order2.quantity;
        }

        // Transfer tokens to order makers
        IERC20(order1.tokenBuy).transfer(order1.maker, order1.quantity);
        IERC20(order2.tokenBuy).transfer(order2.maker, order2.quantity);

        // Transfer excess to the order matcher as a reward / fee
        if (excess1 > 0) {
            IERC20(order1.tokenBuy).transfer(msg.sender, excess1);
        }
        if (excess2 > 0) {
            IERC20(order2.tokenBuy).transfer(msg.sender, excess2);
        }

        // Mark the orders closed
        _closeOrder(order1);
        _closeOrder(order2);

        // Emit event of a trade
        emit Trade(order1.tokenBuy, order2.tokenBuy, order1.quantity, order2.quantity);
    }

    /**
     * @dev Closes the order.
     */
    function _closeOrder(Order storage order) private {
        order.quantity = 0;
        order.cost = 0;
        order.status = OrderStatus.CLOSED;
    }
}