import * as bitcoin from "bitcoinjs-lib";
import * as bolt11 from "bolt11";
import * as BN from "bn.js";
import {ConstantBTCLNtoSol, ConstantBTCtoSol, ConstantSoltoBTC, ConstantSoltoBTCLN} from "./Constants";


import {CoinGeckoSwapPrice, IWrapperStorage, LNURLPay, LNURLWithdraw} from "crosslightning-sdk-base";
import {EVMBtcRelay, EVMSwapData, EVMSwapProgram} from "crosslightning-evm";
import {EVMChainEventsBrowser} from "crosslightning-evm/dist/evm/events/EVMChainEventsBrowser";

import {
    BTCLNtoSolSwap,
    BTCLNtoSolWrapper,
    BTCtoSolNewSwap,
    BTCtoSolNewWrapper,
    ClientSwapContract,
    IBTCxtoSolSwap,
    IntermediaryDiscovery,
    IntermediaryError,
    ISolToBTCxSwap,
    ISwap,
    ISwapPrice,
    LocalStorageManager,
    LocalWrapperStorage,
    MempoolBitcoinRpc,
    MempoolBtcRelaySynchronizer,
    SoltoBTCLNSwap,
    SoltoBTCLNWrapper,
    SoltoBTCSwap,
    SoltoBTCWrapper,
    SwapType,
    ChainUtils
} from "crosslightning-sdk-base";
import {Signer} from "ethers";
import {EVMChains} from "./EVMChains";
import {BitcoinNetwork} from "./BitcoinNetwork";

export type SwapperOptions = {
    intermediaryUrl?: string,
    //wbtcToken?: PublicKey,
    pricing?: ISwapPrice,
    registryUrl?: string,

    addresses?: {
        swapContract: string,
        btcRelayContract: string
    },
    bitcoinNetwork?: BitcoinNetwork,

    storage?: {
        toBtc?: IWrapperStorage,
        fromBtc?: IWrapperStorage,
        toBtcLn?: IWrapperStorage,
        fromBtcLn?: IWrapperStorage,
    }
};

export class EVMSwapper {

    tobtcln: SoltoBTCLNWrapper<EVMSwapData>;
    tobtc: SoltoBTCWrapper<EVMSwapData>;
    frombtcln: BTCLNtoSolWrapper<EVMSwapData>;
    frombtc: BTCtoSolNewWrapper<EVMSwapData>;

    private readonly intermediaryUrl: string;
    private readonly intermediaryDiscovery: IntermediaryDiscovery<EVMSwapData>;
    private readonly swapContract: ClientSwapContract<EVMSwapData>;
    private readonly chainEvents: EVMChainEventsBrowser;

    private readonly evmSwapContract: EVMSwapProgram;

    private readonly bitcoinNetwork: bitcoin.Network;

