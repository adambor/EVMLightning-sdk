
export const EVMChains = {
    Q_TESTNET: {
        chainId: 35443,
        addresses: {
            swapContract: "0x35D0baFC22DCF72aE530df0280d51d7531a4d44F",
            btcRelayContract: "0x5b9D4C04D7CeC6f52562a0eCcf5Aa61FB49CA7dE"
        }
    },
    Q: {
        chainId: 35441,
        addresses: {
            swapContract: "0x79CDD6a3dcfCD837FA910945CaB7d10FA90b3327",
            btcRelayContract: "0x5b9D4C04D7CeC6f52562a0eCcf5Aa61FB49CA7dE"
        },
        tokens: {
            WBTC: "0x864779670a7b3205580d0a3Be85744954ab075e7",
            USDC: "0xC382cA00c56023C4A870473f14890A023Ca4706f",
            USDT: "0x1234912185912561275418727185781012124012",
            ETH: "0x0000000000000000000000000000000000000000"
        },
        coinGeckoId: "$ignore",
        registryUrl: "https://api.github.com/repos/adambor/QLightning-registry/contents/registry.json?ref=main"
    },
    POLYGON_TESTNET : {
        chainId: 80001,
        addresses: {
            swapContract: "0x140b71Bbc5605C97065CD22A3dFD0fe81260Be2F",
            btcRelayContract: "0xEB8546E8B955b7564239Be8452AC2a8B24c07Ed7"
        }
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
        coinGeckoId: "matic-network"
    }
};
