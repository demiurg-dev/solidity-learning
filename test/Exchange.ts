import {
    // time
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import hre from "hardhat";
import { IERC20 } from "../typechain-types";

describe("Exchange", function () {
    function parseUnits(x: string | number | bigint): bigint {
        return hre.ethers.parseUnits(x.toString(), 18);
    }

    // A fixture that deploys the exchange contract and initializes accounts with some tokens.
    async function deployExchangeAndGiveSomeTokens() {
        const [owner, user1, user2, user3] = await hre.ethers.getSigners();

        // Deploy mock tokens
        const initialSupply = parseUnits(100);
        const ERC20 = await hre.ethers.getContractFactory("MockERC20");
        const tokenA = await ERC20.deploy("Token A", "TKA");
        const tokenB = await ERC20.deploy("Token B", "TKB");

        // Mint some tokens
        await tokenA.mint(owner.address, initialSupply);
        await tokenB.mint(owner.address, initialSupply);

        // Deploy exchange
        const Exchange = await hre.ethers.getContractFactory("Exchange");
        const exchange = await Exchange.deploy();

        return { owner, user1, user2, user3, exchange, tokenA, tokenB, initialSupply };
    }

    const HEX_ZERO = "0x0000000000000000000000000000000000000000";
    function is_non_order(x: {id: bigint, maker: String, tokenBuy: string, tokenSell: string, cost: bigint, quantity: bigint}) {

        expect(x.id).to.equal(0);
        expect(x.tokenBuy).to.equal(HEX_ZERO);
        expect(x.tokenSell).to.equal(HEX_ZERO);
        expect(x.maker).to.equal(HEX_ZERO);
        expect(x.cost).to.equal(0);
        expect(x.quantity).to.equal(0);
    }

    async function expect_balance(token: IERC20, addr: any, value: any, msg: any) {
        const balance = await token.balanceOf(addr);
        expect(balance, msg).is.equal(value)
    }

    describe("Deployment", function() {
        it("Order id counter starts at 0", async function() {
            const { exchange } = await loadFixture(deployExchangeAndGiveSomeTokens);
            const orderId = await exchange.lastOrderId();
            expect(orderId).to.equal(0);
        });
        it("Empty order book on deployment", async function() {
            const { exchange } = await deployExchangeAndGiveSomeTokens();

            // Empty orders
            is_non_order(await exchange.orderBook(0));
            is_non_order(await exchange.orderBook(1));
        });
    });

    describe("Order placement", function() {
        it("Cannot place order without allowance", async function() {
            const { exchange, user1, tokenA, tokenB } = await loadFixture(deployExchangeAndGiveSomeTokens);

            // Transfer funds (without allowance).
            const hundred = parseUnits(100);
            await tokenB.transfer(user1, hundred);
            await expect_balance(tokenB, user1, hundred, "user1 tokenB");

            await expect(exchange.connect(user1).placeOrder(tokenA.target, tokenB.target, hundred, hundred)).to.be.reverted;
        });

        it("Place order", async function() {
            const { exchange, user1, tokenA, tokenB } = await loadFixture(deployExchangeAndGiveSomeTokens);

            // Transfer funds and approve transfer to exchange
            await tokenB.transfer(user1, 2);
            await tokenB.connect(user1).approve(exchange.target, 2);
            await expect_balance(tokenB, exchange.target, 0, "exchange pre");

            // Ensure order is placed and funds are transfered
            await expect(exchange.connect(user1).placeOrder(tokenA.target, tokenB.target, 2, 2)).to.emit(exchange, "NewOrder");
            const postBalance = await tokenB.balanceOf(exchange.target);
            await expect_balance(tokenB, exchange.target, 2, "exchange post");
        });

        it("Cancel non-existent order", async function() {
            const { exchange, user1 } = await loadFixture(deployExchangeAndGiveSomeTokens);

            // Order does not exist
            await expect(exchange.connect(user1).cancelOrder(0)).to.be.reverted;
        });

        it("Cancel order", async function() {
            const { exchange, user1, tokenA, tokenB } = await loadFixture(deployExchangeAndGiveSomeTokens);

            // Transfer funds and approve transfer to exchange
            await tokenB.transfer(user1, 2);
            await tokenB.connect(user1).approve(exchange.target, 2);

            await exchange.connect(user1).placeOrder(tokenA.target, tokenB.target, 2, 2);
            await expect_balance(tokenB, user1, 0, "exchange post order");
            await expect(exchange.connect(user1).cancelOrder(0)).to.emit(exchange, "OrderCancel");
            await expect_balance(tokenB, user1, 2, "exchange post cancel");
        });

        it("Trade", async function() {
            const { exchange, user1, user2, user3, tokenA, tokenB } = await loadFixture(deployExchangeAndGiveSomeTokens);

            // User 1 has token 1, user 2 has token b (and the want to swap)
            await tokenA.transfer(user1, 10);
            await tokenA.connect(user1).approve(exchange.target, 10);
            await tokenB.transfer(user2, 10);
            await tokenB.connect(user2).approve(exchange.target, 10);

            // Make orders
            await exchange.connect(user1).placeOrder(tokenB.target, tokenA.target, 9, 10);
            await exchange.connect(user2).placeOrder(tokenA.target, tokenB.target, 8, 10);

            // Execute order
            await expect(exchange.connect(user3).matchOrders(0, 1)).to.emit(exchange, "Trade");

            // Balance after the trade
            // User 1 traded tokens A for 9 tokens B
            await expect_balance(tokenA, user1, 0, "user1 A");
            await expect_balance(tokenB, user1, 9, "user1 B");
            // User 2 traded tokens B for 8 tokens A
            await expect_balance(tokenA, user2, 8, "user2 A");
            await expect_balance(tokenB, user2, 0, "user2 B");
            // User 3 for excess of 2 tokens A, and 1 token B
            await expect_balance(tokenA, user3, 2, "user3 A");
            await expect_balance(tokenB, user3, 1, "user3 B");
        })
    });

    // TODO: Much more testing, especially around corner cases
});