    /**
     * Returns true if string is a valid bitcoin address
     *
     * @param address
     */
    isValidBitcoinAddress(address: string): boolean {
        try {
            bitcoin.address.toOutputScript(address, this.bitcoinNetwork);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Returns true if string is a valid BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    isValidLightningInvoice(lnpr: string): boolean {
        try {
            const parsed = bolt11.decode(lnpr);
            if(parsed.satoshis!=null) return true;
        } catch (e) {}
        return false;
    }

    /**
     * Returns true if string is a valid LNURL (no checking on type is performed)
     *
     * @param lnurl
     */
    isValidLNURL(lnurl: string): boolean {
        return this.swapContract.isLNURL(lnurl);
    }

    /**
     * Returns type and data about an LNURL
     *
     * @param lnurl
     */
    getLNURLTypeAndData(lnurl: string): Promise<LNURLPay | LNURLWithdraw | null> {
        return this.swapContract.getLNURLType(lnurl);
    }

    /**
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    static getLightningInvoiceValue(lnpr: string): BN {
        const parsed = bolt11.decode(lnpr);
        if(parsed.satoshis!=null) return new BN(parsed.satoshis);
        return null;
    }


    static createSwapperOptions(chain: "Q" | "Q_TESTNET" | "POLYGON" | "POLYGON_TESTNET" | "LINEA_TESTNET", maxFeeDifference?: BN, intermediaryUrl?: string, tokenAddresses?: {WBTC: string, USDC: string, USDT: string}): SwapperOptions {
        const coinsMap = CoinGeckoSwapPrice.createCoinsMap(
            EVMChains[chain].tokens.WBTC || tokenAddresses?.WBTC,
            EVMChains[chain].tokens.USDC || tokenAddresses?.USDC,
            EVMChains[chain].tokens.USDT || tokenAddresses?.USDT
        );

        coinsMap["0x0000000000000000000000000000000000000000"] = {
            coinId: EVMChains[chain].coinGeckoId,
            decimals: 18
        };

        return {
            pricing: new CoinGeckoSwapPrice(
                maxFeeDifference || new BN(5000),
                coinsMap
            ),
            registryUrl: EVMChains[chain].registryUrl,

            addresses: {
                swapContract: EVMChains[chain].addresses.swapContract,
                btcRelayContract: EVMChains[chain].addresses.btcRelayContract
            },
            bitcoinNetwork: EVMChains[chain].bitcoinNetwork,
            intermediaryUrl: intermediaryUrl
        }
    }

    constructor(provider: Signer, options?: SwapperOptions) {
        options = options || {};
        options.addresses = options.addresses || EVMChains.POLYGON_TESTNET.addresses;

        this.bitcoinNetwork = ConstantBTCtoSol.network;

        if(options.bitcoinNetwork!=null) switch (options.bitcoinNetwork) {
            case BitcoinNetwork.MAINNET:
                this.bitcoinNetwork = bitcoin.networks.bitcoin;
                ChainUtils.setMempoolUrl("https://mempool.space/api/");
                break;
            case BitcoinNetwork.TESTNET:
                this.bitcoinNetwork = bitcoin.networks.testnet;
                ChainUtils.setMempoolUrl("https://mempool.space/testnet/api/");
                break;
            case BitcoinNetwork.REGTEST:
                this.bitcoinNetwork = bitcoin.networks.regtest;
                break;
        }

        const bitcoinRpc = new MempoolBitcoinRpc();
        const btcRelay = new EVMBtcRelay(provider, bitcoinRpc, options.addresses.btcRelayContract);
        const synchronizer = new MempoolBtcRelaySynchronizer(btcRelay, bitcoinRpc);

        this.evmSwapContract = new EVMSwapProgram(provider, btcRelay, options.addresses.swapContract);

        const clientSwapContract = new ClientSwapContract<EVMSwapData>(this.evmSwapContract, EVMSwapData, btcRelay, bitcoinRpc, null, options.pricing, {
            bitcoinNetwork: this.bitcoinNetwork
        });
        const chainEvents = new EVMChainEventsBrowser(provider.provider, this.evmSwapContract);

        this.tobtcln = new SoltoBTCLNWrapper<EVMSwapData>(options.storage?.toBtcLn || new LocalWrapperStorage("evmSwaps-toBTCLN"), clientSwapContract, chainEvents, EVMSwapData);
        this.tobtc = new SoltoBTCWrapper<EVMSwapData>(options.storage?.toBtc || new LocalWrapperStorage("evmSwaps-toBTC"), clientSwapContract, chainEvents, EVMSwapData);
        this.frombtcln = new BTCLNtoSolWrapper<EVMSwapData>(options.storage?.fromBtcLn || new LocalWrapperStorage("evmSwaps-fromBTCLN"), clientSwapContract, chainEvents, EVMSwapData);
        this.frombtc = new BTCtoSolNewWrapper<EVMSwapData>(options.storage?.fromBtc || new LocalWrapperStorage("evmSwaps-fromBTC"), clientSwapContract, chainEvents, EVMSwapData, synchronizer);

        this.chainEvents = chainEvents;
        this.swapContract = clientSwapContract;

        if(options.intermediaryUrl!=null) {
            this.intermediaryUrl = options.intermediaryUrl;
        } else {
            this.intermediaryDiscovery = new IntermediaryDiscovery<EVMSwapData>(this.evmSwapContract, options.registryUrl);
        }
    }

    /**
     * Returns maximum possible swap amount
     *
     * @param kind      Type of the swap
     */
    getMaximum(kind: SwapType): BN {
        if(this.intermediaryDiscovery!=null) {
            const max = this.intermediaryDiscovery.getSwapMaximum(kind);
            if(max!=null) return new BN(max);
        }
        switch(kind) {
            case SwapType.FROM_BTC:
                return ConstantBTCtoSol.max;
            case SwapType.FROM_BTCLN:
                return ConstantBTCLNtoSol.max;
            case SwapType.TO_BTC:
                return ConstantSoltoBTC.max;
            case SwapType.TO_BTCLN:
                return ConstantSoltoBTCLN.max;
        }
        return new BN(0);
    }

    /**
     * Returns minimum possible swap amount
     *
     * @param kind      Type of swap
     */
    getMinimum(kind: SwapType): BN {
        if(this.intermediaryDiscovery!=null) {
            const min = this.intermediaryDiscovery.getSwapMinimum(kind);
            if(min!=null) return new BN(min);
        }
        switch(kind) {
            case SwapType.FROM_BTC:
                return ConstantBTCtoSol.min;
            case SwapType.FROM_BTCLN:
                return ConstantBTCLNtoSol.min;
            case SwapType.TO_BTC:
                return ConstantSoltoBTC.min;
            case SwapType.TO_BTCLN:
                return ConstantSoltoBTCLN.min;
        }
        return new BN(0);
    }

    /**
     * Initializes the swap storage and loads existing swaps
     * Needs to be called before any other action
     */
    async init() {
        await this.chainEvents.init();
        await this.swapContract.init();

        console.log("Initializing EVM -> BTCLN");
        await this.tobtcln.init();
        console.log("Initializing EVM -> BTC");
        await this.tobtc.init();
        console.log("Initializing BTCLN -> EVM");
        await this.frombtcln.init();
        console.log("Initializing BTC -> EVM");
        await this.frombtc.init();

        if(this.intermediaryDiscovery!=null) {
            await this.intermediaryDiscovery.init();
        }
    }

    /**
     * Stops listening for EVM events and closes this Swapper instance
     */
    async stop() {
        await this.tobtcln.stop();
        await this.tobtc.stop();
        await this.frombtcln.stop();
        await this.frombtc.stop();
    }

    async getSwapCandidates(swapType: SwapType, amount: BN, tokenAddress: string) {
        let candidates = this.intermediaryDiscovery.getSwapCandidates(swapType, amount, tokenAddress);
        if(candidates.length===0) {
            //Retry before failing
            await this.intermediaryDiscovery.init();
            candidates = this.intermediaryDiscovery.getSwapCandidates(swapType, amount, tokenAddress);
        }
        if(candidates.length===0) throw new Error("No intermediary found!");
        return candidates;
    }

    /**
     * Creates EVM -> BTC swap
     *
     * @param tokenAddress          Token address to pay with
     * @param address               Recipient's bitcoin address
     * @param amount                Amount to send in satoshis (bitcoin's smallest denomination)
     * @param confirmationTarget    How soon should the transaction be confirmed (determines the fee)
     * @param confirmations         How many confirmations must the intermediary wait to claim the funds
     */
    async createEVMToBTCSwap(tokenAddress: string, address: string, amount: BN, confirmationTarget?: number, confirmations?: number): Promise<SoltoBTCSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.tobtc.create(address, amount, confirmationTarget || 3, confirmations || 3, this.intermediaryUrl+"/tobtc", tokenAddress);
        }
        const candidates = await this.getSwapCandidates(SwapType.TO_BTC, amount, tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.tobtc.create(address, amount, confirmationTarget || 3, confirmations || 3, candidate.url+"/tobtc", tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.TO_BTC].swapBaseFee),
                    new BN(candidate.services[SwapType.TO_BTC].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;
    }

    /**
     * Creates EVM -> BTC swap with exactly specified input token amount
     *
     * @param tokenAddress          Token address to pay with
     * @param address               Recipient's bitcoin address
     * @param amount                Amount to send in token base units
     * @param confirmationTarget    How soon should the transaction be confirmed (determines the fee)
     * @param confirmations         How many confirmations must the intermediary wait to claim the funds
     */
    async createEVMToBTCSwapExactIn(tokenAddress: string, address: string, amount: BN, confirmationTarget?: number, confirmations?: number): Promise<SoltoBTCSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.tobtc.createExactIn(address, amount, confirmationTarget || 3, confirmations || 3, this.intermediaryUrl+"/tobtc", tokenAddress);
        }
        const candidates = await this.getSwapCandidates(SwapType.TO_BTC, amount, tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.tobtc.createExactIn(address, amount, confirmationTarget || 3, confirmations || 3, candidate.url+"/tobtc", tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.TO_BTC].swapBaseFee),
                    new BN(candidate.services[SwapType.TO_BTC].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;
    }

