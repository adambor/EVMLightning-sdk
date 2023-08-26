# EVMLightning SDK

An overview of the whole system is available [here](https://github.com/adambor/SolLightning-readme)

A typescript client for SolLightning bitcoin <-> EVM trustlesss cross-chain swaps.

**NOTE: This library is still in alpha stage, MAY contain bugs and uncovered edge-cases**

## Installation
Install ethers.js (version 5)
```
npm install ethers@5
```

Install EVMLightning SDK
```
npm install evmlightning-sdk
```

## Intermediary registry

The library by default fetches the available intermediaries from the registry. This registry is for now hosted on github [here](https://github.com/adambor/QLightning-registry) (Q only). If you want to add your intermediary node to the registry, just open the PR on the repo.

You can also run [your own intermediary](https://github.com/adambor/EVMLightning-Intermediary-TS) and force the SDK to only use that one by specifying the "intermediaryUrl" option in the SDK setup.

## How to use?

This library is made to work with ethers.js lib and accept ethers.js providers and signers.

### Peparations
```javascript
//Using metamask
const provider = new ethers.providers.Web3Provider(window.ethereum);
await provider.send("eth_requestAccounts", []);
const signer = provider.getSigner();
```
or
```javascript
//Creating a wallet and provider from scratch
const provider = new ethers.providers.JsonRpcProvider(_rpcUrl);
const signer = new ethers.Wallet(_privateKey); //Or ethers.Wallet.createRandom() to generate new one
signer.connect(provider);
```

### Initialization

#### a. Using existing node registry
```typescript
//Defines max swap price difference to the current market price as fetched from CoinGecko API tolerance in PPM (1000000 = 100%)
const _swapDifferenceTolerance = new BN(2500); //Max allowed difference 0.25%

//Set swapper options
const _network = "Q"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"

//For browser like environment (using browser local storage)
const _options = createSwapperOptions(_network, _swapDifferenceTolerance);
//For NodeJS environment (using filesystem storage)
const _options = createNodeJSSwapperOptions(_network, _swapDifferenceTolerance); //import from "evmlightning-sdk/dist/NodeJSSwapperOptions"

//Create the swapper instance
const swapper = new EVMSwapper(signer, _options);
//Initialize the swapper
await swapper.init();
```

#### b. Using own intermediary node on TESTNET
```typescript
//Defines max swap price difference to the current market price as fetched from CoinGecko API tolerance in PPM (1000000 = 100%)
const _swapDifferenceTolerance = new BN(2500); //Max allowed difference 0.25%

//Set swapper options
const _network = "Q"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _intermediaryUrl = "http://localhost:3000"; //URL of the desired swap intermediary

//For browser like environment (using browser local storage)
const _options = createSwapperOptions(_network, _swapDifferenceTolerance, _intermediaryUrl);
//For NodeJS environment (using filesystem storage)
const _options = createNodeJSSwapperOptions(_network, _swapDifferenceTolerance, _intermediaryUrl); //import from "evmlightning-sdk/dist/NodeJSSwapperOptions"

//Create the swapper instance
const swapper = new EVMSwapper(signer, _options);
//Initialize the swapper
await swapper.init();
```
    
#### c. Using own intermediary node on DEVNET with custom tokens
```typescript
//Defines max swap price difference to the current market price as fetched from CoinGecko API tolerance in PPM (1000000 = 100%)
const _swapDifferenceTolerance = new BN(2500); //Max allowed difference 0.25%

//Set swapper options
const _network = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _intermediaryUrl = "http://localhost:3000"; //URL of the desired swap intermediary
const _tokenAddresses = {
    WBTC: _wbtcAddress,
    USDC: _usdcAddress,
    USDT: _usdtAddress
}

//For browser like environment (using browser local storage)
const _options = createSwapperOptions(_network, _swapDifferenceTolerance, _intermediaryUrl, _tokenAddresses);
//For NodeJS environment (using filesystem storage)
const _options = createNodeJSSwapperOptions(_network, _swapDifferenceTolerance, _intermediaryUrl, _tokenAddresses); //import from "evmlightning-sdk/dist/NodeJSSwapperOptions"

//Create the swapper instance
const swapper = new EVMSwapper(signer, _options);
//Initialize the swapper
await swapper.init();
```

### Bitcoin on-chain swaps

#### Swap EVM -> Bitcoin on-chain
```typescript
const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
const _address: string = "bc1qev3mcx2q57znyk7l8uwwzenke67as6gtc7rhn3"; //Destination bitcoin address
const _amount: BN = new BN(10000); //Amount of satoshis to send (1 BTC = 100 000 000 satoshis)

//Create the swap: swapping _useToken to Bitcoin on-chain, sending _amount of satoshis (smallest unit of bitcoin) to _address
const swap: ToBTCSwap<EVMSwapData> = await swapper.createEVMToBTCSwap(_useToken, _address, _amount);

//Get the amount required to pay and fee
const amountToBePaid: BN = swap.getInAmount(); //Amount to be paid in the ERC-20/ETH token on EVM (including fee), in base units (no decimals)
const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM (already included in the getInAmount()), in base units (no decimals)

//Get swap expiration time
const expiry: number = swap.getExpiry(); //Expiration time of the swap in UNIX milliseconds, swap needs to be initiated before this time

//Check if ERC-20 approval is required
const isApprovalRequired: boolean = await swapper.isApproveRequired(swap);

//Approve the spending of ERC-20 token by contract
if(isApprovalRequired) {
    await swapper.approveSpend(swap);
}

//Initiate and pay for the swap
await swap.commit();

//Wait for the swap to conclude
const result: boolean = await swap.waitForPayment();
if(!result) {
    //Swap failed, money can be refunded
    await swap.refund();
} else {
    //Swap successful
}
```

#### Swap Bitcoin on-chain -> EVM
```typescript
const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
const _amount: BN = new BN(10000); //Amount of satoshis to receive (1 BTC = 100 000 000 satoshis)

//Create the swap: swapping _amount of satoshis of Bitcoin on-chain to _useToken
const swap: FromBTCSwap<EVMSwapData> = await swapper.createBTCtoEVMSwap(_useToken, _amount);

//Get the amount required to pay, amount to be received and fee
const amountToBePaidOnBitcoin: BN = swap.getInAmount(); //The amount to be received on bitcoin on-chain address, the amount MUST match! In satoshis (no decimals)
const amountToBeReceivedOnEVM: BN = swap.getOutAmount(); //Get the amount we will receive on EVM (excluding fee), in base units (no decimals)
const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM, in base units (no decimals)

//Get swap offer expiration time
const expiry: number = swap.getExpiry(); //Expiration time of the swap offer in UNIX milliseconds, swap needs to be initiated before this time

//Get security deposit amount (amount of ETH that needs to be put down to rent the liquidity from swap intermediary), you will get this deposit back if you successfully conclude the swap
const securityDeposit: BN = swap.getSecurityDeposit();
//Get claimer bounty (amount of ETH reserved as a reward for watchtowers to claim the swap on your behalf in case you go offline)
const claimerBounty: BN = swap.getClaimerBounty();

//Once client is happy with swap offer
await swap.commit();

//Get the bitcoin address and amount required to be sent to that bitcoin address
const receivingAddressOnBitcoin = swap.getAddress();
//Get the QR code (contains the address and amount)
const qrCodeData = swap.getQrData(); //Data that can be displayed in the form of QR code
//Get the timeout (in UNIX millis), the transaction should be made in under this timestamp, and with high enough fee for the transaction to confirm quickly
const expiryTime = swap.getTimeoutTime();

try {
    //Wait for the payment to arrive
    await swap.waitForPayment(null, null, (txId: string, confirmations: number, targetConfirmations: number) => {
        //Updates about the swap state, txId, current confirmations of the transaction, required target confirmations
    });
    //Claim the swap funds
    await swap.claim();
} catch(e) {
    //Error occurred while waiting for payment
}
```

### Bitcoin lightning network swaps

#### Swap EVM -> Bitcoin lightning network
```typescript
const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
const _lightningInvoice: string = "lnbc10u1pj2q0g9pp5ejs6m677m39cznpzum7muruvh50ys93ln82p4j9ks2luqm56xxlshp52r2anlhddfa9ex9vpw9gstxujff8a0p8s3pzvua930js0kwfea6scqzzsxqyz5vqsp5073zskc5qfgp7lre0t6s8uexxxey80ax564hsjklfwfjq2ew0ewq9qyyssqvzmgs6f8mvuwgfa9uqxhtza07qem4yfhn9wwlpskccmuwplsqmh8pdy6c42kqdu8p73kky9lsnl40qha5396d8lpgn90y27ltfc5rfqqq59cya"; //Destination lightning network invoice

//Create the swap: swapping _useToken to Bitcoin lightning network, sending to _lightningInvoice (lightning network invoice needs to contain an amount!)
const swap: ToBTCLNSwap<EVMSwapData> = await swapper.createEVMToBTCLNSwap(_useToken, _lightningInvoice);

//Get the amount required to pay and fee
const amountToBePaid: BN = swap.getInAmount(); //Amount to be paid in the ERC-20/ETH token on EVM (including fee), in base units (no decimals)
const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM (already included in the getInAmount()), in base units (no decimals)

//Get swap expiration time
const expiry: number = swap.getExpiry(); //Expiration time of the swap in UNIX milliseconds, swap needs to be initiated before this time

//Check if ERC-20 approval is required
const isApprovalRequired: boolean = await swapper.isApproveRequired(swap);

//Approve the spending of ERC-20 token by contract
if(isApprovalRequired) {
    await swapper.approveSpend(swap);
}

//Initiate and pay for the swap
await swap.commit();

//Wait for the swap to conclude
const result: boolean = await swap.waitForPayment();
if(!result) {
    //Swap failed, money can be refunded
    await swap.refund();
} else {
    //Swap successful
}
```

#### Swap Bitcoin lightning network -> EVM
```typescript
const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
const _amount: BN = new BN(10000); //Amount of satoshis to receive (1 BTC = 100 000 000 satoshis)

//Create the swap: swapping _amount of satoshis from Bitcoin lightning network to _useToken
const swap: FromBTCLNSwap<EVMSwapData> = await swapper.createBTCLNtoEVMSwap(_useToken, _amount);

//Get the bitcoin lightning network invoice (the invoice contains pre-entered amount)
const receivingLightningInvoice: string = swap.getAddress();
//Get the QR code (contains the lightning network invoice)
const qrCodeData: string = swap.getQrData(); //Data that can be displayed in the form of QR code

//Get the amount we will receive on EVM
const amountToBeReceivedOnEVM: BN = swap.getOutAmount(); //Get the amount we will receive on EVM (excluding fee), in base units (no decimals)
const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM, in base units (no decimals)

try {
    //Wait for the payment to arrive
    await swap.waitForPayment();
    //Claim the swap funds
    await swap.commitAndClaim();
} catch(e) {
    //Error occurred while waiting for payment
}
```

### LNURLs & readable lightning identifiers

LNURLs extend the lightning network functionality by creating static lightning addreses (LNURL-pay & static internet identifiers) and QR codes which allow you to pull funds from them (LNURL-withdraw)

This SDK supports:
 * LNURL-pay ([LUD-6](https://github.com/lnurl/luds/blob/luds/06.md), [LUD-9](https://github.com/lnurl/luds/blob/luds/09.md), [LUD-10](https://github.com/lnurl/luds/blob/luds/10.md), [LUD-12](https://github.com/lnurl/luds/blob/luds/12.md))
 * LNURL-withdraw ([LUD-3](https://github.com/lnurl/luds/blob/luds/03.md))
 * Static internet identifiers ([LUD-16](https://github.com/lnurl/luds/blob/luds/16.md))

#### Differences

Lightning invoices:
 * One time use only
 * Need to have a fixed amount, therefore recipient has to set the amount
 * Static and bounded expiration
 * You can only pay to a lightning invoice, not withdraw funds from it

LNURLs & lightning identifiers:
 * Reusable
 * Programmable expiry
 * Allows payer to set an amount
 * Supports both, paying (LNURL-pay) and withdrawing (LNURL-withdraw)
 * Possibility to attach a message/comment to a payment
 * Receive a message/url as a result of the payment
 
#### Helpers

It is good practice to automatically distinguish between lightning network invoices & LNURLs and adjust the UI accordingly.
Therefore there are a few helper functions to help with that:
```typescript
const isLNInvoice: boolean = swapper.isValidLightningInvoice(_input); //Checks if the input is lightning network invoice
const isLNURL: boolean = swapper.isValidLNURL(_input); //Checks if the input is LNURL or lightning identifier
if(isLNURL) {
    //Get the type of the LNURL
    const result: (LNURLPay | LNURLWithdraw | null) = await swapper.getLNURLTypeAndData(_input);
    if(result.type==="pay") {
        const lnurlPayData: LNURLPay = result;
        const minPayable: BN = lnurlPayData.min; //Minimum payment amount in satoshis
        const maxPayable: BN = lnurlPayData.max; //Maximum payment amount in satoshis
        const icon: (string | null) = lnurlPayData.icon; //URL encoded icon that should be displayed on the UI
        const shortDescription: (string | null) = lnurlPayData.shortDescription; //Short description of the payment
        const longDescription: (string | null) = lnurlPayData.longDescription; //Long description of the payment
        const maxCommentLength: (number | 0) = lnurlPayData.commentMaxLength; //Maximum allowed length of the payment message/comment (0 means no comment allowed)
        //Should show a UI displaying the icon, short description, long description, allowing the user to choose an amount he wishes to pay and possibly also a comment
    }
    if(result.type==="withdraw") {
        const lnurlWithdrawData: LNURLWithdraw = result;
        const minWithdrawable: BN = lnurlWithdrawData.min;
        const maxWithdrawable: BN = lnurlWithdrawData.max;
        //Should show a UI allowing the user to choose an amount he wishes to withdraw
    }
}
```

#### Swap EVM -> Bitcoin lightning network 
```typescript
const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
const _lnurlOrIdentifier: string = "lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhkx6rfvdjx2ctvxyesuk0a27"; //Destination LNURL-pay or readable identifier
const _amount: BN = new BN(10000); //Amount of satoshis to send (1 BTC = 100 000 000 satoshis)
const _comment: (string | null) = "Hello, Lightning!"; //Optional comment for the payment

//Create the swap: swapping _useToken to Bitcoin lightning network, sending _amount of satoshis to _lnurlOrIdentifier
const swap: ToBTCLNSwap<EVMSwapData> = await swapper.createEVMToBTCLNSwapViaLNURL(_useToken, _lnurlOrIdentifier, _amount, _comment);

//Get the amount required to pay and fee
const amountToBePaid: BN = swap.getInAmount(); //Amount to be paid in the ERC-20/ETH token on EVM (including fee), in base units (no decimals)
const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM (already included in the getInAmount()), in base units (no decimals)

//Get swap expiration time
const expiry: number = swap.getExpiry(); //Expiration time of the swap in UNIX milliseconds, swap needs to be initiated before this time

//Check if ERC-20 approval is required
const isApprovalRequired: boolean = await swapper.isApproveRequired(swap);

//Approve the spending of ERC-20 token by contract
if(isApprovalRequired) {
    await swapper.approveSpend(swap);
}

//Initiate and pay for the swap
await swap.commit();

//Wait for the swap to conclude
const result: boolean = await swap.waitForPayment();
if(!result) {
    //Swap failed, money can be refunded
    await swap.refund();
} else {
    //Swap successful
    if(swap.hasSuccessAction()) {
        //Contains a success action that should displayed to the user
        const successMessage = swap.getSuccessAction();
        const description: string = successMessage.description; //Description of the message
        const text: (string | null) = successMessage.text; //Main text of the message
        const url: (string | null) = successMessage.url; //URL link which should be displayed
    }
}
```

#### Swap Bitcoin lightning network -> EVM
```typescript
const _useNetwork: string = "Q_TESTNET"; //"Q", "Q_TESTNET", "POLYGON", "POLYGON_TESTNET" or "LINEA_TESTNET"
const _useToken: string = EVMChains[_useNetwork].tokens.USDC; //Token to swap from
const _lnurl: string = "lnurl1dp68gurn8ghj7ampd3kx2ar0veekzar0wd5xjtnrdakj7tnhv4kxctttdehhwm30d3h82unvwqhkx6rfvdjx2ctvxyesuk0a27"; //Destination LNURL-pay or readable identifier
const _amount: BN = new BN(10000); //Amount of satoshis to withdraw (1 BTC = 100 000 000 satoshis)

//Create the swap: swapping _amount of satoshis from Bitcoin lightning network to _useToken
const swap: FromBTCLNSwap<EVMSwapData> = await swapper.createBTCLNtoEVMSwapViaLNURL(_useToken, _lnurl, _amount);

//Get the amount we will receive on EVM
const amountToBeReceivedOnEVM: BN = swap.getOutAmount(); //Get the amount we will receive on EVM (excluding fee), in base units (no decimals)
const fee: BN = swap.getFee(); //Swap fee paid in the ERC-20/ETH token on EVM, in base units (no decimals)

try {
    //Wait for the payment to arrive
    await swap.waitForPayment();
    //Claim the swap funds
    await swap.commitAndClaim();
} catch(e) {
    //Error occurred while waiting for payment
}
```

### Get refundable swaps
You can refund the swaps in one of two cases:
* In case intermediary is non-cooperative and goes offline, you can claim the funds from the swap contract back after some time.
* In case intermediary tried to pay but was unsuccessful, so he sent you signed message with which you can refund now without waiting.

This call can be checked on every startup and periodically every few minutes.
```javascript
//Get the swaps
const refundableSwaps = await swapper.getRefundableSwaps();
//Refund all the swaps
for(let swap of refundableSwaps) {
    await swap.refund();
}
```

### Get claimable swaps
Returns swaps that are ready to be claimed by the client, this can happen if client closes the application when a swap is in-progress and the swap is concluded while the client is offline.

```javascript
//Get the swaps
const claimableSwaps = await swapper.getClaimableSwaps();
//Claim all the claimable swaps
for(let swap of claimableSwaps) {
    await swap.commitAndClaim();
}
```
