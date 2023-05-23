# EVMLightning SDK

An overview of the whole system is available [here](https://github.com/adambor/SolLightning-readme)

A javascript client for SolLightning bitcoin <-> EVM trustlesss cross-chain swaps.

This project is intended to be used in web-browsers and browser-like environments, it uses (by default) browser's local storage to store swap data.

**NOTE: This library is still in alpha stage and MAY contain bugs and uncovered edge-cases. Use at your own risk!**

## Installation
```
npm install evmlightning-sdk
```

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
1. Create swap price checker
    ```javascript
    //Defines swap token amount differences tolerance in PPM (1000000 = 100%)
    const _swapDifferenceTolerance = 5000; //Max allowed difference 0.5%
    //Create swap pricing instance
    const swapPricing = new CoinGeckoSwapPrice(new BN(_swapDifferenceTolerance));
    ```
2. Create AnchorProvider and initialize swapper
    ```javascript
    //Create anchor provider
    const anchorProvider = new AnchorProvider(connection, wallet, {preflightCommitment: "processed"});
    //Create the swapper instance
    const swapper = new Swapper(anchorProvider, {swapPrice: swapPricing});
    //Initialize the swapper
    await swapper.init();
    ```

### Swap Solana -> BTC
```javascript
//Create the swap: swapping _useToken to BTC
const swap = await swapper.createSolToBTCSwap(new PublicKey(_useToken), _address, _amount);
//Get the amount required to pay and fee
const amountToBePaid = swap.getInAmount();
const fee = swap.getFee();
//Pay for the swap
await swap.commit();
//Wait for the swap to conclude
const result = await swap.waitForPayment();
if(!result) {
    //Swap failed, money can be refunded
    await swap.refund();
} else {
    //Swap successful
}
```

### Swap Solana -> BTCLN
```javascript
//Create the swap: swapping _useToken to BTC
const swap = await swapper.createSolToBTCLNSwap(new PublicKey(_useToken), _lightningInvoice);
//Get the amount required to pay and fee
const amountToBePaid = swap.getInAmount();
const fee = swap.getFee();
//Pay for the swap
await swap.commit();
//Wait for the swap to conclude
const result = await swap.waitForPayment();
if(!result) {
    //Swap failed, money can be refunded
    await swap.refund();
} else {
    //Swap successful
}
```

### Swap BTC -> Solana
```javascript
//Create the swap: swapping BTC to _useToken
const swap = await swapper.createBTCtoSolSwap(new PublicKey(_useToken), _amount);
const amountToBePaidOnBitcoin = swap.getInAmount(); //The amount received MUST match
const amountToBeReceivedOnSolana = swap.getOutAmount(); //Get the amount we will receive on Solana
const fee = swap.getFee();

//Once client is happy with the fee
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

### Swap BTCLN -> Solana
```javascript
//Create the swap: swapping BTC to _useToken
const swap = await swapper.createBTCLNtoSolSwap(new PublicKey(_useToken), _amount);
//Get the bitcoin lightning network invoice (the invoice contains pre-entered amount)
const receivingLightningInvoice = swap.getAddress();
//Get the QR code (contains the lightning network invoice)
const qrCodeData = swap.getQrData(); //Data that can be displayed in the form of QR code
//Get the amount we will receive on Solana
const amountToBeReceivedOnSolana = swap.getOutAmount();
const fee = swap.getFee();
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
