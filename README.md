[![CI Status](https://github.com/demiurg-dev/solidity-learning/actions/workflows/test.yml/badge.svg)](https://github.com/demiurg-dev/solidity-learning/actions/workflows/test.yml)

# Solidity learning

This repository contains a collection of smart contracts written in Solidity, accompanied by tests to
support learning and exploration. The aim is to provide examples that are easy to follow, with
documentation to help others who are also learning smart contract development. This is a
work-in-progress resource for anyone interested in understanding and practicing Solidity and
blockchain programming.

This project uses Hardhat, a powerful development environment for Ethereum smart contracts. Hardhat 
simplifies tasks like compilation, testing, and deployment, making it easier to build and debug 
Solidity projects. Below are instructions on how to run certain

## Smart contracts

- [`Exchange`](contracts/Exchange.sol) - A very simple exchange where limit orders between
    [ERC20](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/) tokens
    can be placed and matched, with incentive for a matcher.
- [`Lock`](contracts/Lock.sol) - A sample from Hardhat that unlocks some funds to the receiver after
    some predefined time has passed.

### Further ideas

We plan to add the following contracts in the near future:
- Simple fully On-Chain Automated Market Maker (AMM)
- Decentralized Lottery with Anti-Collusion Mechanisms 

## Tests

Each smart contract, under [`contracts/`](contracts/) has a test suite, with the same name under
[`test/`](test/).

## Running

Try some of the following commands:

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
```
