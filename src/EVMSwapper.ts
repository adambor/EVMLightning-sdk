import * as bitcoin from "bitcoinjs-lib";
import * as bolt11 from "bolt11";
import * as BN from "bn.js";
import {ConstantBTCLNtoSol, ConstantBTCtoSol, ConstantSoltoBTC, ConstantSoltoBTCLN} from "./Constants";


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
    SwapType
} from "crosslightning-sdk-base";
import {Signer} from "ethers";
import {EVMChains} from "./EVMChains";
import {BitcoinNetwork} from "./BitcoinNetwork";
import {ChainUtils} from "crosslightning-sdk-base/dist";

type SwapperOptions = {
    intermediaryUrl?: string,
    //wbtcToken?: PublicKey,
    pricing?: ISwapPrice,
    registryUrl?: string,

    addresses?: {
        swapContract: string,
        btcRelayContract: string
    },
    bitcoinNetwork?: BitcoinNetwork
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
     * Returns satoshi value of BOLT11 bitcoin lightning invoice WITH AMOUNT
     *
     * @param lnpr
     */
    static getLightningInvoiceValue(lnpr: string): BN {
        const parsed = bolt11.decode(lnpr);
        if(parsed.satoshis!=null) return new BN(parsed.satoshis);
        return null;
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

        const clientSwapContract = new ClientSwapContract<EVMSwapData>(this.evmSwapContract, EVMSwapData, null, options.pricing, {
            bitcoinNetwork: this.bitcoinNetwork
        });
        const chainEvents = new EVMChainEventsBrowser(provider.provider, this.evmSwapContract);

        this.tobtcln = new SoltoBTCLNWrapper<EVMSwapData>(new LocalWrapperStorage("evmSwaps-toBTCLN"), clientSwapContract, chainEvents, EVMSwapData);
        this.tobtc = new SoltoBTCWrapper<EVMSwapData>(new LocalWrapperStorage("evmSwaps-toBTC"), clientSwapContract, chainEvents, EVMSwapData);
        this.frombtcln = new BTCLNtoSolWrapper<EVMSwapData>(new LocalWrapperStorage("evmSwaps-fromBTCLN"), clientSwapContract, chainEvents, EVMSwapData);
        this.frombtc = new BTCtoSolNewWrapper<EVMSwapData>(new LocalWrapperStorage("evmSwaps-fromBTC"), clientSwapContract, chainEvents, EVMSwapData, synchronizer);

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
            return this.tobtc.create(address, amount, confirmationTarget || 3, confirmations || 3, this.intermediaryUrl+"/tobtc");
        }
        const candidates = this.intermediaryDiscovery.getSwapCandidates(SwapType.TO_BTC, amount, tokenAddress);
        if(candidates.length===0) throw new Error("No intermediary found!");

        let swap;
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
            }
        }

        if(swap==null) throw new Error("No intermediary found!");

        return swap;
    }

    /**
     * Creates EVM -> BTCLN swap
     *
     * @param tokenAddress          Token address to pay with
     * @param paymentRequest        BOLT11 lightning network invoice to be paid (needs to have a fixed amount)
     * @param expirySeconds         For how long to lock your funds (higher expiry means higher probability of payment success)
     */
    async createEVMToBTCLNSwap(tokenAddress: string, paymentRequest: string, expirySeconds?: number): Promise<SoltoBTCLNSwap<EVMSwapData>> {
        if(this.intermediaryUrl!=null) {
            return this.tobtcln.create(paymentRequest, expirySeconds || (3 * 24 * 3600), this.intermediaryUrl + "/tobtcln");
        }
        const parsedPR = bolt11.decode(paymentRequest);
        const candidates = this.intermediaryDiscovery.getSwapCandidates(SwapType.TO_BTCLN, new BN(parsedPR.millisatoshis).div(new BN(1000)), tokenAddress);
        if(candidates.length===0) throw new Error("No intermediary found!");

        let swap;
        for(let candidate of candidates) {
            try {
                swap = await this.tobtcln.create(paymentRequest, expirySeconds || (3*24*3600), candidate.url+"/tobtcln", tokenAddress, candidate.address,
                    new BN(candidate.services[SwapType.TO_BTCLN].swapBaseFee),
                    new BN(candidate.services[SwapType.TO_BTCLN].swapFeePPM));
                break;
            } catch (e) {
                if(e instanceof IntermediaryError) {
                    //Blacklist that node
                    this.intermediaryDiscovery.removeIntermediary(candidate);
                }
                console.error(e);
            }
        }

        if(swap==null) throw new Error("No intermediary found!");

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
            return this.frombtc.create(amount, this.intermediaryUrl+"/frombtc");
        }
        const candidates = this.intermediaryDiscovery.getSwapCandidates(SwapType.FROM_BTC, amount, tokenAddress);
        if(candidates.length===0) throw new Error("No intermediary found!");

        let swap;
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
            }
        }

        if(swap==null) throw new Error("No intermediary found!");

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
            return this.frombtcln.create(amount, invoiceExpiry || (1*24*3600), this.intermediaryUrl+"/frombtcln");
        }
        const candidates = this.intermediaryDiscovery.getSwapCandidates(SwapType.FROM_BTCLN, amount, tokenAddress);
        if(candidates.length===0) throw new Error("No intermediary found!");


        let swap;
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
            }
        }

        if(swap==null) throw new Error("No intermediary found!");

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
     * Returns swaps that are refundable and that were initiated with the current provider's public key
     */
    async getRefundableSwaps(): Promise<ISolToBTCxSwap<EVMSwapData>[]> {
        return [].concat(
            await this.tobtcln.getRefundableSwaps(),
            await this.tobtc.getRefundableSwaps()
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