    /**
     * Creates EVM -> BTCLN swap
     *
     * @param tokenAddress          Token address to pay with
     * @param paymentRequest        BOLT11 lightning network invoice to be paid (needs to have a fixed amount)
     * @param expirySeconds         For how long to lock your funds (higher expiry means higher probability of payment success)
     * @param maxRoutingBaseFee     Maximum routing fee to use - base fee (higher routing fee means higher probability of payment success)
     * @param maxRoutingPPM         Maximum routing fee to use - proportional fee in PPM (higher routing fee means higher probability of payment success)
     */
    async createEVMToBTCLNSwap(tokenAddress: string, paymentRequest: string, expirySeconds?: number, maxRoutingBaseFee?: BN, maxRoutingPPM?: BN): Promise<SoltoBTCLNSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.tobtcln.create(paymentRequest, expirySeconds || (3 * 24 * 3600), this.intermediaryUrl + "/tobtcln", maxRoutingBaseFee, maxRoutingPPM, tokenAddress);
        }
        const parsedPR = bolt11.decode(paymentRequest);
        const candidates = await this.getSwapCandidates(SwapType.TO_BTCLN, new BN(parsedPR.millisatoshis).div(new BN(1000)), tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.tobtcln.create(paymentRequest, expirySeconds || (3*24*3600), candidate.url+"/tobtcln", maxRoutingBaseFee, maxRoutingPPM, tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.TO_BTCLN].swapBaseFee),
                    new BN(candidate.services[SwapType.TO_BTCLN].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;

    }

    /**
     * Creates EVM -> BTCLN swap via LNURL-pay
     *
     * @param tokenAddress          Token address to pay with
     * @param lnurlPay              LNURL-pay link to use for the payment
     * @param amount                Amount to be paid in sats
     * @param comment               Optional comment for the payment
     * @param expirySeconds         For how long to lock your funds (higher expiry means higher probability of payment success)
     * @param maxRoutingBaseFee     Maximum routing fee to use - base fee (higher routing fee means higher probability of payment success)
     * @param maxRoutingPPM         Maximum routing fee to use - proportional fee in PPM (higher routing fee means higher probability of payment success)
     */
    async createEVMToBTCLNSwapViaLNURL(tokenAddress: string, lnurlPay: string, amount: BN, comment: string, expirySeconds?: number, maxRoutingBaseFee?: BN, maxRoutingPPM?: BN): Promise<SoltoBTCLNSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.tobtcln.createViaLNURL(lnurlPay, amount, comment, expirySeconds || (3 * 24 * 3600), this.intermediaryUrl + "/tobtcln", maxRoutingBaseFee, maxRoutingPPM, tokenAddress);
        }
        const candidates = await this.getSwapCandidates(SwapType.TO_BTCLN, amount, tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.tobtcln.createViaLNURL(lnurlPay, amount, comment, expirySeconds || (3*24*3600), candidate.url+"/tobtcln", maxRoutingBaseFee, maxRoutingPPM, tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.TO_BTCLN].swapBaseFee),
                    new BN(candidate.services[SwapType.TO_BTCLN].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;

    }


    /**
     * Creates BTC -> EVM swap
     *
     * @param tokenAddress          Token address to receive
     * @param amount                Amount to receive, in satoshis (bitcoin's smallest denomination)
     */
    async createBTCtoEVMSwap(tokenAddress: string, amount: BN): Promise<BTCtoSolNewSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.frombtc.create(amount, this.intermediaryUrl+"/frombtc", tokenAddress);
        }
        const candidates = await this.getSwapCandidates(SwapType.FROM_BTC, amount, tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.frombtc.create(amount, candidate.url+"/frombtc", tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.FROM_BTC].swapBaseFee),
                    new BN(candidate.services[SwapType.FROM_BTC].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;
    }

    /**
     * Creates BTCLN -> EVM swap
     *
     * @param tokenAddress      Token address to receive
     * @param amount            Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param invoiceExpiry     Lightning invoice expiry time (in seconds)
     */
    async createBTCLNtoEVMSwap(tokenAddress: string, amount: BN, invoiceExpiry?: number): Promise<BTCLNtoSolSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.frombtcln.create(amount, invoiceExpiry || (1*24*3600), this.intermediaryUrl+"/frombtcln", tokenAddress);
        }
        const candidates = await this.getSwapCandidates(SwapType.FROM_BTCLN, amount, tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.frombtcln.create(amount, invoiceExpiry || (1*24*3600), candidate.url+"/frombtcln", tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.FROM_BTCLN].swapBaseFee),
                    new BN(candidate.services[SwapType.FROM_BTCLN].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;
    }

    /**
     * Creates BTCLN -> EVM swap, withdrawing from LNURL-withdraw
     *
     * @param lnurl             LNURL-withdraw to pull the funds from
     * @param tokenAddress      Token address to receive
     * @param amount            Amount to receive, in satoshis (bitcoin's smallest denomination)
     * @param invoiceExpiry     Lightning invoice expiry time (in seconds)
     */
    async createBTCLNtoEVMSwapViaLNURL(lnurl: string, tokenAddress: string, amount: BN, invoiceExpiry?: number): Promise<BTCLNtoSolSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.frombtcln.createViaLNURL(lnurl, amount, invoiceExpiry || (1*24*3600), this.intermediaryUrl+"/frombtcln", tokenAddress);
        }
        const candidates = await this.getSwapCandidates(SwapType.FROM_BTCLN, amount, tokenAddress);

        let swap;
        let error;
        for(let candidate of candidates) {
            try {
                swap = await this.frombtcln.createViaLNURL(lnurl, amount, invoiceExpiry || (1*24*3600), candidate.url+"/frombtcln", tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.FROM_BTCLN].swapBaseFee),
                    new BN(candidate.services[SwapType.FROM_BTCLN].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
                error = e;
            }
        }

        if(swap==null) {
            if(error!=null) throw error;
            throw new Error("No intermediary found!");
        }

        return swap;
    }

    /**
     * Returns all swaps that were initiated with the current provider's public key
     */
    async getAllSwaps(): Promise<ISwap[]> {
        return [].concat(
            await this.tobtcln.getAllSwaps(),
            await this.tobtc.getAllSwaps(),
            await this.frombtcln.getAllSwaps(),
            await this.frombtc.getAllSwaps(),
        );
    }

    /**
     * Returns all swaps that were initiated with the current provider's public key
     */
    getAllSwapsSync(): ISwap[] {
        return [].concat(
            this.tobtcln.getAllSwapsSync(),
            this.tobtc.getAllSwapsSync(),
            this.frombtcln.getAllSwapsSync(),
            this.frombtc.getAllSwapsSync(),
        );
    }

    /**
     * Returns swaps that were initiated with the current provider's public key, and there is an action required (either claim or refund)
     */
    async getActionableSwaps(): Promise<ISwap[]> {
        return [].concat(
            await this.tobtcln.getRefundableSwaps(),
            await this.tobtc.getRefundableSwaps(),
            await this.frombtcln.getClaimableSwaps(),
            await this.frombtc.getClaimableSwaps(),
        );
    }

    /**
     * Returns swaps that were initiated with the current provider's public key, and there is an action required (either claim or refund)
     */
    getActionableSwapsSync(): ISwap[] {
        return [].concat(
            this.tobtcln.getRefundableSwapsSync(),
            this.tobtc.getRefundableSwapsSync(),
            this.frombtcln.getClaimableSwapsSync(),
            this.frombtc.getClaimableSwapsSync(),
        );
    }

    /**
     * Returns swaps that are refundable and that were initiated with the current provider's public key
     */
    async getRefundableSwaps(): Promise<ISolToBTCxSwap<EVMSwapData>[]> {
        return [].concat(
            await this.tobtcln.getRefundableSwaps(),
            await this.tobtc.getRefundableSwaps()
        );
    }

    /**
     * Returns swaps that are refundable and that were initiated with the current provider's public key
     */
    getRefundableSwapsSync(): ISolToBTCxSwap<EVMSwapData>[] {
        return [].concat(
            this.tobtcln.getRefundableSwapsSync(),
            this.tobtc.getRefundableSwapsSync()
        );
    }

    /**
     * Returns swaps that are in-progress and are claimable that were initiated with the current provider's public key
     */
    async getClaimableSwaps(): Promise<IBTCxtoSolSwap<EVMSwapData>[]> {
        return [].concat(
            await this.frombtcln.getClaimableSwaps(),
            await this.frombtc.getClaimableSwaps()
        );
    }

    /**
     * Returns swaps that are in-progress and are claimable that were initiated with the current provider's public key
     */
    getClaimableSwapsSync(): IBTCxtoSolSwap<EVMSwapData>[] {
        return [].concat(
            this.frombtcln.getClaimableSwapsSync(),
            this.frombtc.getClaimableSwapsSync()
        );
    }

    /**
     * Returns whether an approval transaction is required for the swap data
     */
    async isApproveRequired(swap: ISolToBTCxSwap<EVMSwapData>): Promise<boolean> {
        const allowance = await this.evmSwapContract.getAllowance(swap.data);
        return allowance.lt(swap.data.amount);
    }

    async approveSpend(swap: ISolToBTCxSwap<EVMSwapData>): Promise<string> {
        return this.evmSwapContract.approveSpend(swap.data, true);
    }
}