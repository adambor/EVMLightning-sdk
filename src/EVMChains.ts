import {BitcoinNetwork} from "./BitcoinNetwork";

export const EVMChains = {
    Q_TESTNET: {
        chainId: 35443,
        addresses: {
            swapContract: "0x35D0baFC22DCF72aE530df0280d51d7531a4d44F",
            btcRelayContract: "0x5b9D4C04D7CeC6f52562a0eCcf5Aa61FB49CA7dE"
        },
        bitcoinNetwork: BitcoinNetwork.TESTNET
    },
    Q: {
        chainId: 35441,
        addresses: {
            swapContract: "0x9f6990903AD1b7Afd7c9DD7Ddeb61f2A5Fe28c6D",
            btcRelayContract: "0xaE7b04B89c9B4D5F85AC6B881697f39020CE4BE2"
        },
        tokens: {
            WBTC: "0x864779670a7b3205580d0a3Be85744954ab075e7",
            USDC: "0xC382cA00c56023C4A870473f14890A023Ca4706f",
            USDT: "0x1234912185912561275418727185781012124012",
            ETH: "0x0000000000000000000000000000000000000000"
        },
        coinGeckoId: "$ignore",
        registryUrl: "https://api.github.com/repos/adambor/QLightning-registry/contents/registry.json?ref=main",
        bitcoinNetwork: BitcoinNetwork.MAINNET
    },
    POLYGON_TESTNET : {
        chainId: 80001,
        addresses: {
            swapContract: "0x140b71Bbc5605C97065CD22A3dFD0fe81260Be2F",
            btcRelayContract: "0xEB8546E8B955b7564239Be8452AC2a8B24c07Ed7"
        },
        bitcoinNetwork: BitcoinNetwork.TESTNET
    },
    POLYGON : {
        chainId: 137,
        addresses: {
            swapContract: "0x0d771417E65Bd58D64ADa73A83EE7FAca3c002f1",
            btcRelayContract: "0x5E2221D70c4cDD2854E13A00fF4a9BD617bF701B"
        },
        tokens: {
            WBTC: "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6",
            USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
            USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
            ETH: "0x0000000000000000000000000000000000000000"
        },
        coinGeckoId: "matic-network",
        registryUrl: null,
        bitcoinNetwork: BitcoinNetwork.MAINNET
    },
    LINEA_TESTNET: {
        chainId: 59140,
        addresses: {
            swapContract: "0x9360b08276Fe610A41A18a787a7B9EC65E224BcE",
            btcRelayContract: "0xB9CA45e93Ba54ba834C66b8Db568A41f89b5aA16"
        },
        tokens: {
            WBTC: "0xDbcd5BafBAA8c1B326f14EC0c8B125DB57A5cC4c",
            USDC: "0xf56dc6695cF1f5c364eDEbC7Dc7077ac9B586068",
            USDT: "0x1990BC6dfe2ef605Bfc08f5A23564dB75642Ad73",
            ETH: "0x0000000000000000000000000000000000000000"
        },
        coinGeckoId: "ethereum",
        registryUrl: null,
        bitcoinNetwork: BitcoinNetwork.TESTNET
    }
};
