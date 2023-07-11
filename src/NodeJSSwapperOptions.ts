import * as BN from "bn.js";
import {EVMChains} from "./EVMChains";
import {CoinGeckoSwapPrice} from "crosslightning-sdk-base";
import {SwapperOptions} from "./EVMSwapper";
import {FileSystemWrapperStorage} from "crosslightning-sdk-base/dist/fs-storage";
import * as fs from "fs";

export function createNodeJSSwapperOptions(chain: "Q" | "Q_TESTNET" | "POLYGON" | "POLYGON_TESTNET" | "LINEA_TESTNET" | "OKTC", maxFeeDifference?: BN, intermediaryUrl?: string, tokenAddresses?: {WBTC: string, USDC: string, USDT: string}): SwapperOptions {
    const wbtc = EVMChains[chain].tokens.WBTC || tokenAddresses?.WBTC;
    const usdc = EVMChains[chain].tokens.USDC || tokenAddresses?.USDC;
    const usdt = EVMChains[chain].tokens.USDT || tokenAddresses?.USDT;

    const coinsMap = CoinGeckoSwapPrice.createCoinsMap(
        wbtc,
        usdc,
        usdt
    );

    if(EVMChains[chain].tokenDecimals!=null) {
        if(wbtc!=null && EVMChains[chain].tokenDecimals.WBTC!=null) coinsMap[wbtc].decimals = EVMChains[chain].tokenDecimals.WBTC;
        if(usdc!=null && EVMChains[chain].tokenDecimals.USDC!=null) coinsMap[usdc].decimals = EVMChains[chain].tokenDecimals.USDC;
        if(usdt!=null && EVMChains[chain].tokenDecimals.USDT!=null) coinsMap[usdt].decimals = EVMChains[chain].tokenDecimals.USDT;
    }

    coinsMap["0x0000000000000000000000000000000000000000"] = {
        coinId: EVMChains[chain].coinGeckoId,
        decimals: 18
    };

    const returnObj: SwapperOptions =  {
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
        intermediaryUrl: intermediaryUrl,
        maxLogFetch: EVMChains[chain].maxLogFetch
    };

    try {
        fs.mkdirSync("storage");
    } catch (e) {}

    returnObj.storage = {};

    returnObj.storage.fromBtc = new FileSystemWrapperStorage("storage/fromBtc");
    returnObj.storage.fromBtcLn = new FileSystemWrapperStorage("storage/fromBtcLn");
    returnObj.storage.toBtc = new FileSystemWrapperStorage("storage/toBtc");
    returnObj.storage.toBtcLn = new FileSystemWrapperStorage("storage/toBtcLn");

    return returnObj;
}