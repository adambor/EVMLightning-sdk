import * as BN from "bn.js";
import {EVMChains} from "./EVMChains";
import {CoinGeckoSwapPrice} from "crosslightning-sdk-base";
import {SwapperOptions} from "./EVMSwapper";
import {FileSystemWrapperStorage} from "crosslightning-sdk-base/dist/fs-storage";
import * as fs from "fs";

export function createNodeJSSwapperOptions(chain: "Q" | "POLYGON" | "LINEA_TESTNET", maxFeeDifference?: BN, intermediaryUrl?: string, tokenAddresses?: {WBTC: string, USDC: string, USDT: string}): SwapperOptions {
    const coinsMap = CoinGeckoSwapPrice.createCoinsMap(
        EVMChains[chain].tokens.WBTC || tokenAddresses?.WBTC,
        EVMChains[chain].tokens.USDC || tokenAddresses?.USDC,
        EVMChains[chain].tokens.USDT || tokenAddresses?.USDT
    );

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
        intermediaryUrl: intermediaryUrl
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